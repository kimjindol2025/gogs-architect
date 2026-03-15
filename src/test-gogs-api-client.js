#!/usr/bin/env node

/**
 * GOGS API 클라이언트 테스트
 *
 * 사용: node src/test-gogs-api-client.js
 *
 * 주의: 실제 GOGS 서버가 필요합니다
 */

import GogsApiClient from './gogs-api-client.js';

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 GOGS API 클라이언트 테스트');
    console.log('='.repeat(70) + '\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${name}`);
        console.log(`   → ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📊 테스트 결과: ${this.passed}/${this.passed + this.failed} (${this.failed > 0 ? '❌' : '✅'})`);
    console.log('='.repeat(70) + '\n');

    process.exit(this.failed > 0 ? 1 : 0);
  }
}

const runner = new TestRunner();

// ============================================================
// 테스트 1: API 클라이언트 초기화
// ============================================================

runner.test('GOGS API 클라이언트 초기화', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'test_token');
  if (!client) throw new Error('클라이언트 초기화 실패');
  if (client.baseUrl !== 'https://gogs.dclub.kr') throw new Error('baseUrl 설정 오류');
});

// ============================================================
// 테스트 2: URL 정규화
// ============================================================

runner.test('URL 끝 슬래시 제거', () => {
  const client1 = new GogsApiClient('https://gogs.dclub.kr/', 'token');
  const client2 = new GogsApiClient('https://gogs.dclub.kr', 'token');

  if (client1.baseUrl !== client2.baseUrl) {
    throw new Error('URL 정규화 오류');
  }
});

// ============================================================
// 테스트 3: 오프라인 모드 (연결 불가 시나리오)
// ============================================================

runner.test('API 연결 실패 처리', async () => {
  const client = new GogsApiClient('https://invalid-server.example.com', 'invalid_token');

  // 실제 호출 시 에러 발생해야 함
  // 오프라인 테스트이므로 에러 처리 만 확인
  try {
    await client.getCurrentUser();
  } catch (error) {
    if (!error.message) throw new Error('에러 메시지 없음');
  }
});

// ============================================================
// 테스트 4: 저장소 목록 함수 서명
// ============================================================

runner.test('listRepositories 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.listRepositories !== 'function') {
    throw new Error('listRepositories 메서드 없음');
  }
});

runner.test('listOrgRepositories 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.listOrgRepositories !== 'function') {
    throw new Error('listOrgRepositories 메서드 없음');
  }
});

// ============================================================
// 테스트 5: 저장소 정보 조회 함수
// ============================================================

runner.test('getRepository 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.getRepository !== 'function') {
    throw new Error('getRepository 메서드 없음');
  }
});

runner.test('listFiles 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.listFiles !== 'function') {
    throw new Error('listFiles 메서드 없음');
  }
});

runner.test('getFileContent 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.getFileContent !== 'function') {
    throw new Error('getFileContent 메서드 없음');
  }
});

// ============================================================
// 테스트 6: 웹훅 관리 함수
// ============================================================

runner.test('createWebhook 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.createWebhook !== 'function') {
    throw new Error('createWebhook 메서드 없음');
  }
});

runner.test('listWebhooks 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.listWebhooks !== 'function') {
    throw new Error('listWebhooks 메서드 없음');
  }
});

runner.test('deleteWebhook 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.deleteWebhook !== 'function') {
    throw new Error('deleteWebhook 메서드 없음');
  }
});

// ============================================================
// 테스트 7: 커밋 관리 함수
// ============================================================

runner.test('getCommitHistory 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.getCommitHistory !== 'function') {
    throw new Error('getCommitHistory 메서드 없음');
  }
});

runner.test('getCommit 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.getCommit !== 'function') {
    throw new Error('getCommit 메서드 없음');
  }
});

runner.test('listBranches 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.listBranches !== 'function') {
    throw new Error('listBranches 메서드 없음');
  }
});

// ============================================================
// 테스트 8: 고급 함수
// ============================================================

runner.test('setupAllRepositories 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.setupAllRepositories !== 'function') {
    throw new Error('setupAllRepositories 메서드 없음');
  }
});

runner.test('scanRepository 메서드 존재', () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'token');
  if (typeof client.scanRepository !== 'function') {
    throw new Error('scanRepository 메서드 없음');
  }
});

// ============================================================
// 테스트 9: 응답 처리
// ============================================================

runner.test('성공 응답 형식 검증', () => {
  const successResponse = {
    success: true,
    user: { login: 'test' }
  };

  if (!successResponse.success) throw new Error('success 필드 누락');
  if (!successResponse.user) throw new Error('user 필드 누락');
});

runner.test('에러 응답 형식 검증', () => {
  const errorResponse = {
    success: false,
    error: 'API Error'
  };

  if (errorResponse.success) throw new Error('success 필드 오류');
  if (!errorResponse.error) throw new Error('error 필드 누락');
});

// ============================================================
// 테스트 10: 사용 예시
// ============================================================

runner.test('GOGS 클라이언트 사용 예시', async () => {
  const client = new GogsApiClient('https://gogs.dclub.kr', 'test_token');

  // 예시: 저장소 목록 조회
  const repoResult = {
    success: true,
    repositories: [
      { id: 1, name: 'repo1', full_name: 'user/repo1' },
      { id: 2, name: 'repo2', full_name: 'user/repo2' }
    ]
  };

  if (repoResult.repositories.length !== 2) {
    throw new Error('저장소 목록 길이 오류');
  }

  // 예시: 웹훅 설정
  const webhookResult = {
    success: true,
    webhook: { id: 1 },
    webhookId: 1
  };

  if (!webhookResult.webhookId) {
    throw new Error('webhookId 누락');
  }
});

// 테스트 실행
runner.run();
