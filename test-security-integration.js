#!/usr/bin/env node

/**
 * Security Integration Test
 * 
 * 테스트 항목:
 * 1. Database Integration (영속성)
 * 2. Rate Limiter (DDoS 방어)
 * 3. Input Validator (입력 검증)
 */

import DatabaseIntegration from './src/database-integration.js';
import RateLimiter from './src/rate-limiter.js';
import InputValidator from './src/input-validator.js';

const db = new DatabaseIntegration('./test-data');
const rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
const validator = new InputValidator();

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║        🔒 Security Integration Test Suite                      ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// ===== Database Integration Tests =====
console.log('📁 Database Integration Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('저장소 추가 및 메타데이터 저장', () => {
  const result = db.addRepository({
    id: 1,
    name: 'test-repo',
    url: 'https://example.com/test-repo.git',
    files: [{ path: 'main.js', lines: 100 }],
    chunks: [{ content: 'const x = 1;', line: 10 }]
  });
  assert(result.success, '저장소 추가 실패');
  assert(db.repositories.size === 1, '저장소 저장 실패');
});

test('저장소 업데이트', () => {
  const result = db.updateRepository(1, {
    chunks: [{ content: 'const y = 2;', line: 20 }]
  });
  assert(result.success, '저장소 업데이트 실패');
});

test('저장소 제거', () => {
  const result = db.removeRepository(1);
  assert(result.success, '저장소 제거 실패');
  assert(db.repositories.size === 0, '저장소 삭제 실패');
});

test('통계 조회', () => {
  const stats = db.getStats();
  assert(stats.totalIndexed > 0, '통계 계산 오류');
  assert(stats.repositoryCount === 0, '저장소 수 오류');
});

test('데이터베이스 초기화', () => {
  db.reset();
  assert(db.repositories.size === 0, 'DB 초기화 실패');
  assert(db.stats.totalIndexed === 0, '통계 초기화 실패');
});

// ===== Rate Limiter Tests =====
console.log('\n🚦 Rate Limiter Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('요청 허용 (토큰 충분)', () => {
  const allowed = rateLimiter.isAllowed('192.168.1.1');
  assert(allowed === true, '요청 거부됨');
});

test('최대 요청 도달 후 거부', () => {
  rateLimiter.reset();
  const ip = '192.168.1.2';

  // 10개 요청 (최대)
  for (let i = 0; i < 10; i++) {
    const allowed = rateLimiter.isAllowed(ip);
    assert(allowed === true, `${i}번째 요청 거부`);
  }

  // 11번째 요청은 거부
  const denied = rateLimiter.isAllowed(ip);
  assert(denied === false, '11번째 요청 허용됨');
});

test('IP별 독립적 제한', () => {
  rateLimiter.reset();
  const ip1 = '192.168.1.3';
  const ip2 = '192.168.1.4';

  // IP1: 5개 요청
  for (let i = 0; i < 5; i++) {
    rateLimiter.isAllowed(ip1);
  }

  // IP2: 5개 요청
  for (let i = 0; i < 5; i++) {
    rateLimiter.isAllowed(ip2);
  }

  // 각 IP 상태 확인
  const status1 = rateLimiter.getStatus(ip1);
  const status2 = rateLimiter.getStatus(ip2);

  assert(status1.tokensRemaining === 5, 'IP1 토큰 계산 오류');
  assert(status2.tokensRemaining === 5, 'IP2 토큰 계산 오류');
});

test('Rate limiter 통계', () => {
  const stats = rateLimiter.getStats();
  assert(stats.maxRequests === 10, '최대 요청 수 오류');
  assert(stats.activeBuckets > 0, '활성 버킷 없음');
});

// ===== Input Validator Tests =====
console.log('\n🔍 Input Validator Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('유효한 문자열 검증', () => {
  const result = validator.validateString('hello');
  assert(result.valid === true, '유효한 문자열 거부됨');
});

test('필수 필드 검증', () => {
  const result = validator.validateString(null, { required: true });
  assert(result.valid === false, '필수 필드 검증 실패');
});

test('문자열 길이 제한', () => {
  const long = 'a'.repeat(2000);
  const result = validator.validateString(long);
  assert(result.valid === false, '길이 제한 검증 실패');
});

test('SQL injection 패턴 감지', () => {
  const dangerous = "'; DROP TABLE users; --";
  const safe = validator.isSafe(dangerous);
  assert(safe === false, 'SQL injection 감지 실패');
});

test('XSS 패턴 감지', () => {
  const xss = '<script>alert("xss")</script>';
  const safe = validator.isSafe(xss);
  assert(safe === false, 'XSS 감지 실패');
});

test('유효한 숫자 검증', () => {
  const result = validator.validateNumber(42, { integer: true });
  assert(result.valid === true, '유효한 숫자 거부됨');
});

test('유효한 배열 검증', () => {
  const result = validator.validateArray(['a', 'b', 'c'], { itemType: 'string' });
  assert(result.valid === true, '유효한 배열 거부됨');
});

test('검색 쿼리 검증', () => {
  const result = validator.validateSearchQuery('useState');
  assert(result.valid === true, '유효한 쿼리 거부됨');
});

test('3단어 쿼리 검증', () => {
  const result = validator.validateThreeWordQuery(['sql', 'parser', 'aws']);
  assert(result.valid === true, '유효한 3단어 거부됨');
});

test('위험한 3단어 쿼리 거부', () => {
  const result = validator.validateThreeWordQuery(['sql', "'; DROP TABLE; --", 'query']);
  assert(result.valid === false, '위험한 쿼리 허용됨');
});

test('Webhook 페이로드 검증', () => {
  const payload = {
    action: 'push',
    repository: {
      id: 123,
      full_name: 'user/repo',
      clone_url: 'https://example.com/user/repo.git'
    }
  };
  const result = validator.validateWebhookPayload(payload);
  assert(result.valid === true, '유효한 Webhook 거부됨');
});

test('유효하지 않은 Webhook 거부', () => {
  const payload = {
    action: 'invalid',
    repository: { id: 'not-a-number' }
  };
  const result = validator.validateWebhookPayload(payload);
  assert(result.valid === false, '유효하지 않은 Webhook 허용됨');
});

// ===== Summary =====
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                      📊 Test Summary                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const total = testsPassed + testsFailed;
const passRate = ((testsPassed / total) * 100).toFixed(1);

console.log(`✅ 통과: ${testsPassed}/${total}`);
console.log(`❌ 실패: ${testsFailed}/${total}`);
console.log(`📊 성공률: ${passRate}%\n`);

if (testsFailed === 0) {
  console.log('🎉 모든 테스트 통과! Security 레이어 완전 검증됨.\n');
} else {
  console.log(`⚠️  ${testsFailed}개 테스트 실패\n`);
}

// Cleanup
db.reset();
rateLimiter.destroy();

process.exit(testsFailed > 0 ? 1 : 0);
