#!/usr/bin/env node

/**
 * WebhookManager 종합 테스트
 *
 * 테스트 범위:
 * 1. Webhook 등록/해제
 * 2. 이벤트 라우팅 및 필터링
 * 3. 이벤트 히스토리 관리
 * 4. 재시도 로직
 * 5. 통계 및 상태 조회
 * 6. 시뮬레이션 및 헬스 체크
 */

import WebhookManager from './webhook-manager.js';

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
    console.log('🧪 WebhookManager 종합 테스트');
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
// 1. Webhook 등록/해제 테스트
// ============================================================

runner.test('Webhook 등록 성공', () => {
  const manager = new WebhookManager();
  const result = manager.registerWebhook('webhook-1', {
    url: 'https://example.com/webhook',
    events: ['push', 'create']
  });

  if (!result.success) throw new Error('등록 실패');
  if (result.webhookId !== 'webhook-1') throw new Error('ID 불일치');
});

runner.test('Webhook 등록 - 필수 필드 검증', () => {
  const manager = new WebhookManager();
  const result = manager.registerWebhook('webhook-2', {
    events: ['push'] // url 누락
  });

  if (result.success) throw new Error('검증이 작동하지 않음');
  if (!result.error.includes('url')) throw new Error('에러 메시지 불명확');
});

runner.test('Webhook 등록 - 빈 이벤트 배열 검증', () => {
  const manager = new WebhookManager();
  const result = manager.registerWebhook('webhook-3', {
    url: 'https://example.com',
    events: []
  });

  if (result.success) throw new Error('검증이 작동하지 않음');
});

runner.test('Webhook 해제 성공', () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-4', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const result = manager.unregisterWebhook('webhook-4');
  if (!result.success) throw new Error('해제 실패');

  const list = manager.listWebhooks();
  if (list.length !== 0) throw new Error('해제 후에도 남아있음');
});

runner.test('Webhook 해제 - 존재하지 않는 ID', () => {
  const manager = new WebhookManager();
  const result = manager.unregisterWebhook('nonexistent');

  if (result.success) throw new Error('존재하지 않는 webhook을 해제했음');
});

runner.test('Webhook 목록 조회', () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-5', {
    url: 'https://example.com/1',
    events: ['push']
  });
  manager.registerWebhook('webhook-6', {
    url: 'https://example.com/2',
    events: ['create', 'delete']
  });

  const list = manager.listWebhooks();
  if (list.length !== 2) throw new Error('목록 길이 불일치');
  if (!list.some(w => w.id === 'webhook-5')) throw new Error('webhook-5 누락');
  if (!list.some(w => w.id === 'webhook-6')) throw new Error('webhook-6 누락');
});

// ============================================================
// 2. 이벤트 라우팅 및 필터링 테스트
// ============================================================

runner.test('이벤트 처리 - push 이벤트', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-7', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const payload = {
    action: 'push',
    repository: {
      id: 'repo-1',
      name: 'test-repo',
      full_name: 'user/test-repo'
    }
  };

  const result = await manager.handleEvent(payload);
  if (!result.processed) throw new Error('이벤트 미처리');
  if (result.triggeredWebhooks !== 1) throw new Error('트리거 카운트 불일치');
});

runner.test('이벤트 처리 - 이벤트 필터링', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-8', {
    url: 'https://example.com/webhook',
    events: ['push'] // push만 등록
  });

  // create 이벤트 전송
  const payload = {
    action: 'create',
    repository: {
      id: 'repo-2',
      name: 'test-repo'
    }
  };

  const result = await manager.handleEvent(payload);
  if (result.triggeredWebhooks !== 0) throw new Error('필터링 실패');
});

runner.test('이벤트 처리 - 다중 Webhook', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-9', {
    url: 'https://example.com/1',
    events: ['push', 'create']
  });
  manager.registerWebhook('webhook-10', {
    url: 'https://example.com/2',
    events: ['push'] // push만
  });
  manager.registerWebhook('webhook-11', {
    url: 'https://example.com/3',
    events: ['delete']
  });

  const payload = {
    action: 'push',
    repository: { id: 'repo-3', name: 'test-repo' }
  };

  const result = await manager.handleEvent(payload);
  if (result.triggeredWebhooks !== 2) throw new Error('정확히 2개 webhook만 트리거되어야 함');
});

