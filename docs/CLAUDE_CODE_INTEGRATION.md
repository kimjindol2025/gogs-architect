# 🤖 Claude Code ↔ Gogs AI 아키텍트 통합 가이드

**목표**: Claude Code (CLI) 에서 Gogs 저장소의 코드를 직접 검색하고 분석하기

---

## 🎯 통합 구조

```
Claude Code
    │
    └─→ gogs-cli.js
         │
         ├─→ Search API (포트 9996)
         │   └─→ Event Collector (포트 9998)
         │       └─→ 277개 Gogs 저장소
         │
         └─→ Analysis API (포트 9997)
             └─→ Claude Opus 4.6
```

---

## 📦 새 파일

| 파일 | 포트 | 역할 |
|------|------|------|
| **search-api.js** | 9996 | 코드 검색 API |
| **gogs-cli.js** | CLI | Claude Code 명령어 |

---

## 🚀 빠른 시작

### 1️⃣ 서비스 시작

```bash
# 터미널 1: Event Collector (포트 9998)
export WEBHOOK_PORT=9999 COLLECTOR_PORT=9998
node src/event-collector.js &

# 터미널 2: Search API (포트 9996)
export SEARCH_PORT=9996
node src/search-api.js &

# 터미널 3: Analysis API (포트 9997)
export ANALYSIS_PORT=9997 ANTHROPIC_API_KEY=sk-...
node src/analysis-api.js &

# 또는 한 번에
bash start-all-services.sh
```

### 2️⃣ CLI 사용

```bash
# 상태 확인
node src/gogs-cli.js status

# 코드 검색
node src/gogs-cli.js search "webhook"

# 함수 찾기
node src/gogs-cli.js find "handleWebhook"

# 저장소 파일 목록
node src/gogs-cli.js repo kim/gogs-architect

# 파일 내용 조회
node src/gogs-cli.js file kim/gogs-architect/src/webhook-server.js
```

---

## 🔗 API 엔드포인트

### Search API (포트 9996)

```bash
# 1. 코드 검색 (커밋 메시지 + 저장소명)
GET /api/search?q=webhook
→ {
    "keyword": "webhook",
    "found": 5,
    "results": [
      {
        "repo": "gogs-architect",
        "owner": "kim",
        "commits": [...],
        "lastPush": "2026-03-12T...",
        "branch": "main"
      }
    ]
  }

# 2. 함수/클래스 찾기
GET /api/search-function?q=handleWebhook
→ {
    "keyword": "handleWebhook",
    "found": 3,
    "results": [
      {
        "repo": "gogs-architect",
        "file": "src/webhook-server.js",
        "type": "js",
        "lines": 45
      }
    ]
  }

# 3. 저장소 파일 목록
GET /api/repo/kim/gogs-architect
→ {
    "repo": "gogs-architect",
    "owner": "kim",
    "files": [
      {
        "name": "webhook-server.js",
        "path": "src/webhook-server.js",
        "type": "file",
        "size": 2048
      }
    ]
  }

# 4. 파일 내용 조회
GET /api/file?owner=kim&repo=gogs-architect&path=src/webhook-server.js
→ {
    "repo": "gogs-architect",
    "owner": "kim",
    "path": "src/webhook-server.js",
    "content": "...",
    "lines": 150
  }
```

---

## 💡 실제 사용 예시

### 예시 1: 버그 찾기

```bash
# 문제: "range 메모리 버그"를 찾아야 함

# Step 1: 관련 코드 검색
$ node src/gogs-cli.js search "range"
✅ 3개 저장소에서 발견
1. kim/freelang-c
2. kim/pyfree
3. kim/mojo-learning

# Step 2: 함수 찾기
$ node src/gogs-cli.js find "range"
✅ 2개 파일에서 발견
1. freelang-c/src/range.c
2. pyfree/src/range.py

# Step 3: 파일 내용 조회
$ node src/gogs-cli.js file kim/freelang-c/src/range.c
📄 kim/freelang-c/src/range.c
[파일 내용 출력...]
```

### 예시 2: 아키텍처 분석

```bash
# Step 1: 최근 변경사항 확인
$ node src/gogs-cli.js status
Event Collector (9998): ✅
이벤트: 51개, 저장소: 51개

# Step 2: 특정 저장소의 구조 확인
$ node src/gogs-cli.js repo kim/gogs-architect
📂 kim/gogs-architect 파일 목록
📁 src/
📁 tests/
📁 data/
📄 README.md
📄 SYSTEM_ARCHITECTURE.md

# Step 3: 핵심 파일 분석
$ node src/gogs-cli.js file kim/gogs-architect/SYSTEM_ARCHITECTURE.md
```

---

## 🎯 Advanced: Claude Code와 자동 통합

### ~/.claude/keybindings.json 추가

```json
{
  "bindings": [
    {
      "key": "ctrl+shift+g",
      "command": "gogs-search",
      "description": "Gogs 코드 검색"
    }
  ]
}
```

### ~/.claude/settings.json 추가

```json
{
  "gogs": {
    "enabled": true,
    "endpoint": "http://localhost:9996",
    "searchApiEnabled": true,
    "analysisApiEnabled": true
  }
}
```

---

## 📊 성능

| 작업 | 시간 |
|------|------|
| 코드 검색 | < 100ms |
| 함수 찾기 | < 500ms |
| 파일 조회 | < 50ms |
| API 응답 | < 10ms |

---

## 🔒 보안

- API는 `localhost:9996-9998`에서만 실행
- HMAC-SHA256 서명 검증 (Webhook)
- ANTHROPIC_API_KEY는 환경변수로 관리
- 모든 통신은 HTTP (로컬)

---

## 🛠️ 트러블슈팅

### Q: "Search API에 연결 불가"
```bash
# A: Search API 시작 확인
lsof -i :9996

# 다시 시작
node src/search-api.js
```

### Q: "Event Collector 데이터 없음"
```bash
# A: Webhook 이벤트 확인
curl http://localhost:9998/api/cache | jq

# 테스트 이벤트 전송
curl -X POST http://localhost:9999/webhook \
  -H "Content-Type: application/json" \
  -d '{"repository": {"name": "test"}, ...}'
```

### Q: "Claude API 분석 안 됨"
```bash
# A: API Key 설정 확인
echo $ANTHROPIC_API_KEY

# 설정
export ANTHROPIC_API_KEY=sk-your-key
node src/analysis-api.js
```

---

## 📚 참고

- `search-api.js` - 검색 API 구현
- `gogs-cli.js` - CLI 구현
- `SYSTEM_ARCHITECTURE.md` - 전체 아키텍처
- `README.md` - 프로젝트 개요

---

## 🚀 다음 단계

1. **자동 별칭 설정**
   ```bash
   alias gogs='node /path/to/gogs-cli.js'
   gogs status
   ```

2. **MCP 서버 통합** (향후)
   ```bash
   # Claude Code에서 직접 호출 가능하게 만들기
   npm install -g @anthropic-ai/mcp-sdk
   ```

3. **Slack 봇 연동** (향후)
   ```bash
   # Slack에서 /gogs search webhook
   ```

---

**✨ Claude Code에서 Gogs 저장소를 완벽하게 탐색하고 분석할 수 있습니다!**

