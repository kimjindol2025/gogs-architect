# 🚀 GOGS Architect - 프로덕션 배포 가이드

**목표**: 253 서버에 GOGS Architect API 시스템을 배포하고 실제 GOGS 저장소와 연동합니다.

---

## 📋 시스템 구성

```
┌─────────────────────────────────────────────────────┐
│            GOGS Architect System                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐                               │
│  │  Nginx           │  SSL/TLS + Rate Limit         │
│  │  (리버스 프록시)  │                               │
│  └────────┬─────────┘                               │
│           │                                         │
│  ┌────────▼─────────┐                               │
│  │ PM2 Cluster      │  4개 Node.js 프로세스          │
│  │ (api-server-v3)  │  • 요청 분산                 │
│  └────────┬─────────┘  • 자동 재시작                │
│           │                                         │
│  ┌────────▼──────────────────────────────┐          │
│  │       API Server (api-server-v3.js)   │          │
│  ├────────────────────────────────────────┤          │
│  │ • SearchEnhanced (패턴 검색)           │          │
│  │ • WebhookManager (GOGS 이벤트)         │          │
│  │ • MonitoringSystem (실시간 통계)       │          │
│  │ • RateLimiter (보안)                   │          │
│  │ • InputValidator (입력 검증)           │          │
│  └────────┬──────────────────────────────┘          │
│           │                                         │
│  ┌────────▼──────────────────┐                      │
│  │  Data Layer               │                      │
│  ├──────────────────────────┤                       │
│  │ • JSON (즉시)            │                       │
│  │ • SQLite (향후)          │                       │
│  │ • Cache Layer            │                       │
│  └──────────────────────────┘                       │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         │ GOGS Webhook
         │
┌────────▼──────────────────────────────┐
│         GOGS Server                   │
│   (gogs.dclub.kr)                     │
└────────────────────────────────────────┘
```

---

## 🔧 사전 요구사항

### 253 서버 환경
```bash
# 필수 소프트웨어
- Node.js >= 18.0.0
- npm >= 8.0.0
- PM2 (프로세스 관리)
- Nginx (리버스 프록시)
- Git (선택)

# 권장 사양
- CPU: 4코어 이상
- 메모리: 4GB 이상
- 디스크: 10GB 이상
- 대역폭: 100Mbps 이상
```

### 설치 확인
```bash
node --version     # v18+
npm --version      # 8+
pm2 --version      # 최신
nginx -v           # 최신
```

---

## 📖 배포 절차

### 1️⃣ 저장소 클론 및 환경 설정

```bash
# 배포 디렉토리로 이동
cd /opt/gogs-architect

# 저장소 클론 (또는 git pull)
git clone https://github.com/anthropics/gogs-architect.git .

# 환경 변수 설정
cp .env.example .env
nano .env  # 실제 값으로 수정
```

### 2️⃣ .env 파일 구성

**필수 항목 (반드시 설정)**:

```env
# GOGS 서버
GOGS_BASE_URL=https://gogs.dclub.kr
GOGS_API_TOKEN=your_gogs_access_token
GOGS_USERNAME=kim
GOGS_WEBHOOK_URL=https://architect.gogs.dclub.kr/api/v1/webhook/gogs

# API 포트
PORT=3000
NODE_ENV=production

# 모니터링
MONITORING_ENABLED=true
ALERT_ERROR_RATE_THRESHOLD=0.05
```

**GOGS 접근 토큰 생성**:
```bash
# 1. GOGS 웹 UI 접속: https://gogs.dclub.kr/user/settings/applications
# 2. "New Access Token" 클릭
# 3. 이름: "gogs-architect"
# 4. 권한: repo, admin:repo_hook 선택
# 5. 토큰 복사 → .env GOGS_API_TOKEN에 붙여넣기
```

### 3️⃣ 의존성 설치 및 배포

```bash
# 의존성 설치
npm install --production

# 배포 스크립트 실행
bash deploy.sh production

# 또는 npm 스크립트
npm run deploy
```

