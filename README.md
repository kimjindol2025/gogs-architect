# Gogs AI 아키텍트 시스템

Gogs 저장소(277개, 8500+줄 커밋 기록)를 살아있는 AI 지식 베이스로 변환하는 시스템.

## 구조

```
├── src/
│   ├── gogs-client.js       # Gogs REST API 래퍼
│   ├── knowledge-base.js    # JSON 기반 지식 베이스
│   ├── scraper.js           # 파일 수집기
│   ├── parser.js            # 다중언어 파서
│   ├── cli.js               # CLI 인터페이스
│   └── ...
├── examples/
│   └── *.pf                 # PyFree 포팅 예제
└── README.md
```

## 20단계 로드맵

### Phase 1: 데이터 기초 공사
- Step 1: Gogs API 클라이언트
- Step 2: 저장소 스캔 & 파일 수집
- Step 3: 다중언어 코드 파서
- Step 4: 커밋 로그 + ADR 파서
- Step 5: SQLite 지식 베이스 + 인덱싱

### Phase 2: 지능 및 페르소나 주입
- Step 6: 로컬 임베딩 엔진 (BM25)
- Step 7: RAG 검색 엔진
- Step 8: 수석 아키텍트 페르소나
- Step 9: Claude API 연동

### Phase 3: 인터페이스 및 자동화
- Step 10: Termux CLI 에이전트
- Step 11: Webhook 수신 서버
- Step 12: 자동 코드 리뷰어
- Step 13: 이슈 자동 생성기

### Phase 4: 자율 진화
- Step 14-17: AI 팀 라우터, 문서 엔진, 선제적 제안, 대시보드

### Phase 5: 완성 및 자기 호스팅
- Step 18-20: 통합 테스트, systemd 서비스, PyFree 자기 호스팅

## 기술 스택

- **Node.js**: npm zero-dependency (표준 라이브러리만)
- **Claude API**: 지능형 분석
- **PyFree**: 자기 호스팅 (Stage 5)

## 실행

```bash
# CLI 에이전트
node src/cli.js ask "다음 단계는?"

# Webhook 서버
node src/webhook-server.js

# 자동 검토기
node src/reviewer.js
```

## 상태

🏗️ Phase 1 구현 중 (Step 1-5)

---

**Created**: 2026-03-12
**Repository**: https://gogs.dclub.kr/kim/gogs-architect
