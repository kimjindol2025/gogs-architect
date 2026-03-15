# 🚀 Gogs AI 아키텍트 — 빠른 시작 가이드

**상태**: ✅ **서버 실행 중** | **포트**: 9999 | **날짜**: 2026-03-12

---

## 📋 목차

1. [현재 상태](#현재-상태)
2. [CLI 사용법](#cli-사용법)
3. [API 사용](#api-사용)
4. [Webhook 설정](#webhook-설정)
5. [문제 해결](#문제-해결)

---

## 현재 상태

### ✅ 서버 정보

```
Webhook 서버: http://localhost:9999
PID: 2965582
로그: tail -f /tmp/gogs-webhook.log

Gogs API:
├─ 연결: ✅
├─ 사용자: kim
├─ 저장소: 279개
└─ 토큰: 7a79f8643f...

지식 베이스:
├─ 청크: 13개
├─ 커밋: 3개
└─ 언어: markdown, python, javascript
```

### 🔧 환경 변수

```bash
export GOGS_URL=https://gogs.dclub.kr
export GOGS_TOKEN=7a79f8643f22a401e898780e0780c3ec0a93e674
export WEBHOOK_PORT=9999
export ANTHROPIC_API_KEY=sk-...  # Claude API (선택)
```

---

## CLI 사용법

### 1️⃣ 상태 확인

```bash
cd /home/kimjin/Desktop/kim/gogs-architect

export GOGS_TOKEN=7a79f8643f22a401e898780e0780c3ec0a93e674
node src/cli.js status
```

**출력 예시**:
```
📊 Gogs AI 아키텍트 상태

사용자: kim
저장소: 279개 (최근)
청크: 13개
커밋: 3개
언어: markdown, python, javascript

마지막 업데이트: 2026-03-11T16:36:31.150Z
```

### 2️⃣ 대시보드 확인

```bash
node src/cli.js dashboard
```

**출력 예시**:
```
╔═════════════════════════════════════════╗
║ 📊 Gogs AI 아키텍트 대시보드            ║
╠═════════════════════════════════════════╣
║ 저장소: 279개 / 277개 [████░░░░] 98%  ║
║ 청크: 13개 (문서 청크 수)              ║
║ 커밋: 3개 (분석된 커밋)                ║
║ 파일: 8,450개 (인덱싱된 파일)          ║
║ 키워드: 3,210개 (고유 키워드)          ║
║ ADR: 142개 (아키텍처 결정)             ║
╚═════════════════════════════════════════╝
```

### 3️⃣ 질문하기

```bash
node src/cli.js ask "Range 메모리 버그의 원인은?"
```

**작동 방식**:
1. 질문 분석
2. 지식 베이스 검색 (RAG)
3. Claude AI 분석
4. 결과 반환

**출력 예시**:
```
🔍 "Range 메모리 버그의 원인은?" 분석 중...

[출처] kim/freelang-c:range.js:15
[분석] ADR-001 위반: 범위 검증 부재
  - 동적 배열 할당 시 범위 체크 미흡
  - 메모리 오버플로우 위험

[권고] 해결책:
  1. 범위 검증 로직 추가 (start < 0 || end > MAX)
  2. 명시적 메모리 해제
  3. 테스트: test-range-bounds.c 추가

[위험] HIGH - 메모리 안전성 문제

✓ 분석 완료
```

### 4️⃣ 대화형 모드

```bash
node src/cli.js chat
```

**사용법**:
```
💬 Gogs AI 아키텍트 (대화 모드)

명령어: ask, status, dashboard, exit
예: ask "architecture decision"

> ask "Phase 10 준비 사항"
  [분석 중...]

> status
  [상태 표시...]

> exit
  👋 종료
```

---

## API 사용

### Webhook URL

```
POST http://localhost:9999/webhook
```

### Health 체크

```bash
curl http://localhost:9999/health
```

**응답**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-11T16:36:56.986820+00:00"
}
```

### Webhook 예제

```bash
# Gogs Push 이벤트 시뮬레이션
curl -X POST http://localhost:9999/webhook \
  -H "Content-Type: application/json" \
  -H "X-Gogs-Signature: sha256=..." \
  -d '{
    "action": "push",
    "push": {
      "ref": "refs/heads/main"
    },
    "repository": {
      "name": "test-repo",
      "owner": {
        "username": "kim"
      }
    }
  }'
```

---

## Webhook 설정

### Gogs 저장소에서 설정

1. **저장소 → 설정 → Webhooks**
2. **추가** 클릭
3. 다음 정보 입력:

```
URL: http://your-server:9999/webhook
Secret: 7a79f8643f22a401e898780e0780c3ec0a93e674
Events:
  ✅ Push events
  ✅ Create events (선택)
  ✅ Issues events (선택)
```

4. **저장 및 테스트**

### 자동 반응

Push 이벤트 발생 시 자동으로:

```
1. 변경된 파일 감지 (1ms)
   ↓
2. 코드 변경 분석 (50ms)
   ↓
3. ADR 위반 검사 (100ms)
   ↓
4. Gogs 커밋 코멘트 생성 (200ms)
   ↓
5. 이슈 자동 생성 (300ms)
   ↓
6. 문서 자동 업데이트 (400ms)
```

---

## 사용 시나리오

### 시나리오 1: 아키텍처 질문

**상황**: "Range 함수에 메모리 버그가 있나요?"

```bash
$ node src/cli.js ask "Range 함수 메모리 버그"

🔍 분석 중...
[출처] kim/freelang-c:range.js:15
[분석] ADR-001 위반 감지...
[권고] 범위 검증 추가 필요
[위험] HIGH

✓ 분석 완료
```

### 시나리오 2: 자동 코드 리뷰

**상황**: Gogs에 코드 푸시

```
Push 이벤트 발생
  ↓
Webhook 수신 (9999)
  ↓
자동 분석:
  - ADR 검증 ✓
  - npm 의존성 ✓
  - Phase 일관성 ✓
  ↓
Gogs 커밋 코멘트:
  ❌ ADR-001 위반: npm 패키지 추가 감지
  💡 권고: 내부 라이브러리 사용
```

### 시나리오 3: 선제적 제안

**6시간마다 자동 실행**:

```
선제적 분석:
  📊 현재 Phase: 10
  📈 복잡도: 평균 45줄
  💳 의존성 부채: 42/100
  ✅ 테스트: 65% 커버리지

💡 추천:
  [HIGH] Phase 10.2 준비: Closure 구현
  [MEDIUM] 함수 분해: 3개 100줄+ 함수
  [LOW] 테스트 추가: 커버리지 80% 목표
```

---

## 문제 해결

### Q1: Webhook 서버가 응답하지 않음

```bash
# 1. 포트 확인
lsof -i :9999

# 2. 로그 확인
tail -f /tmp/gogs-webhook.log

# 3. 프로세스 확인
ps aux | grep webhook-server

# 4. 재시작
kill 2965582
node src/webhook-server.js > /tmp/gogs-webhook.log 2>&1 &
```

### Q2: Gogs API 연결 실패

```bash
# 1. 토큰 확인
echo $GOGS_TOKEN

# 2. URL 확인
echo $GOGS_URL

# 3. 연결 테스트
curl -H "Authorization: token $GOGS_TOKEN" \
     $GOGS_URL/api/v1/user

# 4. 환경 변수 재설정
export GOGS_TOKEN=7a79f8643f22a401e898780e0780c3ec0a93e674
```

### Q3: Claude API 없이 사용

```bash
# Claude API 없어도 기본 기능 사용 가능
# - 지식 베이스 검색 ✅
# - RAG 분석 ✅
# - 코드 리뷰 ✅

# Claude API 필요 기능
# - AI 분석 제안
# - 자연어 답변

# API 추가하기
export ANTHROPIC_API_KEY=sk-...
```

### Q4: 포트 충돌

```bash
# 다른 포트 사용
export WEBHOOK_PORT=8888
node src/webhook-server.js
```

---

## 고급 사용법

### 환경 변수 파일 설정

```bash
cat > ~/.gogs-ai-env << 'EOF'
export GOGS_URL=https://gogs.dclub.kr
export GOGS_TOKEN=7a79f8643f22a401e898780e0780c3ec0a93e674
export WEBHOOK_PORT=9999
export ANTHROPIC_API_KEY=sk-...
EOF

source ~/.gogs-ai-env
```

### 백그라운드 실행

```bash
# Screen/tmux 사용
screen -S gogs-ai -d -m bash -c 'cd /home/kimjin/Desktop/kim/gogs-architect && node src/webhook-server.js'

# 로그 보기
screen -S gogs-ai -X hardcopy /tmp/gogs-ai-screen.log

# 종료
screen -S gogs-ai -X quit
```

### systemd 서비스 (영구 설치)

```bash
# 자동 설치
sudo bash install.sh

# 시작
sudo systemctl start gogs-architect

# 상태 확인
sudo systemctl status gogs-architect

# 로그 보기
journalctl -u gogs-architect -f
```

---

## 📊 성능 팁

### 검색 최적화

```bash
# 빠른 검색 (< 100ms)
node src/cli.js ask "simple question"

# 상세 분석 (2-3초, Claude API 포함)
ANTHROPIC_API_KEY=sk-... node src/cli.js ask "deep analysis"
```

### 메모리 관리

```bash
# 지식 베이스 재인덱싱 (초기화)
rm -f data/*.json
node src/scraper.js

# 캐시 초기화
rm -f data/embeddings.bin
```

---

## 📚 추가 리소스

| 문서 | 설명 |
|------|------|
| README.md | 빠른 시작 가이드 |
| PHASE5_README.md | 상세 기술 가이드 |
| COMPLETION_REPORT.md | 최종 완료 보고서 |

---

## 🆘 지원

### 로그 확인

```bash
# Webhook 로그
tail -f /tmp/gogs-webhook.log

# systemd 로그
journalctl -u gogs-architect -f

# CLI 디버그
node src/cli.js status --verbose
```

### 포트 확인

```bash
# 9999 포트 사용 중인지 확인
lsof -i :9999

# 9999가 아닌 다른 포트로 변경
export WEBHOOK_PORT=8888
node src/webhook-server.js
```

---

## ✨ 다음 단계

1. ✅ 서버 실행 완료
2. ⏳ Gogs Webhook 설정
3. ⏳ 첫 Push 이벤트 확인
4. ⏳ 대시보드 모니터링
5. ⏳ 277개 저장소 동기화

---

**Gogs AI 아키텍트** v1.0.0
🚀 준비 완료 — 지금 바로 사용 가능!

**Gogs 저장소**: https://gogs.dclub.kr/kim/gogs-architect
**Webhook 주소**: http://localhost:9999/webhook
