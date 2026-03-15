# 🚀 Gogs AI Architect - API 설계서

**버전**: v1.0  
**상태**: Design Phase  
**생성일**: 2026-03-12

---

## 📋 목차

1. [개요](#개요)
2. [API 엔드포인트](#api-엔드포인트)
3. [인증](#인증)
4. [요청/응답 스키마](#요청응답-스키마)
5. [에러 처리](#에러-처리)
6. [Webhook 통합](#webhook-통합)
7. [구현 로드맵](#구현-로드맵)

---

## 개요

### 목적
FreeLang/Gogs 저장소의 코드를 자동으로 인덱싱하고, AI 기반 검색 및 분석을 제공하는 REST API.

### 핵심 기능
- **검색**: 코드 패턴 검색 → 사용처 + 호출 관계 + 최적화 제안
- **자동 인덱싱**: Webhook으로 새 저장소 자동 감지 및 인덱싱
- **에이전트**: 백그라운드 인덱싱 에이전트 상태 조회
- **분석**: 3단어 기반 AI 분석 및 대화

### 기술 스택
```
Node.js + Express (zero npm dependencies 유지)
또는 내장 http 모듈 사용
```

---

## API 엔드포인트

### 1️⃣ 검색 API

#### 1.1 기본 검색
```
POST /api/v1/search
```

**설명**: 코드 패턴 검색 및 AI 분석

**요청 본문**:
```json
{
  "query": "useState",
  "limit": 5,
  "includeCallGraph": true,
  "includeDependencies": true,
  "includeSuggestions": true
}
```

**응답**:
```json
{
  "status": "success",
  "query": "useState",
  "totalFound": 3,
  "duration": "12ms",
  "usages": [
    {
      "file": "components/App.jsx",
      "line": 12,
      "function": "App",
      "code": "const [count, setCount] = useState(0);",
      "repo": "freelang-v6"
    }
  ],
  "callRelations": {
    "App": {
      "calls": ["setCount"],
      "calledBy": ["main"]
    }
  },
  "dependencies": {
    "fileCount": 3,
    "files": ["components/App.jsx", "hooks/useCounter.js", "pages/Home.jsx"],
    "functionCount": 3,
    "functions": ["App", "useCounter", "Home"],
    "languages": ["React", "JavaScript"]
  },
  "suggestions": [
    {
      "type": "usage",
      "severity": "info",
      "message": "사용 빈도: 3곳 (적절함)",
      "recommendation": "현재 설계가 좋습니다."
    }
  ],
  "summary": "✅ 'useState' → 3곳 발견 (3개 파일, 3개 함수)"
}
```

**에러 응답**:
```json
{
  "status": "error",
  "code": "SEARCH_FAILED",
  "message": "검색 중 오류가 발생했습니다",
  "details": "..."
}
```

---

#### 1.2 3단어 분석 검색
```
POST /api/v1/search/three-words
```

**설명**: 3개 단어로 AI 기반 분석

**요청 본문**:
```json
{
  "words": ["sql", "parser", "aws"],
  "repositories": ["freelang-v6", "freelang-sql", "freelang-aws"]
}
```

**응답**:
```json
{
  "status": "success",
  "words": ["sql", "parser", "aws"],
  "results": [
    {
      "word": "sql",
      "found": true,
      "count": 15,
      "locations": [
        {
          "file": "freelang-sql/README.md",
          "line": 1,
          "snippet": "# FreeLang SQL - 자연어 SQL 컴파일러 + Z3 검증 시스템"
        }
      ]
    }
  ],
  "analysis": {
    "matchScore": 3,
    "rating": "⭐⭐⭐⭐⭐ 완벽 매칭",
    "insights": [
      "💾 SQL 기능: 자연어 SQL 컴파일, Z3 검증 시스템",
      "☁️  AWS 통합: CloudWatch, CloudTrail, AWS SDK",
      "🔧 컴파일러: Lexer → Parser → Compiler → VM 파이프라인"
    ]
  }
}
```

---

### 2️⃣ 자동 인덱서 API

#### 2.1 에이전트 상태 조회
```
GET /api/v1/agent/status
```

**응답**:
```json
{
  "status": "success",
  "agent": {
    "isIndexing": false,
    "queueSize": 5,
    "stats": {
      "totalIndexed": 42,
      "totalAdded": 15,
      "totalUpdated": 27,
      "lastIndexTime": "2026-03-12T14:30:00Z"
    },
    "nextActions": [
      {
        "name": "freelang-v6",
        "action": "update",
        "priority": "high"
      }
    ],
    "health": {
      "status": "🟢 정상",
      "nextScheduledSync": "2026-03-12T15:30:00Z"
    },
    "config": {
      "batchSize": 5,
      "maxQueueSize": 100,
      "scheduleInterval": 3600000
    }
  }
}
```

---

#### 2.2 저장소 수동 인덱싱
```
POST /api/v1/agent/index
```

**요청 본문**:
```json
{
  "repositoryId": "freelang-v6",
  "repositoryName": "kim/freelang-v6",
  "repositoryUrl": "https://gogs.dclub.kr/kim/freelang-v6.git",
  "action": "add",
  "priority": "high"
}
```

**응답**:
```json
{
  "status": "success",
  "message": "저장소가 인덱싱 큐에 추가되었습니다",
  "queuePosition": 3,
  "estimatedWaitTime": "2m 30s"
}
```

---

#### 2.3 인덱싱 진행 상황
```
GET /api/v1/agent/progress/:repositoryId
```

**응답**:
```json
{
  "status": "success",
  "repositoryId": "freelang-v6",
  "progress": {
    "status": "indexing",
    "filesProcessed": 45,
    "totalFiles": 86,
    "percentage": 52,
    "chunksCreated": 234,
    "startTime": "2026-03-12T14:15:00Z",
    "estimatedEndTime": "2026-03-12T14:35:00Z"
  }
}
```

---

### 3️⃣ 대화 API

#### 3.1 Q&A 대화
```
POST /api/v1/chat
```

**요청 본문**:
```json
{
  "question": "FreeLang의 주요 특징은?",
  "conversationId": "conv-123",
  "context": {
    "repositories": ["freelang-v6", "freelang-sql"],
    "maxResults": 5
  }
}
```

**응답**:
```json
{
  "status": "success",
  "conversationId": "conv-123",
  "question": "FreeLang의 주요 특징은?",
  "answer": {
    "summary": "FreeLang은 현대적 언어 설계, SQL 통합, AWS 클라우드 지원을 특징으로 합니다.",
    "details": [
      "✅ 문법 정확성 ⭐⭐⭐⭐⭐ (A+ 등급)",
      "✅ 자연어 SQL 컴파일러 (Z3 검증)",
      "✅ AWS 클라우드 통합",
      "✅ TypeScript 기반 안정적 구현"
    ],
    "sources": [
      {
        "file": "freelang-v6/LANGUAGE_SPECIFICATION_AUDIT.md",
        "line": 12,
        "snippet": "..."
      }
    ]
  },
  "relatedSearches": [
    "FreeLang의 타입 시스템",
    "FreeLang의 모듈 시스템",
    "FreeLang vs Python"
  ]
}
```

---

### 4️⃣ Webhook API

#### 4.1 GOGS Webhook 수신
```
POST /api/v1/webhook/gogs
```

**요청 본문** (GOGS 푸시 이벤트):
```json
{
  "action": "push",
  "repository": {
    "id": 123,
    "name": "freelang-v6",
    "full_name": "kim/freelang-v6",
    "clone_url": "https://gogs.dclub.kr/kim/freelang-v6.git",
    "owner": {
      "login": "kim"
    }
  },
  "commits": [
    {
      "id": "abc123...",
      "message": "feat: add SQL compiler",
      "timestamp": "2026-03-12T14:00:00Z"
    }
  ]
}
```

**응답**:
```json
{
  "status": "success",
  "message": "저장소가 인덱싱 큐에 추가되었습니다",
  "action": "update",
  "repositoryId": 123,
  "queuePosition": 1
}
```

---

### 5️⃣ 저장소 관리 API

#### 5.1 등록된 저장소 목록
```
GET /api/v1/repositories
```

**쿼리 파라미터**:
```
?limit=10&offset=0&status=indexed
```

**응답**:
```json
{
  "status": "success",
  "total": 3,
  "repositories": [
    {
      "id": "freelang-v6",
      "name": "FreeLang v6 (Core)",
      "url": "https://gogs.dclub.kr/kim/freelang-v6.git",
      "status": "indexed",
      "fileCount": 86,
      "chunkCount": 450,
      "lastIndexed": "2026-03-12T14:00:00Z",
      "language": "TypeScript"
    },
    {
      "id": "freelang-sql",
      "name": "FreeLang SQL",
      "url": "https://gogs.dclub.kr/kim/freelang-sql.git",
      "status": "indexed",
      "fileCount": 9,
      "chunkCount": 127,
      "lastIndexed": "2026-03-12T13:45:00Z",
      "language": "TypeScript"
    }
  ]
}
```

---

#### 5.2 저장소 상세 정보
```
GET /api/v1/repositories/:repositoryId
```

**응답**:
```json
{
  "status": "success",
  "repository": {
    "id": "freelang-v6",
    "name": "FreeLang v6",
    "stats": {
      "totalFiles": 86,
      "totalLines": 15000,
      "totalChunks": 450,
      "languages": {
        "TypeScript": 45,
        "JavaScript": 25,
        "Markdown": 16
      }
    },
    "indexingHistory": [
      {
        "timestamp": "2026-03-12T14:00:00Z",
        "action": "update",
        "filesProcessed": 12,
        "chunksCreated": 67
      }
    ]
  }
}
```

---

## 인증

### API Key 인증
```
Authorization: Bearer YOUR_API_KEY
```

### 구현 방식
```javascript
// 헤더 확인
if (!req.headers.authorization) {
  return res.status(401).json({
    status: "error",
    code: "UNAUTHORIZED",
    message: "Authorization 헤더 필요"
  });
}
```

---

## 요청/응답 스키마

### 공통 응답 구조
```json
{
  "status": "success|error",
  "code": "SUCCESS|ERROR_CODE",
  "message": "상태 메시지",
  "data": {},
  "timestamp": "2026-03-12T14:30:00Z",
  "requestId": "req-123-abc"
}
```

### 페이지네이션
```json
{
  "status": "success",
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasNext": true,
    "nextUrl": "/api/v1/results?limit=10&offset=10"
  },
  "data": [...]
}
```

---

## 에러 처리

### 에러 코드 정의

| 코드 | HTTP | 설명 |
|------|------|------|
| UNAUTHORIZED | 401 | 인증 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| VALIDATION_ERROR | 400 | 입력 검증 실패 |
| SEARCH_FAILED | 500 | 검색 실패 |
| INDEXING_ERROR | 500 | 인덱싱 실패 |
| RATE_LIMIT | 429 | 요청 초과 |

### 에러 응답 예시
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "입력값 검증 실패",
  "details": {
    "field": "query",
    "error": "query는 필수입니다"
  },
  "timestamp": "2026-03-12T14:30:00Z"
}
```

---

## Webhook 통합

### GOGS Webhook 설정

**URL**: `https://your-server/api/v1/webhook/gogs`

**이벤트**:
- ✅ Push
- ✅ Create (저장소 생성)
- ✅ Delete (저장소 삭제)

**보안**:
```
Secret: GOGS_WEBHOOK_SECRET
검증: HMAC-SHA256(payload, secret)
```

---

## 구현 로드맵

### Phase 1: 기본 API (1주)
- [ ] SearchEnhanced API
- [ ] 기본 에러 처리
- [ ] 문서화

### Phase 2: 에이전트 API (1주)
- [ ] AutoIndexer API
- [ ] Webhook 수신
- [ ] 상태 모니터링

### Phase 3: 고급 기능 (2주)
- [ ] 3단어 분석 API
- [ ] Q&A 대화 API
- [ ] 저장소 관리 API

### Phase 4: 프로덕션 (1주)
- [ ] 인증 (API Key)
- [ ] Rate Limiting
- [ ] 로깅 및 모니터링

---

## 코드 예시

### Express 구현 (간단)

```javascript
import express from 'express';
import SearchEnhanced from './search-enhanced.js';
import AutoIndexer from './auto-indexer.js';

const app = express();
const search = new SearchEnhanced(...);
const indexer = new AutoIndexer(...);

// POST /api/v1/search
app.post('/api/v1/search', (req, res) => {
  try {
    const { query } = req.body;
    const result = search.searchAdvanced(query);
    res.json({
      status: 'success',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// GET /api/v1/agent/status
app.get('/api/v1/agent/status', (req, res) => {
  const status = indexer.getStatus();
  const report = indexer.generateReport();
  res.json({
    status: 'success',
    agent: status,
    report: report
  });
});

// POST /api/v1/webhook/gogs
app.post('/api/v1/webhook/gogs', (req, res) => {
  try {
    indexer.handleWebhookEvent(req.body);
    res.json({
      status: 'success',
      message: '저장소가 인덱싱 큐에 추가되었습니다'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('API Server listening on :3000');
});
```

---

## 테스트 케이스

### 검색 API
```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "useState"}'
```

### 에이전트 상태
```bash
curl http://localhost:3000/api/v1/agent/status
```

### Webhook 시뮬레이션
```bash
curl -X POST http://localhost:3000/api/v1/webhook/gogs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "push",
    "repository": {
      "id": 123,
      "full_name": "kim/freelang-v6"
    }
  }'
```

---

**다음 단계**: API 서버 구현 시작
