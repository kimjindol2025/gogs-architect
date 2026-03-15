#!/bin/bash
# FreeLang File Manager Server Launcher

killall -9 freelang 2>/dev/null

echo "╔════════════════════════════════════════════════════════╗"
echo "║  🚀 FreeLang File Manager Server                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "서버 시작 중..."
echo ""

freelang /home/kimjin/gogs-architect/src/web-server.free

echo ""
echo "서버 종료됨"
