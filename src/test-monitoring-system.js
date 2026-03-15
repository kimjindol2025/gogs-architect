#!/usr/bin/env node

/**
 * MonitoringSystem 종합 테스트
 *
 * 테스트 범위:
 * 1. 요청 메트릭 기록
 * 2. 응답 시간 분석
 * 3. 엔드포인트별 통계
 * 4. 시간별 데이터 집계
 * 5. 알림 시스템
 * 6. 대시보드 데이터
 * 7. 헬스 리포트
 */

import MonitoringSystem from './monitoring-system.js';

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
    console.log('🧪 MonitoringSystem 종합 테스트');
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
// 1. 요청 메트릭 기록
// ============================================================

runner.test('요청 메트릭 기록', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const data = mon.getDashboardData();
  if (data.summary.totalRequests !== 1) throw new Error('요청 카운트 불일치');
  if (data.summary.totalErrors !== 0) throw new Error('에러 카운트 오류');
  if (data.summary.totalSuccesses !== 1) throw new Error('성공 카운트 오류');
});

runner.test('에러 요청 메트릭', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 500, 150);

  const data = mon.getDashboardData();
  if (data.summary.totalErrors !== 1) throw new Error('에러 카운트 불일치');
  if (data.summary.totalSuccesses !== 0) throw new Error('성공 카운트 오류');
});

runner.test('다중 요청 기록', () => {
  const mon = new MonitoringSystem();
  for (let i = 0; i < 10; i++) {
    mon.recordRequest('/api/v1/search', 200, 50 + i * 10);
  }

  const data = mon.getDashboardData();
  if (data.summary.totalRequests !== 10) throw new Error('총 요청 카운트 불일치');
});

runner.test('상태 코드 분류', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);
  mon.recordRequest('/api/v1/search', 400, 30);
  mon.recordRequest('/api/v1/search', 500, 100);

  const data = mon.getDashboardData();
  if (data.statusCodes['200'] !== 1) throw new Error('200 상태 코드 카운트 오류');
  if (data.statusCodes['400'] !== 1) throw new Error('400 상태 코드 카운트 오류');
  if (data.statusCodes['500'] !== 1) throw new Error('500 상태 코드 카운트 오류');
});

// ============================================================
// 2. 응답 시간 분석
// ============================================================

runner.test('응답 시간 평균 계산', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 100);
  mon.recordRequest('/api/v1/search', 200, 200);
  mon.recordRequest('/api/v1/search', 200, 300);

  const data = mon.getDashboardData();
  if (data.performance.avgResponseTime !== 200) throw new Error('평균 응답 시간 오류');
});

runner.test('응답 시간 최대/최소', () => {
  const mon = new MonitoringSystem();
  const times = [100, 50, 300, 150];
  times.forEach(t => mon.recordRequest('/api/v1/search', 200, t));

  const data = mon.getDashboardData();
  if (data.performance.maxResponseTime !== 300) throw new Error('최대 응답 시간 오류');
  if (data.performance.minResponseTime !== 50) throw new Error('최소 응답 시간 오류');
});

runner.test('P95 응답 시간 계산', () => {
  const mon = new MonitoringSystem();
  // 100개의 요청, 점진적 증가
  for (let i = 1; i <= 100; i++) {
    mon.recordRequest('/api/v1/search', 200, i * 10);
  }

  const data = mon.getDashboardData();
  if (data.performance.p95ResponseTime === 0) throw new Error('P95 계산 오류');
  // P95는 대략 950ms 근처여야 함
  if (data.performance.p95ResponseTime < 900) throw new Error('P95 값이 너무 작음');
});

// ============================================================
// 3. 엔드포인트별 통계
// ============================================================

runner.test('엔드포인트별 메트릭', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);
  mon.recordRequest('/api/v1/search', 200, 100);
  mon.recordRequest('/api/v1/webhook', 200, 30);

  const data = mon.getDashboardData();
  const searchEp = data.endpoints.find(e => e.endpoint === '/api/v1/search');
  const webhookEp = data.endpoints.find(e => e.endpoint === '/api/v1/webhook');

  if (!searchEp || searchEp.requests !== 2) throw new Error('/api/v1/search 통계 오류');
  if (!webhookEp || webhookEp.requests !== 1) throw new Error('/api/v1/webhook 통계 오류');
});

runner.test('엔드포인트 에러율', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);
  mon.recordRequest('/api/v1/search', 500, 100);

  const data = mon.getDashboardData();
  const searchEp = data.endpoints.find(e => e.endpoint === '/api/v1/search');

  if (parseFloat(searchEp.errorRate) !== 50) throw new Error('에러율 계산 오류');
});

// ============================================================
// 4. 시간별 데이터 집계
// ============================================================

runner.test('시간별 데이터 수집', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const data = mon.getDashboardData();
  if (data.hourlyData.length === 0) throw new Error('시간별 데이터 없음');
});

runner.test('시간별 데이터 제한 (최근 30분)', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const data = mon.getDashboardData();
  if (data.hourlyData.length > 30) throw new Error('시간별 데이터 제한 초과');
});

runner.test('TimeSeries 조회', () => {
  const mon = new MonitoringSystem();
  for (let i = 0; i < 5; i++) {
    mon.recordRequest('/api/v1/search', 200, 50 + i * 10);
  }

  const series = mon.getTimeSeries(10);
  if (!Array.isArray(series)) throw new Error('TimeSeries가 배열이 아님');
  if (series.length !== 10) throw new Error('TimeSeries 길이 오류');
});

