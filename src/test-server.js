#!/usr/bin/env node

/**
 * 서버 기반 AI 봇 테스트
 *
 * 사용법:
 * node src/test-server.js
 */

import ServerIndexer from './server-indexer.js';
import RAGEngine from './rag-engine.js';
import ArchitectPersona from './architect-persona.js';

console.log('\n🚀 서버 기반 AI 분석 봇 시작\n');

// 1. 서버 인덱싱
console.log('📁 Step 1: 서버 인덱싱...\n');
const indexer = new ServerIndexer({
  rootPath: '/home/kimjin/Desktop/kim'
});

const result = indexer.indexServer();
const kb = indexer.kb;

console.log('\n✅ 인덱싱 완료!');
console.log(`   청크: ${result.chunks.length}개`);
console.log(`   언어: ${Object.keys(result.stats.byLanguage).join(', ')}\n`);

// 2. RAG 검색 테스트
console.log('🔍 Step 2: RAG 검색 테스트\n');

const queries = [
  'Python 프로젝트',
  'C 언어 코드',
  '함수 정의',
  'API 구현',
];

const embedder = new RAGEngine(kb, null);

queries.forEach(query => {
  console.log(`\n📌 질문: "${query}"`);
  try {
    const results = embedder.search(query, { topK: 3 });

    if (results.length > 0) {
      console.log(`   ✓ ${results.length}개 결과 찾음:`);
      results.slice(0, 2).forEach((r, i) => {
        console.log(`   ${i + 1}. [${r.chunk.meta.language}] ${r.chunk.name}`);
        console.log(`      파일: ${r.chunk.meta.filePath}`);
      });
    } else {
      console.log('   ⚠️  결과 없음');
    }
  } catch (e) {
    console.log(`   ❌ 오류: ${e.message}`);
  }
});

// 3. 통계
console.log('\n\n📊 Step 3: 서버 통계\n');
console.log('📈 파일별 통계:');
Object.entries(result.stats.byLanguage)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([lang, count]) => {
    console.log(`   ${lang}: ${count}개`);
  });

console.log('\n🎉 테스트 완료!\n');
