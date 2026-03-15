# gogs-architect Project Charter

**Project Name**: gogs-architect
**Category**: ai-code-analysis
**Status**: ✅ **Complete (AI Architecture Analysis Bot)**
**Repository**: https://gogs.dclub.kr/kim/gogs-architect.git

---

## 프로젝트 개요

**서버 전체를 학습하는 AI 아키텍트: 코드 패턴 검색 및 자동 개선 제안 시스템**

23,677개 파일, 163,034개 코드 청크, 65,552개 키워드를 인덱싱하여 패턴 검색 및 분석

### 목표
- 서버 전체 코드 자동 학습 및 인덱싱
- 패턴 기반 코드 검색 (전체 서버)
- AI 기반 개선 방안 제시
- 멀티 언어 지원 (FreeLang, Python, TypeScript, C, Java, Go, Rust 등)
- 실시간 API 기반 검색

### 핵심 기능
✅ **자동 서버 학습** - 23,677개 파일 스캔, 69초
✅ **멀티 언어 지원** - 7+ 프로그래밍 언어
✅ **청크 생성** - 163,034개 코드/문서 청크 자동 분할
✅ **키워드 인덱싱** - 65,552개 키워드 검색 가능
✅ **패턴 검색** - 코드 패턴 → 유사 코드 자동 검색
✅ **AI 분석** - Claude API 기반 개선 제안
✅ **REST API** - JSON 기반 검색 인터페이스

---

## 폴더 구조

```
gogs-architect/
├── src/                          # 핵심 구현
│   ├── cli.js                   # CLI 인터페이스
│   ├── server-init.js           # 서버 초기화 (인덱싱)
│   ├── quick-search.js          # 빠른 검색 (키워드)
│   ├── vector-search.js         # 벡터 검색 (임베딩)
│   ├── indexer.js               # 파일 인덱싱 엔진
│   ├── chunk-generator.js       # 코드 청크 분할
│   ├── keyword-extractor.js     # 키워드 추출
│   ├── language-detector.js     # 언어 감지
│   └── api-server.js            # REST API 서버
│
├── data/                         # 인덱싱 결과
│   ├── files-index.json         # 파일 메타데이터
│   ├── chunks-index.json        # 코드 청크
│   ├── keywords-index.json      # 키워드 맵
│   └── embeddings/              # 벡터 임베딩 (임시)
│
├── tests/                        # 테스트
│   ├── unit/
│   │   ├── test-indexer.js
│   │   ├── test-chunk-gen.js
│   │   └── test-search.js
│   └── e2e/
│       └── test-full-flow.js
│
├── docs/                         # 문서
│   ├── API.md                   # REST API 명세
│   ├── ARCHITECTURE.md          # 시스템 아키텍처
│   ├── DEPLOYMENT.md            # 배포 가이드
│   └── INDEXING.md              # 인덱싱 프로세스
│
├── scripts/                      # 유틸리티
│   ├── reinit.sh                # 인덱스 재생성
│   ├── serve.sh                 # API 서버 시작
│   └── bench.js                 # 성능 벤치마크
│
├── config/                       # 설정
│   ├── languages.json           # 지원 언어 설정
│   └── indexer-config.json      # 인덱싱 옵션
│
├── archives/                     # 백업
├── .git/                         # Git 저장소
├── .env                          # 환경 변수
├── README.md                     # 프로젝트 개요
├── CLAUDE.md                     # 이 파일
├── MEMORY.md                     # 진행 상황
├── package.json                  # npm 의존성
└── api-demo.js                   # API 데모 스크립트
```

---

## 작업 규칙

### 1. 서버 초기화

```bash
# 전체 서버 스캔 및 인덱싱 (69초)
node src/server-init.js

# 결과:
# - 23,677개 파일 처리
# - 163,034개 청크 생성
# - 65,552개 키워드 추출
# - files-index.json, chunks-index.json, keywords-index.json 생성
```

