#!/bin/bash

# GOGS Architect - 배포 스크립트
# 사용: ./deploy.sh [production|staging]

set -e  # 에러 발생 시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_header() {
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 환경 설정
ENVIRONMENT=${1:-production}
DEPLOY_DIR="/opt/gogs-architect"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 환경 변수 검증
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    print_error ".env 파일이 없습니다"
    print_info "다음 명령어를 실행하세요: cp .env.example .env"
    exit 1
fi

# 배포 시작
print_header "🚀 GOGS Architect 배포 - $ENVIRONMENT"

# 1. 저장소 최신화
print_header "단계 1: 저장소 최신화"
cd "$SCRIPT_DIR"

if [ -d .git ]; then
    print_info "git pull 실행 중..."
    git pull origin master 2>/dev/null || print_warning "git pull 실패 (로컬 저장소일 수 있음)"
else
    print_info "Git 저장소 아님 (로컬 테스트 모드)"
fi

print_success "저장소 최신화 완료"

# 2. 의존성 설치
print_header "단계 2: Node.js 의존성 설치"
print_info "npm install 실행 중..."

if command -v npm &> /dev/null; then
    npm install --production 2>&1 | tail -5
    print_success "의존성 설치 완료"
else
    print_error "npm이 설치되지 않았습니다"
    exit 1
fi

# 3. 환경 변수 로드
print_header "단계 3: 환경 변수 검증"
source .env

print_info "환경: $ENVIRONMENT"
print_info "GOGS URL: $GOGS_BASE_URL"
print_info "포트: $PORT"

# 4. 디렉토리 생성
print_header "단계 4: 디렉토리 생성"
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/data"
mkdir -p "$SCRIPT_DIR/cache"
print_success "디렉토리 생성 완료"

# 5. 권한 설정
print_header "단계 5: 파일 권한 설정"
chmod +x src/*.js
chmod 644 logs/* 2>/dev/null || true
chmod 644 data/* 2>/dev/null || true
print_success "권한 설정 완료"

# 6. 기존 프로세스 종료
print_header "단계 6: 기존 프로세스 관리"

if command -v pm2 &> /dev/null; then
    print_info "PM2 프로세스 확인 중..."

    if pm2 list | grep -q "gogs-architect-api"; then
        print_info "기존 프로세스 종료 중..."
        pm2 delete gogs-architect-api 2>/dev/null || true
        sleep 2
    fi

    print_success "프로세스 정리 완료"
else
    print_warning "PM2가 설치되지 않았습니다 (npm install -g pm2 권장)"
fi

# 7. 새 프로세스 시작 (PM2)
print_header "단계 7: 프로세스 시작"

if command -v pm2 &> /dev/null; then
    print_info "PM2로 프로세스 시작 중..."

    if [ "$ENVIRONMENT" = "staging" ]; then
        pm2 start ecosystem.config.js --env staging --name gogs-architect-api
    else
        pm2 start ecosystem.config.js --env production --name gogs-architect-api
    fi

    sleep 2
    pm2 save
    print_success "프로세스 시작 완료"

    # 상태 확인
    print_header "프로세스 상태"
    pm2 status
else
    # PM2 없이 직접 실행 (개발/테스트용)
    print_warning "PM2 없이 직접 실행합니다 (프로덕션에서는 권장하지 않음)"
    NODE_ENV=$ENVIRONMENT PORT=$PORT npm start &
fi

# 8. 헬스 체크
print_header "단계 8: 헬스 체크"
sleep 3

if command -v curl &> /dev/null; then
    print_info "API 헬스 체크 실행 중..."

    for i in {1..10}; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-3000}/health)

        if [ "$HTTP_CODE" = "200" ]; then
            print_success "API 정상 작동 ✓"
            print_info "대시보드: http://localhost:${PORT:-3000}/dashboard"
            print_info "API 문서: http://localhost:${PORT:-3000}/"
            break
        else
            print_warning "API 응답 대기 중... ($i/10)"
            sleep 1
        fi
    done

    if [ "$HTTP_CODE" != "200" ]; then
        print_error "API가 응답하지 않습니다"
        print_info "로그 확인: tail -f logs/api-error.log"
        exit 1
    fi
else
    print_warning "curl이 없어 헬스 체크를 건너뜁니다"
fi

# 9. Nginx 설정 (선택)
print_header "단계 9: Nginx 설정 (선택)"

if command -v nginx &> /dev/null; then
    print_info "Nginx 설정 검사 중..."

    if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
        # Nginx 설정 복사 (수동이 좋음)
        print_info "다음 명령어를 실행하세요:"
        echo "  sudo cp $SCRIPT_DIR/nginx.conf /etc/nginx/sites-available/architect.gogs.dclub.kr"
        echo "  sudo ln -sf /etc/nginx/sites-available/architect.gogs.dclub.kr /etc/nginx/sites-enabled/"
        echo "  sudo nginx -t"
        echo "  sudo systemctl reload nginx"
    fi
else
    print_warning "Nginx가 설치되지 않았습니다"
fi

# 10. GOGS 웹훅 자동 설정 (선택)
print_header "단계 10: GOGS 웹훅 자동 설정 (선택)"

if [ -n "$GOGS_API_TOKEN" ] && [ -n "$GOGS_USERNAME" ]; then
    print_info "다음 명령어로 GOGS 저장소 웹훅을 자동 설정할 수 있습니다:"
    echo "  node scripts/setup-gogs-webhooks.js"
else
    print_warning "GOGS_API_TOKEN과 GOGS_USERNAME을 .env에서 설정하세요"
fi

# 최종 요약
print_header "배포 완료! 🎉"
echo -e "${GREEN}"
echo "상태:"
echo "  - API 서버: http://localhost:${PORT:-3000}"
echo "  - 대시보드: http://localhost:${PORT:-3000}/dashboard"
echo "  - API 문서: http://localhost:${PORT:-3000}/"
echo ""
echo "로그:"
echo "  - 에러: tail -f logs/api-error.log"
echo "  - 출력: tail -f logs/api-out.log"
echo ""
echo "다음 단계:"
echo "  1. Nginx 리버스 프록시 설정"
echo "  2. SSL 인증서 설정 (Let's Encrypt)"
echo "  3. GOGS 웹훅 자동 설정"
echo "  4. 모니터링 및 알림 설정"
echo -e "${NC}"

print_success "배포 완료!"
