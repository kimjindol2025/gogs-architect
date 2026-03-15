#!/usr/bin/env node

/**
 * 서버 초기화 (인덱싱)
 *
 * 사용법:
 * node src/server-init.js
 */

import ServerIndexer from './server-indexer.js';

const indexer = new ServerIndexer({
  rootPath: '/home/kimjin/Desktop/kim',
  extensions: [
    '.free', '.fl', '.mojo', '.py', '.ts', '.js',
    '.c', '.h', '.cpp', '.cc', '.go', '.rs',
    '.md', '.txt', '.json', '.yaml', '.yml'
  ]
});

try {
  const result = indexer.indexServer();
  console.log('\n🎉 서버 인덱싱 성공!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ 인덱싱 실패:', error.message);
  process.exit(1);
}
