/**
 * Scraper 테스트
 *
 * 실행: GOGS_TOKEN=... node tests/test-scraper.js
 */

import GogsClient from '../src/gogs-client.js';
import Scraper from '../src/scraper.js';

const GOGS_URL = process.env.GOGS_URL || 'https://gogs.dclub.kr';
const GOGS_TOKEN = process.env.GOGS_TOKEN;

if (!GOGS_TOKEN) {
  console.error('❌ GOGS_TOKEN 환경변수 필수');
  process.exit(1);
}

async function runTest() {
  console.log('=== Scraper 테스트 ===\n');

  const client = new GogsClient({ url: GOGS_URL, token: GOGS_TOKEN });
  const scraper = new Scraper(client, {
    indexPath: './data/index-test.json',
    dataDir: './data/raw-test'
  });

  try {
    // Test 1: 저장소 통계 (스캔 전)
    console.log('Test 1: 초기 통계');
    let stats = scraper.getStatistics();
    console.log(`  - 저장소: ${stats.totalRepositories}개`);
    console.log(`  - 파일: ${stats.totalFiles}개`);
    console.log();

    // Test 2: 단일 저장소 스캔
    console.log('Test 2: 단일 저장소 스캔 (pyfree)');
    const pyfrreeRepo = await client.getRepo('kim', 'pyfree');
    await scraper.scanRepository(pyfrreeRepo);
    const files = scraper.getRepositoryFiles('kim', 'pyfree');
    if (files) {
      console.log(`  ✓ 파일 수: ${Object.keys(files).length}개`);
      const sampleFiles = Object.keys(files).slice(0, 3);
      sampleFiles.forEach(f => console.log(`    - ${f}`));
    }
    console.log();

    // Test 3: 통계 업데이트
    console.log('Test 3: 통계 업데이트 (스캔 후)');
    stats = scraper.getStatistics();
    console.log(`  - 저장소: ${stats.totalRepositories}개`);
    console.log(`  - 파일: ${stats.totalFiles}개`);
    console.log(`  - 크기: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    console.log();

    // Test 4: 저장소 검색
    console.log('Test 4: 저장소 검색 ("pyfree")');
    const searchResults = scraper.searchRepositories('pyfree');
    console.log(`  ✓ 검색 결과: ${searchResults.length}개`);
    searchResults.forEach(r => {
      console.log(`    - ${r.key} (파일: ${Object.keys(r.files).length}개)`);
    });
    console.log();

    console.log('=== 모든 테스트 완료 ✓ ===');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

runTest();