**배포 스크립트가 수행하는 작업**:
- ✅ 저장소 최신화 (git pull)
- ✅ 의존성 설치 (npm install)
- ✅ 디렉토리 생성 (logs, data, cache)
- ✅ 권한 설정
- ✅ PM2 프로세스 관리
- ✅ 헬스 체크 (http://localhost:3000/health)

### 4️⃣ PM2 프로세스 관리

```bash
# 프로세스 상태 확인
pm2 status

# 프로세스 로그 확인
pm2 logs gogs-architect-api

# 프로세스 재시작
npm run pm2:restart

# 프로세스 중지
npm run pm2:stop

# 부팅 시 자동 시작
pm2 startup
pm2 save
```

### 5️⃣ Nginx 리버스 프록시 설정

```bash
# Nginx 설정 파일 복사
sudo cp /opt/gogs-architect/nginx.conf \
  /etc/nginx/sites-available/architect.gogs.dclub.kr

# 심링크 생성
sudo ln -sf /etc/nginx/sites-available/architect.gogs.dclub.kr \
  /etc/nginx/sites-enabled/

# Nginx 설정 검사
sudo nginx -t

# Nginx 재로드
sudo systemctl reload nginx
```

### 6️⃣ SSL/TLS 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치 (Ubuntu/Debian)
sudo apt-get install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot certonly --nginx \
  -d architect.gogs.dclub.kr

# 자동 갱신 설정
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 7️⃣ GOGS 웹훅 자동 설정

```bash
# GOGS 저장소에 웹훅 자동 등록
npm run gogs:setup

# 수동 확인
curl -X GET "https://architect.gogs.dclub.kr/api/v1/metrics"
```

---

## 🧪 배포 검증

### API 헬스 체크
```bash
# 기본 헬스 체크
curl https://architect.gogs.dclub.kr/health

# 상세 헬스 보고서
curl https://architect.gogs.dclub.kr/api/v1/health

# 응답:
# {
#   "status": "success",
#   "data": {
#     "status": "healthy",
#     "issues": [],
#     "metrics": { ... }
#   }
# }
```

### 웹 대시보드 접속
```
https://architect.gogs.dclub.kr/dashboard
```

**확인 사항**:
- ✅ 메트릭 카드 표시 (총 요청, 에러율, 응답시간, 메모리)
- ✅ 엔드포인트 테이블 갱신
- ✅ 실시간 알림 표시
- ✅ 10초마다 자동 새로고침

### API 테스트
```bash
# 검색 API
curl -X POST "https://architect.gogs.dclub.kr/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"useState"}'

# 3단어 분석
curl -X POST "https://architect.gogs.dclub.kr/api/v1/search/three-words" \
  -H "Content-Type: application/json" \
  -d '{"words":["sql","parser","aws"]}'

# 에이전트 상태
curl "https://architect.gogs.dclub.kr/api/v1/agent/status"

# 저장소 목록
curl "https://architect.gogs.dclub.kr/api/v1/repositories"
```

### 모니터링 검증
```bash
# 메트릭 조회
curl "https://architect.gogs.dclub.kr/api/v1/metrics"

# 알림 목록
curl "https://architect.gogs.dclub.kr/api/v1/alerts"

# 타임 시리즈 데이터
curl "https://architect.gogs.dclub.kr/api/v1/metrics"
```

---

## 🔍 로그 모니터링

```bash
# PM2 로그 (실시간)
pm2 logs gogs-architect-api

# 에러 로그
tail -f logs/api-error.log

# 출력 로그
tail -f logs/api-out.log

# Nginx 접근 로그
sudo tail -f /var/log/nginx/architect-access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/architect-error.log
```

---

## 📊 시스템 성능 모니터링

### PM2 Plus 모니터링 (선택사항)
```bash
# PM2 Plus 계정 링크
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY

# 대시보드 접속
# https://app.pm2.io
```

### 커스텀 모니터링
```bash
# 시스템 리소스 모니터링
while true; do
  curl -s "https://architect.gogs.dclub.kr/api/v1/health" | jq '.data.metrics'
  sleep 10
done

# 에러율 추적
watch -n 5 'curl -s "https://architect.gogs.dclub.kr/api/v1/metrics" | jq ".data.summary.errorRate"'
```

---

## 🔐 보안 설정

### Rate Limiting
```bash
# Nginx 설정에서 자동 적용
# API: 100req/min
# Webhook: 1000req/min

# 테스트
for i in {1..101}; do
  curl -s "https://architect.gogs.dclub.kr/api/v1/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"test"}' > /dev/null
  echo "$i"
done
# 101번째에서 429 Too Many Requests 응답 예상
```

### CORS 설정
```bash
# .env에서 CORS_ORIGINS 설정
CORS_ORIGINS=https://example.com,https://another.com

# 특정 도메인만 허용 권장
```

### 입력 검증
```bash
# SQL Injection 시도
curl -X POST "https://architect.gogs.dclub.kr/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"test\"; DROP TABLE users; --"}'
# 검증 오류 응답 (400 Bad Request)

# XSS 시도
curl -X POST "https://architect.gogs.dclub.kr/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"<script>alert(1)</script>"}'
# 검증 오류 응답 (400 Bad Request)
```

---

## 🛠️ 트러블슈팅

### API가 응답하지 않는 경우
```bash
# 1. PM2 상태 확인
pm2 status

# 2. 포트 확인
sudo lsof -i :3000

# 3. 로그 확인
pm2 logs gogs-architect-api

# 4. 프로세스 재시작
pm2 restart gogs-architect-api

# 5. 의존성 확인
npm list --depth=0
```

### Nginx 연결 거부
```bash
# 1. Nginx 상태 확인
sudo systemctl status nginx

# 2. 설정 검사
sudo nginx -t

# 3. 포트 확인
sudo netstat -tlnp | grep 443

# 4. 방화벽 확인
sudo ufw status
sudo ufw allow 443/tcp
```

### 웹훅이 작동하지 않는 경우
```bash
# 1. GOGS 웹훅 설정 확인
curl -H "Authorization: token YOUR_TOKEN" \
  "https://gogs.dclub.kr/api/v1/repos/kim/freelang-v6/hooks"

# 2. 웹훅 재설정
npm run gogs:setup

# 3. 웹훅 테스트
curl -X POST "https://architect.gogs.dclub.kr/api/v1/webhook/gogs" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "push",
    "repository": {
      "id": 1,
      "full_name": "kim/test",
      "name": "test"
    }
  }'
```

### 높은 메모리 사용량
```bash
# 1. 메모리 제한 확인
pm2 describe gogs-architect-api

# 2. 메모리 제한 설정
# ecosystem.config.js에서 max_memory_restart 조정

# 3. 캐시 정리
rm -rf cache/*

# 4. 프로세스 재시작
pm2 restart gogs-architect-api
```

---

## 📅 유지보수

### 정기 점검 (주 1회)
```bash
# 시스템 헬스 체크
curl https://architect.gogs.dclub.kr/api/v1/health

# 디스크 사용량 확인
df -h /opt/gogs-architect

# 로그 파일 크기 확인
du -sh logs/*

# 데이터 파일 크기 확인
du -sh data/*
```

### 월간 유지보수
```bash
# 의존성 업데이트 확인
npm outdated

# 로그 로테이션
# (PM2 자동 관리)

# 캐시 정리
rm -rf cache/*

# 데이터 백업
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

### 백업 전략
```bash
# 수동 백업
bash scripts/backup.sh

# 자동 백업 (cron)
0 2 * * * /opt/gogs-architect/scripts/backup.sh
```

---

## 📞 지원 및 문서

### 유용한 명령어
```bash
# API 문서
https://architect.gogs.dclub.kr/

# 대시보드
https://architect.gogs.dclub.kr/dashboard

# 상태 확인
npm run pm2:logs

# 재배포
npm run deploy

# 테스트 실행
npm run test:webhook
npm run test:monitoring
```

### 문제 보고
```bash
# 로그 수집
tar -czf debug-$(date +%s).tar.gz logs/ data/

# 상태 정보 저장
{
  pm2 status
  npm list --depth=0
  node --version
  npm --version
} > system-info.txt

# GitHub Issues에 업로드
```

---

## 🎉 배포 완료!

축하합니다! GOGS Architect가 253 서버에서 정상 작동합니다.

### 다음 단계:
1. ✅ 웹 대시보드 모니터링 시작
2. ✅ GOGS 저장소 자동 인덱싱 활성화
3. ✅ 알림 임계값 조정
4. ✅ 팀 멤버와 API 공유

### 성능 목표:
- 응답시간: < 100ms (평균)
- 에러율: < 0.5%
- 가용성: > 99.5%

---

**최종 확인**:
```bash
# 모든 시스템이 정상인지 확인
curl https://architect.gogs.dclub.kr/api/v1/health | jq '.data.status'
# 응답: "healthy"

echo "🎉 배포 완료!"
```
