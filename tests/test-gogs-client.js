/**
 * Gogs 클라이언트 테스트
 *
 * 실행: node tests/test-gogs-client.js
 */

import GogsClient from '../src/gogs-client.js';

// 환경변수 확인
const GOGS_URL = process.env.GOGS_URL || 'https://gogs.dclub.kr';
const GOGS_TOKEN = process.env.GOGS_TOKEN;

if (!GOGS_TOKEN) {
  console.error('❌ ERROR: GOGS_TOKEN 환경변수를 설정하세요');
  console.error('export GOGS_TOKEN="..."');
  process.exit(1);
}

const client = new GogsClient({
  url: GOGS_URL,
  token: GOGS_TOKEN
});

async function runTests() {
  console.log('=== Gogs Client 테스트 ===\n');

  try {
    // Test 1: 사용자 정보 조회
    console.log('Test 1: 사용자 정보 조회');
    const user = await client.getUser();
    console.log(`  ✓ 사용자: ${user.login}`);
    console.log(`  ✓ 이름: ${user.full_name}`);
    console.log();

    // Test 2: 저장소 목록 조회
    console.log('Test 2: 저장소 목록 조회 (최대 10개)');
    const repos = await client.getUserRepos(1, 10);
    console.log(`  ✓ 저장소 수: ${repos.length}`);
    if (repos.length > 0) {
      console.log(`  ✓ 첫 번째 저장소: ${repos[0].name}`);
      console.log(`  ✓ URL: ${repos[0].html_url}`);
    }
    console.log();

    // Test 3: 특정 저장소 조회
    console.log('Test 3: 특정 저장소 조회 (pyfree)');
    const repo = await client.getRepo('kim', 'pyfree');
    console.log(`  ✓ 저장소명: ${repo.name}`);
    console.log(`  ✓ 설명: ${repo.description || '(없음)'}`);
    console.log(`  ✓ 스타: ${repo.stars_count}`);
    console.log(`  ✓ 포크: ${repo.forks_count}`);
    console.log();

    // Test 4: 커밋 로그 조회
    console.log('Test 4: 커밋 로그 조회 (pyfree, 최대 5개)');
    const commits = await client.getCommits('kim', 'pyfree', 1, 5);
    console.log(`  ✓ 커밋 수: ${commits.length}`);
    if (commits.length > 0) {
      const commit = commits[0];
      console.log(`  ✓ 최신 커밋: ${commit.sha.substring(0, 7)}`);
      console.log(`  ✓ 메시지: ${commit.commit.message.split('\n')[0]}`);
      console.log(`  ✓ 작성자: ${commit.commit.author.name}`);
    }
    console.log();

    // Test 5: 파일 내용 조회
    console.log('Test 5: 파일 내용 조회 (pyfree/README.md)');
    try {
      const content = await client.getFileContent('kim', 'pyfree', 'README.md');
      console.log(`  ✓ 파일 크기: ${content.length} bytes`);
      console.log(`  ✓ 첫 100자: ${content.substring(0, 100)}...`);
    } catch (e) {
      console.log(`  ⚠ README.md 파일 없음`);
    }
    console.log();

    // Test 6: 이슈 조회
    console.log('Test 6: 이슈 조회 (pyfree)');
    const issues = await client.getIssues('kim', 'pyfree', 1, 5);
    console.log(`  ✓ 이슈 수: ${issues.length}`);
    console.log();

    console.log('=== 모든 테스트 완료 ✓ ===');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

runTests();