// ============================================================
// 5. 알림 시스템
// ============================================================

runner.test('높은 에러율 알림', () => {
  const mon = new MonitoringSystem();
  // 10개 중 9개 에러 = 90%
  for (let i = 0; i < 10; i++) {
    mon.recordRequest('/api/v1/search', i < 9 ? 500 : 200, 50);
  }

  const alerts = mon.getAlerts();
  const errorAlert = alerts.find(a => a.type === 'error_rate');
  if (!errorAlert) throw new Error('에러율 알림 미생성');
  if (errorAlert.level !== 'warning') throw new Error('알림 레벨 오류');
});

runner.test('느린 응답 시간 알림', () => {
  const mon = new MonitoringSystem();
  // 1.5초 응답 시간
  mon.recordRequest('/api/v1/search', 200, 1500);

  const alerts = mon.getAlerts();
  const slowAlert = alerts.find(a => a.type === 'slow_response');
  if (!slowAlert) throw new Error('느린 응답 알림 미생성');
});

runner.test('알림 제한 (최대 100개)', () => {
  const mon = new MonitoringSystem();
  // 200개의 에러 (각각 알림 트리거 시도)
  for (let i = 0; i < 200; i++) {
    mon.recordRequest('/api/v1/search', 500, 50);
    // 알림 타임스탬프 변경으로 중복 방지
    if (i % 50 === 0) {
      mon.lastErrorRateAlert = null;
    }
  }

  const alerts = mon.getAlerts(200);
  if (alerts.length > 100) throw new Error('알림이 100개를 초과함');
});

runner.test('알림 임계값 설정', () => {
  const mon = new MonitoringSystem();
  const result = mon.setAlertThreshold('errorRateThreshold', 0.1);

  if (!result.success) throw new Error('임계값 설정 실패');
  if (mon.alertThresholds.errorRateThreshold !== 0.1) throw new Error('임계값이 적용되지 않음');
});

// ============================================================
// 6. 대시보드 데이터
// ============================================================

runner.test('대시보드 데이터 구조', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const data = mon.getDashboardData();

  if (!data.summary) throw new Error('summary 필드 누락');
  if (!data.performance) throw new Error('performance 필드 누락');
  if (!data.statusCodes) throw new Error('statusCodes 필드 누락');
  if (!data.endpoints) throw new Error('endpoints 필드 누락');
  if (!data.webhooks) throw new Error('webhooks 필드 누락');
  if (!data.resources) throw new Error('resources 필드 누락');
});

runner.test('Webhook 메트릭', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/webhook', 200, 50, true);
  mon.recordRequest('/api/v1/webhook', 500, 100, true);

  const data = mon.getDashboardData();
  if (data.webhooks.events !== 2) throw new Error('webhook 이벤트 카운트 오류');
  if (data.webhooks.successful !== 1) throw new Error('webhook 성공 카운트 오류');
  if (data.webhooks.failed !== 1) throw new Error('webhook 실패 카운트 오류');
});

runner.test('에러율 계산', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);
  mon.recordRequest('/api/v1/search', 400, 30);
  mon.recordRequest('/api/v1/search', 500, 100);

  const data = mon.getDashboardData();
  const errorRate = parseFloat(data.summary.errorRate);

  if (Math.abs(errorRate - 66.67) > 0.5) throw new Error('에러율 계산 오류');
});

// ============================================================
// 7. 헬스 리포트
// ============================================================

runner.test('헬스 리포트 - 정상 상태', () => {
  const mon = new MonitoringSystem();
  for (let i = 0; i < 100; i++) {
    mon.recordRequest('/api/v1/search', 200, 50);
  }

  const health = mon.getHealthReport();
  if (health.status !== 'healthy') throw new Error('상태가 healthy가 아님');
  if (health.issues.length !== 0) throw new Error('정상 상태에서 문제가 있음');
});

runner.test('헬스 리포트 - 높은 에러율', () => {
  const mon = new MonitoringSystem();
  for (let i = 0; i < 10; i++) {
    mon.recordRequest('/api/v1/search', 500, 50);
  }

  const health = mon.getHealthReport();
  if (health.status === 'healthy') throw new Error('높은 에러율을 감지하지 못함');
  if (health.issues.length === 0) throw new Error('문제가 기록되지 않음');
});

runner.test('메트릭 리셋', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const result = mon.reset();
  if (!result.success) throw new Error('리셋 실패');

  const data = mon.getDashboardData();
  if (data.summary.totalRequests !== 0) throw new Error('리셋 후에도 데이터가 남아있음');
});

runner.test('메모리 사용량 정보', () => {
  const mon = new MonitoringSystem();
  mon.recordRequest('/api/v1/search', 200, 50);

  const data = mon.getDashboardData();
  if (!data.resources.memory) throw new Error('메모리 정보 누락');
  if (data.resources.memory.heapUsed === undefined) throw new Error('heapUsed 누락');
  if (data.resources.memory.heapTotal === undefined) throw new Error('heapTotal 누락');
  if (data.resources.memory.usagePercent === undefined) throw new Error('usagePercent 누락');
});

// 테스트 실행
runner.run();
