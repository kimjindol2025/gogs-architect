#!/usr/bin/env node

/**
 * 빠른 키워드 검색 (임베딩 없음)
 *
 * 사용법:
 * node src/quick-search.js "Python"
 */

import ServerIndexer from './server-indexer.js';

console.log('\n🔍 서버 기반 빠른 검색\n');

// 검색어
const query = process.argv[2] || 'Python';

console.log(`📌 검색: "${query}"\n`);

// 서버 인덱싱 (이미 있으면 건너뜀)
console.log('📁 서버 인덱싱 중...\n');
const indexer = new ServerIndexer({
  rootPath: '/home/kimjin/Desktop/kim'
});

const result = indexer.indexServer();
const kb = indexer.kb;

console.log(`\n✅ 인덱싱 완료! (${result.chunks.length}개 청크)\n`);

// 키워드 검색
console.log(`🔎 "${query}" 검색 중...\n`);

const results = kb.search(query) || [];

if (results.length > 0) {
  console.log(`✓ ${results.length}개 결과 찾음:\n`);

  results.slice(0, 20).forEach((chunk, i) => {
    console.log(`${i + 1}. [${chunk.meta.language}] ${chunk.name}`);
    console.log(`   📁 ${chunk.meta.filePath}`);
    console.log(`   📄 내용: ${chunk.content.substring(0, 80)}...`);
    console.log('');
  });

  if (results.length > 20) {
    console.log(`... 외 ${results.length - 20}개 결과`);
  }
} else {
  console.log('⚠️  결과를 찾지 못했습니다.\n');
}

// 통계
console.log('\n📊 통계:');
console.log(`   총 청크: ${result.chunks.length}개`);
console.log(`   파일: ${result.files.length}개`);
console.log(`   언어: ${Object.keys(result.stats.byLanguage).join(', ')}\n`);