runner.test('이벤트 처리 - 유효하지 않은 payload', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-12', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const result = await manager.handleEvent({
    // action/repository 누락
  });

  if (result.processed) throw new Error('유효하지 않은 payload를 처리했음');
});

// ============================================================
// 3. 이벤트 히스토리 관리 테스트
// ============================================================

runner.test('이벤트 히스토리 저장', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-13', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const payload = {
    action: 'push',
    repository: { id: 'repo-4', name: 'test-repo' }
  };

  await manager.handleEvent(payload);

  const history = manager.getEventHistory();
  if (history.length === 0) throw new Error('히스토리가 저장되지 않음');
  if (history[0].action !== 'push') throw new Error('이벤트 액션 불일치');
});

runner.test('이벤트 히스토리 제한 (최대 1000)', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-14', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  // 1100개 이벤트 생성
  for (let i = 0; i < 1100; i++) {
    await manager.handleEvent({
      action: 'push',
      repository: { id: `repo-${i}`, name: 'test-repo' }
    });
  }

  const history = manager.getEventHistory(1000);
  if (history.length !== 1000) throw new Error(`히스토리 길이: ${history.length} (1000 예상)`);
});

runner.test('이벤트 히스토리 조회 - limit 파라미터', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-15', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  for (let i = 0; i < 10; i++) {
    await manager.handleEvent({
      action: 'push',
      repository: { id: `repo-${i}`, name: 'test-repo' }
    });
  }

  const history = manager.getEventHistory(5);
  if (history.length !== 5) throw new Error(`요청한 5개가 아닌 ${history.length}개 반환`);
});

runner.test('이벤트 히스토리 - timestamp 기록', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-16', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const before = Date.now();
  await manager.handleEvent({
    action: 'push',
    repository: { id: 'repo-5', name: 'test-repo' }
  });
  const after = Date.now();

  const history = manager.getEventHistory();
  const eventTime = new Date(history[0].timestamp).getTime();

  if (eventTime < before || eventTime > after) {
    throw new Error('timestamp 범위 초과');
  }
});

// ============================================================
// 4. 재시도 로직 테스트
// ============================================================

runner.test('실패 이벤트 재시도', async () => {
  const manager = new WebhookManager();

  // 재시도 로직 테스트: 실제로는 네트워크 요청이 필요하지만,
  // WebhookManager의 retryFailedEvents는 상태를 관리함
  const result = await manager.retryFailedEvents();

  // 실패한 이벤트가 없는 경우
  if (!result.success) throw new Error('재시도 실패');
  if (result.retriedCount === undefined) throw new Error('재시도 카운트 누락');
});

runner.test('실패 이벤트 통계', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-17', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  // 여러 이벤트 처리
  for (let i = 0; i < 5; i++) {
    await manager.handleEvent({
      action: 'push',
      repository: { id: `repo-${i}`, name: 'test-repo' }
    });
  }

  const stats = manager.getStats();
  if (stats.totalEvents !== 5) throw new Error('총 이벤트 카운트 불일치');
});

// ============================================================
// 5. 통계 및 상태 조회 테스트
// ============================================================

runner.test('통계 조회 - 초기 상태', () => {
  const manager = new WebhookManager();
  const stats = manager.getStats();

  if (stats.totalWebhooks !== 0) throw new Error('초기 webhook 카운트 불일치');
  if (stats.totalEvents !== 0) throw new Error('초기 이벤트 카운트 불일치');
  if (stats.successRate === undefined) throw new Error('successRate 누락');
});

runner.test('통계 조회 - 다중 webhook 및 이벤트', async () => {
  const manager = new WebhookManager();

  manager.registerWebhook('webhook-18', {
    url: 'https://example.com/1',
    events: ['push']
  });
  manager.registerWebhook('webhook-19', {
    url: 'https://example.com/2',
    events: ['create']
  });

  for (let i = 0; i < 3; i++) {
    await manager.handleEvent({
      action: 'push',
      repository: { id: `repo-${i}`, name: 'test-repo' }
    });
  }

  const stats = manager.getStats();
  if (stats.totalWebhooks !== 2) throw new Error('webhook 카운트 불일치');
  if (stats.totalEvents !== 3) throw new Error('이벤트 카운트 불일치');
});