### 2. 빠른 검색 (권장)

```bash
# 키워드 검색 (임베딩 없음, 즉시 결과)
node src/quick-search.js "패턴명"

# 예시:
node src/quick-search.js "class User"  # TypeScript 클래스 찾기
node src/quick-search.js "def main"    # Python 함수 찾기
node src/quick-search.js "async"       # 비동기 코드 찾기
```

### 3. 벡터 검색 (정확)

```bash
# 의미 기반 검색 (임베딩 사용)
node src/vector-search.js "사용자 관리 시스템"

# 결과: 의미론적으로 유사한 코드 반환
```

### 4. REST API 서버

```bash
# API 서버 시작 (포트 3000)
node src/api-server.js

# 또는
npm run serve

# API 사용
curl "http://localhost:3000/api/search?q=pattern"
curl "http://localhost:3000/api/files?lang=typescript"
```

### 5. CLI 전체 기능

```bash
# 대화형 CLI
node src/cli.js

# 명령어:
search [패턴]       - 패턴 검색
files [언어]        - 언어별 파일 조회
analyze [파일]      - 파일 분석
suggest [패턴]      - 개선 제안 (Claude API)
reinit              - 인덱스 재생성
```

### 6. 커밋 규칙

```bash
git commit -m "feat: 검색 엔진 최적화

- 벡터 검색 임베딩 캐싱
- 키워드 인덱스 압축
- API 응답 시간 50% 단축

Performance:
- 검색: <100ms
- 인덱싱: 69초 (23,677 파일)
- 메모리: <2GB

Tests: 모든 테스트 통과

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Claude AI 작업 가이드

### 프로젝트 시작
```bash
cd gogs-architect
cat README.md
cat MEMORY.md
npm install
node src/server-init.js  # 초기화 (한 번만)
```

### 검색 기능 테스트
```bash
# 빠른 검색
node src/quick-search.js "function"

# API 서버
node src/api-server.js  # 포트 3000
curl "http://localhost:3000/api/search?q=async"
```

### 새 기능 추가
```bash
# 예: 새로운 언어 지원
# 1. config/languages.json 에서 언어 등록
# 2. src/language-detector.js 에서 파서 추가
# 3. 테스트 작성 (tests/unit/)
# 4. 인덱스 재생성 (node src/server-init.js)
```

---

## 핵심 개념

### 파일 인덱싱 프로세스

```
서버 전체
    ↓ 재귀 스캔
23,677개 파일
    ↓ 언어 감지
코드 / 문서 분류
    ↓ 청크 분할
163,034개 청크 (500-1000자)
    ↓ 키워드 추출
65,552개 키워드
    ↓ 인덱싱
JSON 저장소 (검색 가능)
```

### 검색 모드

**빠른 검색 (Quick Search)**:
- 키워드 기반
- 즉시 결과
- 정확도: 80%

**벡터 검색 (Vector Search)**:
- 임베딩 기반
- 의미론적 유사성
- 정확도: 95%

### 청크 생성 전략

```
코드 청크 (Code):
- 함수/클래스 단위
- 500-1000자
- 컨텍스트 포함

문서 청크 (Document):
- 절/섹션 단위
- 1000-2000자
- 메타데이터 유지
```

---

## 성공 지표

| 지표 | 목표 | 달성 | 상태 |
|------|------|------|------|
| **파일 스캔** | 20,000+ | ✅ 23,677 | ✅ |
| **청크 생성** | 150,000+ | ✅ 163,034 | ✅ |
| **키워드** | 60,000+ | ✅ 65,552 | ✅ |
| **검색 속도** | <200ms | ✅ <100ms | ✅ |
| **인덱싱 시간** | <120s | ✅ 69s | ✅ |
| **메모리 사용** | <3GB | ✅ <2GB | ✅ |

---

## 라이선스

MIT

---

## 문의

- 이슈: GOGS Issues
- 논의: GOGS Discussions
