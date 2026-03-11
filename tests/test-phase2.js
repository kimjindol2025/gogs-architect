/**
 * Phase 2 (Step 6-9) 통합 테스트
 *
 * 실행: ANTHROPIC_API_KEY=... node tests/test-phase2.js
 */

import KnowledgeBase from '../src/knowledge-base.js';
import Parser from '../src/parser.js';
import Embedder from '../src/embedder.js';
import RAGEngine from '../src/rag-engine.js';
import ArchitectPersona from '../src/architect-persona.js';

const testMarkdown = `# Architecture

## Phase 1: Foundation

구조를 설계합니다.

### Step 1: API 클라이언트

REST API 래퍼를 작성합니다.

### Step 2: File Scraper

저장소를 스캔합니다.

## Phase 2: Intelligence

지능을 주입합니다.`;

const testCode = `def tokenize(text):
    """문자열을 토큰으로 분해"""
    tokens = []
    for char in text:
        if char == ' ':
            tokens.append(char)
    return tokens

def analyze(text):
    """텍스트 분석"""
    tokens = tokenize(text)
    return len(tokens)`;

async function runTests() {
  console.log('=== Phase 2 (Step 6-9) 통합 테스트 ===\n');

  try {
    // Step 1: 지식 베이스 생성
    console.log('Step 1: 지식 베이스 구축');
    const kb = new KnowledgeBase();

    const parser = new Parser();
    const mdChunks = parser.parseFile('README.md', testMarkdown, { repo: 'test' });
    const codeChunks = parser.parseFile('test.py', testCode, { repo: 'test' });

    kb.addChunks([...mdChunks, ...codeChunks]);
    kb.save();

    console.log(`  ✓ 청크: ${kb.countChunks()}개`);
    console.log();

    // Step 2: BM25 임베딩
    console.log('Step 2: BM25 임베딩 엔진');
    const embedder = new Embedder(kb);
    const stats = embedder.getStatistics();

    console.log(`  ✓ 어휘: ${stats.vocabularySize}개`);
    console.log(`  ✓ 문서: ${stats.documentCount}개`);
    console.log();

    // Step 3: RAG 검색
    console.log('Step 3: RAG 검색 엔진');
    const rag = new RAGEngine(kb, embedder);

    const results = rag.search('architecture api', { topK: 3 });
    console.log(`  ✓ 검색 결과: ${results.length}개`);

    results.forEach((r, idx) => {
      console.log(`    [${idx + 1}] ${r.chunk.name} (점수: ${r.finalScore.toFixed(3)})`);
    });
    console.log();

    // Step 4: 페르소나
    console.log('Step 4: 수석 아키텍트 페르소나');
    const persona = new ArchitectPersona(kb, rag);

    const analysis = await persona.analyzeQuery('API implementation');
    console.log(`  ✓ 분석 완료`);
    console.log(`  ✓ 관련 저장소: ${analysis.repositories.length}개`);
    console.log(`  ✓ 관련 언어: ${analysis.languages.join(', ')}`);
    console.log();

    // Step 5: 설계 제안
    console.log('Step 5: 설계 제안');
    const suggestion = persona.generateDesignSuggestion(1);
    console.log(`  ✓ Phase 1: ${suggestion}`);
    console.log();

    console.log('=== 모든 테스트 완료 ✓ ===');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

runTests();
