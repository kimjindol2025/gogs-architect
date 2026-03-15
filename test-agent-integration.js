#!/usr/bin/env node

import AutoIndexer from './src/auto-indexer.js';
import SearchEnhanced from './src/search-enhanced.js';
import KnowledgeBase from './src/knowledge-base.js';
import Embedder from './src/embedder.js';
import PatternAnalyzer from './src/pattern-analyzer.js';

async function testAgentIntegration() {
  console.log('\n🧪 AutoIndexer + SearchEnhanced 통합 테스트\n');

  try {
    // 초기화
    const kb = new KnowledgeBase();
    const embedder = new Embedder(kb);
    const analyzer = new PatternAnalyzer();
    const search = new SearchEnhanced(kb, embedder, analyzer);
    const indexer = new AutoIndexer(null, kb, search);

    // Test 1: 에이전트 상태 조회
    console.log('✓ Test 1: Agent 상태 조회');
    const status = indexer.getStatus();
    console.log(`  - Queue size: ${status.queueSize}`);
    console.log(`  - Is indexing: ${status.isIndexing}`);
    console.log(`  - Total indexed: ${status.stats.totalIndexed}`);
    
    // Test 2: 저장소를 큐에 추가
    console.log('\n✓ Test 2: Repository 큐 추가');
    indexer.enqueueRepository({
      id: 'test-repo-1',
      name: 'test/repo1',
      url: 'https://gogs.local/test/repo1.git',
      action: 'add',
      priority: 'high'
    });
    const status2 = indexer.getStatus();
    console.log(`  - Queue size after enqueue: ${status2.queueSize}`);
    console.log(`  - Next actions: ${status2.nextActions.length}`);

    // Test 3: 검색 테스트
    console.log('\n✓ Test 3: Advanced Search');
    const searchResult = search.searchAdvanced('useState');
    console.log(`  - Found: ${searchResult.totalFound} usages`);
    console.log(`  - Duration: ${searchResult.duration}`);
    console.log(`  - Dependencies: ${searchResult.dependencies.fileCount} files`);

    // Test 4: 에이전트 리포트
    console.log('\n✓ Test 4: Agent Report');
    const report = indexer.generateReport();
    console.log(`  - Title: ${report.title}`);
    console.log(`  - Status: ${report.health.상태}`);
    console.log(`  - Queue: ${report.queue.대기중} waiting`);

    console.log('\n✅ 모든 통합 테스트 통과!\n');
  } catch (error) {
    console.error(`\n❌ 테스트 실패: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

testAgentIntegration();
