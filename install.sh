#!/bin/bash

# Gogs AI 아키텍트 설치 스크립트
# 사용법: sudo bash install.sh

set -e

echo "🚀 Gogs AI 아키텍트 설치"
echo "=========================="

# 권한 확인
if [[ $EUID -ne 0 ]]; then
   echo "❌ 이 스크립트는 root 권한으로 실행해야 합니다."
   echo "사용법: sudo bash install.sh"
   exit 1
fi

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    exit 1
fi

echo "✓ Node.js: $(node --version)"

# systemd 서비스 설치
echo ""
echo "📦 systemd 서비스 설치"

SERVICE_FILE="/etc/systemd/system/gogs-architect.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 서비스 파일 복사
cp "$SCRIPT_DIR/gogs-architect.service" "$SERVICE_FILE"

# 경로 수정
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$SCRIPT_DIR|g" "$SERVICE_FILE"

echo "✓ 서비스 파일: $SERVICE_FILE"

# systemd 리로드
systemctl daemon-reload

echo "✓ systemd 리로드 완료"

# 자동 시작 설정
systemctl enable gogs-architect.service

echo "✓ 자동 시작 설정 완료"

# 환경 변수 검증
echo ""
echo "🔐 환경 변수 확인"

if grep -q "GOGS_TOKEN=7a79f8643f22a401e898780e0780c3ec0a93e674" "$SERVICE_FILE"; then
    echo "✓ GOGS_TOKEN 설정됨"
else
    echo "⚠️  GOGS_TOKEN을 설정하세요: $SERVICE_FILE"
fi

# 설치 완료
echo ""
echo "✅ 설치 완료!"
echo ""
echo "🎯 다음 단계:"
echo "  - 시작: sudo systemctl start gogs-architect"
echo "  - 상태: sudo systemctl status gogs-architect"
echo "  - 로그: journalctl -u gogs-architect -f"
echo "  - 중지: sudo systemctl stop gogs-architect"
echo ""