// ============================================================
// 6. 시뮬레이션 및 헬스 체크 테스트
// ============================================================

runner.test('이벤트 시뮬레이션', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-20', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const result = await manager.simulateEvent('push', 'test-repo');

  if (!result.success) throw new Error('시뮬레이션 실패');
  if (!result.processed) throw new Error('processed 플래그 누락');
});

runner.test('이벤트 시뮬레이션 - 일치하는 webhook 없음', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-21', {
    url: 'https://example.com/webhook',
    events: ['delete'] // delete만 등록
  });

  const result = await manager.simulateEvent('push', 'test-repo');

  if (result.triggeredWebhooks !== 0) throw new Error('일치하지 않는 webhook이 트리거됨');
});

runner.test('헬스 체크 - 정상 상태', () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-22', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  const health = manager.healthCheck();

  if (health.status !== 'healthy') throw new Error('상태가 healthy가 아님');
  if (health.webhookCount !== 1) throw new Error('webhook 개수 불일치');
});

runner.test('헬스 체크 - 상세 정보', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-23', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  await manager.handleEvent({
    action: 'push',
    repository: { id: 'repo-6', name: 'test-repo' }
  });

  const health = manager.healthCheck();

  if (health.uptime === undefined) throw new Error('uptime 누락');
  if (health.eventCount === undefined) throw new Error('eventCount 누락');
  if (health.lastEvent === undefined) throw new Error('lastEvent 누락');
});

// ============================================================
// 7. 경계 조건 테스트
// ============================================================

runner.test('Webhook ID 중복 등록', () => {
  const manager = new WebhookManager();

  manager.registerWebhook('webhook-24', {
    url: 'https://example.com/1',
    events: ['push']
  });

  // 동일한 ID로 다시 등록
  const result = manager.registerWebhook('webhook-24', {
    url: 'https://example.com/2',
    events: ['create']
  });

  if (result.success) throw new Error('중복 ID를 허용했음');
  if (!result.error.includes('already exists')) throw new Error('중복 오류 메시지 불명확');
});

runner.test('빈 URL', () => {
  const manager = new WebhookManager();
  const result = manager.registerWebhook('webhook-25', {
    url: '',
    events: ['push']
  });

  if (result.success) throw new Error('빈 URL을 허용했음');
});

runner.test('특수 문자가 포함된 webhook ID', () => {
  const manager = new WebhookManager();
  const result = manager.registerWebhook('webhook-@#$%', {
    url: 'https://example.com/webhook',
    events: ['push']
  });

  // 일반적으로 alphanumeric과 하이픈/언더스코어만 허용
  if (result.success) throw new Error('특수 문자 ID를 허용했음');
});

runner.test('대소문자 구분 - 이벤트 액션', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-26', {
    url: 'https://example.com/webhook',
    events: ['push'] // 소문자
  });

  // 대문자로 전송
  const result = await manager.handleEvent({
    action: 'PUSH', // 대문자
    repository: { id: 'repo-7', name: 'test-repo' }
  });

  // 매칭되지 않아야 함 (대소문자 구분)
  if (result.triggeredWebhooks !== 0) throw new Error('대소문자 구분 실패');
});

runner.test('Webhook 이벤트 조합', async () => {
  const manager = new WebhookManager();
  manager.registerWebhook('webhook-27', {
    url: 'https://example.com/webhook',
    events: ['push', 'create', 'delete'] // 3가지 모두
  });

  let totalTriggered = 0;

  for (const action of ['push', 'create', 'delete']) {
    const result = await manager.handleEvent({
      action,
      repository: { id: 'repo-8', name: 'test-repo' }
    });
    totalTriggered += result.triggeredWebhooks;
  }

  if (totalTriggered !== 3) throw new Error('3가지 이벤트 모두 트리거되지 않음');
});

// 테스트 실행
runner.run();
