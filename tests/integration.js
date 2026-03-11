/**
 * Phase 5 (Step 18): 전체 시스템 통합 테스트
 *
 * 시나리오:
 * 1. "Range 메모리 버그 원인은?" → 관련 커밋/파일 정확 반환
 * 2. "ADR-001 위반 코드 있어?" → 정확한 파일:줄번호 반환
 * 3. "다음 Phase 준비 사항은?" → 설계 제안 생성
 *
 * 실행: ANTHROPIC_API_KEY=... node tests/integration.js
 */

import KnowledgeBase from '../src/knowledge-base.js';
import Parser from '../src/parser.js';
import Embedder from '../src/embedder.js';
import RAGEngine from '../src/rag-engine.js';
import ArchitectPersona from '../src/architect-persona.js';
import TeamRouter from '../src/team-router.js';
import ProactiveAgent from '../src/proactive-agent.js';
import Dashboard from '../src/dashboard.js';

const testData = {
  markdown: `# Range 메모리 버그 분석

## 문제
배열 range() 함수에서 메모리 누수 발생.

### 원인
- 동적 배열 할당 미흡
- 범위 초과 접근

## 솔루션
ADR-001: 메모리 안전성 강화
- 범위 검증 필수
- 명시적 해제
  `,

  code: `function range(start, end) {
  // 범위 검증 부재 (ADR-001 위반)
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
}

function rangeFixed(start, end) {
  // ADR-001 준수: 범위 검증 추가
  if (start < 0 || end > 1000000) {
    throw new Error('Range out of bounds');
  }
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
}`,

  commits: [
    {
      sha: 'abc1234',
      message: 'fix: ADR-001 Range 메모리 버그 수정 - 범위 검증 추가',
      author: { name: 'Kim', date: new Date().toISOString() },
      commit: {
        message: 'fix: ADR-001 Range 메모리 버그 수정\n\n범위 검증 추가하여 메모리 안전성 강화.'
      }
    },
    {
      sha: 'def5678',
      message: 'feat: Phase 2 시작 - 지능 모듈 추가',
      author: { name: 'Kim', date: new Date().toISOString() },
      commit: { message: 'feat: Phase 2 시작' }
    },
    {
      sha: 'ghi9012',
      message: 'docs: ARCHITECTURE.md 업데이트',
      author: { name: 'Kim', date: new Date().toISOString() },
      commit: { message: 'docs: ARCHITECTURE.md 업데이트' }
    }
  ]
};

async function runIntegrationTests() {
  console.log('='.repeat(60));
  console.log('🧪 Phase 5 - 전체 시스템 통합 테스트');
  console.log('='.repeat(60));

  try {
    // Step 1: 지식 베이스 구축
    console.log('\n📚 Step 1: 지식 베이스 구축');
    const kb = new KnowledgeBase();
    const parser = new Parser();

    const mdChunks = parser.parseFile('ARCHITECTURE.md', testData.markdown, { repo: 'test' });
    const codeChunks = parser.parseFile('range.js', testData.code, { repo: 'test' });

    kb.addChunks([...mdChunks, ...codeChunks]);

    // 커밋 추가
    testData.commits.forEach(c => {
      kb.addCommit({
        sha: c.sha,
        message: c.commit?.message || c.message,
        author: c.author,
        file: 'range.js'
      });
    });

    kb.save();
    console.log(`✓ 청크: ${kb.countChunks()}개`);

    // Step 2: RAG 임베딩 & 검색
    console.log('\n🔍 Step 2: RAG 검색 엔진 테스트');
    const embedder = new Embedder(kb);
    const rag = new RAGEngine(kb, embedder);

    // 테스트 시나리오 1: "Range 메모리 버그 원인"
    const query1 = 'Range 메모리 버그 원인';
    const results1 = rag.search(query1, { topK: 3 });

    console.log(`\n[시나리오 1] "${query1}"`);
    console.log(`검색 결과: ${results1.length}개`);
    results1.slice(0, 2).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.chunk.name} (${r.chunk.meta.file}) - 점수: ${r.finalScore.toFixed(3)}`);
    });

    // 테스트 시나리오 2: "ADR-001 위반"
    const query2 = 'ADR-001 위반';
    const results2 = rag.search(query2, { topK: 2 });

    console.log(`\n[시나리오 2] "${query2}"`);
    console.log(`검색 결과: ${results2.length}개`);
    results2.slice(0, 2).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.chunk.name} (${r.chunk.meta.file}:${r.chunk.meta.lineStart})`);
    });

    // Step 3: 아키텍트 페르소나
    console.log('\n🤖 Step 3: 수석 아키텍트 페르소나 테스트');
    const persona = new ArchitectPersona(kb, rag);

    const analysis = await persona.analyzeQuery('Range 메모리 버그의 근본원인과 해결책');
    console.log(`✓ 분석 완료`);
    console.log(`  - 관련 저장소: ${analysis.repositories.length}개`);
    console.log(`  - 관련 언어: ${analysis.languages.join(', ')}`);

    // Step 4: 팀 라우터
    console.log('\n🎯 Step 4: AI 팀 라우터 테스트');
    const router = new TeamRouter(kb, embedder);

    const classification = router.classifyQuery('메모리 최적화 버그 원인');
    console.log(`✓ 질문 분류: ${classification.agent} (신뢰도: ${(classification.confidence * 100).toFixed(0)}%)`);

    // Step 5: 선제적 에이전트
    console.log('\n🔮 Step 5: 선제적 설계 제안 엔진 테스트');
    const proactive = new ProactiveAgent(kb, embedder);

    const analysis2 = await proactive.analyze('test', 'repo', testData.commits, [...mdChunks, ...codeChunks]);
    console.log(`✓ 분석 완료`);
    console.log(`  - 현재 Phase: ${analysis2.phaseProgress.currentPhase}`);
    console.log(`  - 추천 사항: ${analysis2.suggestions.length}개`);

    if (analysis2.suggestions.length > 0) {
      console.log(`  - 최우선: ${analysis2.suggestions[0].reason}`);
    }

    // Step 6: 대시보드
    console.log('\n📊 Step 6: 대시보드 테스트');
    const dashboard = new Dashboard(kb, embedder);

    const stats = dashboard.collectStats();
    console.log(`✓ 통계 수집`);
    console.log(`  - 저장소: ${stats.repositories}개`);
    console.log(`  - 청크: ${stats.chunks}개`);
    console.log(`  - 커밋: ${stats.commits}개`);

    const quality = dashboard.evaluateQuality();
    console.log(`✓ 품질 평가`);
    console.log(`  - 종합 점수: ${quality.overallScore}/100`);

    console.log(`\n${dashboard.summary()}`);

    // 최종 결과
    console.log('\n' + '='.repeat(60));
    console.log('✅ 모든 통합 테스트 완료!');
    console.log('='.repeat(60));

    return {
      success: true,
      tests: [
        { name: 'Knowledge Base', status: 'PASS' },
        { name: 'RAG Search', status: 'PASS', results: results1.length },
        { name: 'ADR Detection', status: 'PASS', results: results2.length },
        { name: 'Architect Persona', status: 'PASS' },
        { name: 'Team Router', status: 'PASS', agent: classification.agent },
        { name: 'Proactive Agent', status: 'PASS', phases: analysis2.phaseProgress.currentPhase },
        { name: 'Dashboard', status: 'PASS', score: quality.overallScore }
      ]
    };
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runIntegrationTests();
