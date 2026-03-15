/**
 * 모니터링 시스템 - 실시간 통계 수집 및 분석
 *
 * 기능:
 * - 요청/응답 통계 (시간별, 분별)
 * - 에러율 및 성공률
 * - 응답 시간 분석 (평균, 최소, 최대, P95)
 * - Webhook 성공/실패 추적
 * - 메모리 및 CPU 모니터링
 * - 알림 시스템 (임계값 초과)
 */

class MonitoringSystem {
  constructor() {
    this.metrics = {
      // 요청 메트릭
      totalRequests: 0,
      totalErrors: 0,
      totalSuccesses: 0,

      // 시간별 데이터 (최근 60분)
      minuteData: {}, // { "HH:MM": { requests, errors, avgTime } }

      // 응답 시간
      responseTimes: [], // 최근 1000개 요청
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      p95ResponseTime: 0,

      // 엔드포인트별 메트릭
      endpoints: {}, // { "/api/v1/search": { requests, errors, avgTime } }

      // Webhook 메트릭
      webhookMetrics: {
        totalWebhooks: 0,
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        avgProcessingTime: 0
      },

      // 상태 코드별
      statusCodes: {}, // { "200": 100, "400": 5, "500": 2 }

      // 타임스탬프
      startTime: Date.now(),
      lastUpdated: Date.now()
    };

    // 알림 설정
    this.alerts = [];
    this.alertThresholds = {
      errorRateThreshold: 0.05, // 5%
      responseTimeThreshold: 1000, // 1초
      memoryUsageThreshold: 0.8, // 80%
      webhookFailureThreshold: 0.1 // 10%
    };

    // 매분마다 집계
    this.startAggregation();
  }

  /**
   * 요청 메트릭 기록
   */
  recordRequest(endpoint, statusCode, responseTime, isWebhook = false) {
    const now = new Date();
    const minuteKey = now.toISOString().slice(0, 16); // "2026-03-12T14:30"

    // 기본 통계
    this.metrics.totalRequests++;
    if (statusCode >= 400) {
      this.metrics.totalErrors++;
    } else {
      this.metrics.totalSuccesses++;
    }

    // 응답 시간 기록
    this.metrics.responseTimes.push(responseTime);
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }

    // 분별 데이터
    if (!this.metrics.minuteData[minuteKey]) {
      this.metrics.minuteData[minuteKey] = {
        requests: 0,
        errors: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity
      };
    }
    this.metrics.minuteData[minuteKey].requests++;
    if (statusCode >= 400) {
      this.metrics.minuteData[minuteKey].errors++;
    }
    this.metrics.minuteData[minuteKey].totalTime += responseTime;
    this.metrics.minuteData[minuteKey].maxTime = Math.max(
      this.metrics.minuteData[minuteKey].maxTime,
      responseTime
    );
    this.metrics.minuteData[minuteKey].minTime = Math.min(
      this.metrics.minuteData[minuteKey].minTime,
      responseTime
    );

    // 엔드포인트별
    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        requests: 0,
        errors: 0,
        totalTime: 0
      };
    }
    this.metrics.endpoints[endpoint].requests++;
    if (statusCode >= 400) {
      this.metrics.endpoints[endpoint].errors++;
    }
    this.metrics.endpoints[endpoint].totalTime += responseTime;

    // 상태 코드별
    if (!this.metrics.statusCodes[statusCode]) {
      this.metrics.statusCodes[statusCode] = 0;
    }
    this.metrics.statusCodes[statusCode]++;

    // 응답 시간 분석
    this.updateResponseTimeMetrics();

    // 웹훅 메트릭
    if (isWebhook) {
      this.metrics.webhookMetrics.totalEvents++;
      if (statusCode < 400) {
        this.metrics.webhookMetrics.successfulEvents++;
      } else {
        this.metrics.webhookMetrics.failedEvents++;
      }
    }

    // 마지막 업데이트
    this.metrics.lastUpdated = Date.now();

    // 알림 확인
    this.checkAlerts();
  }

  /**
   * 응답 시간 메트릭 업데이트
   */
  updateResponseTimeMetrics() {
    if (this.metrics.responseTimes.length === 0) return;

    const times = this.metrics.responseTimes;
    this.metrics.avgResponseTime =
      times.reduce((a, b) => a + b, 0) / times.length;
    this.metrics.maxResponseTime = Math.max(...times);
    this.metrics.minResponseTime = Math.min(...times);

    // P95 계산
    const sorted = [...times].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.p95ResponseTime = sorted[p95Index] || 0;
  }

  /**
   * 알림 확인 및 생성
   */
  checkAlerts() {
    const errorRate =
      this.metrics.totalRequests > 0
        ? this.metrics.totalErrors / this.metrics.totalRequests
        : 0;

    const now = Date.now();

    // 에러율 알림
    if (
      errorRate > this.alertThresholds.errorRateThreshold &&
      (!this.lastErrorRateAlert || now - this.lastErrorRateAlert > 60000)
    ) {
      this.alerts.push({
        timestamp: now,
        level: 'warning',
        type: 'error_rate',
        message: `높은 에러율: ${(errorRate * 100).toFixed(2)}% (임계값: ${(this.alertThresholds.errorRateThreshold * 100).toFixed(2)}%)`,
        value: errorRate
      });
      this.lastErrorRateAlert = now;
    }

    // 응답 시간 알림
    if (
      this.metrics.avgResponseTime > this.alertThresholds.responseTimeThreshold &&
      (!this.lastResponseTimeAlert || now - this.lastResponseTimeAlert > 60000)
    ) {
      this.alerts.push({
        timestamp: now,
        level: 'warning',
        type: 'slow_response',
        message: `느린 응답: ${Math.round(this.metrics.avgResponseTime)}ms (임계값: ${this.alertThresholds.responseTimeThreshold}ms)`,
        value: this.metrics.avgResponseTime
      });
      this.lastResponseTimeAlert = now;
    }

    // 메모리 사용량 알림
    const memUsage = process.memoryUsage();
    const heapUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    if (
      heapUsagePercent > this.alertThresholds.memoryUsageThreshold &&
      (!this.lastMemoryAlert || now - this.lastMemoryAlert > 60000)
    ) {
      this.alerts.push({
        timestamp: now,
        level: 'critical',
        type: 'memory_usage',
        message: `높은 메모리 사용: ${(heapUsagePercent * 100).toFixed(2)}% (임계값: ${(this.alertThresholds.memoryUsageThreshold * 100).toFixed(2)}%)`,
        value: heapUsagePercent
      });
      this.lastMemoryAlert = now;
    }

    // Webhook 실패율 알림
    if (this.metrics.webhookMetrics.totalEvents > 0) {
      const webhookFailureRate =
        this.metrics.webhookMetrics.failedEvents /
        this.metrics.webhookMetrics.totalEvents;

      if (
        webhookFailureRate > this.alertThresholds.webhookFailureThreshold &&
        (!this.lastWebhookAlert || now - this.lastWebhookAlert > 60000)
      ) {
        this.alerts.push({
          timestamp: now,
          level: 'warning',
          type: 'webhook_failure',
          message: `높은 Webhook 실패율: ${(webhookFailureRate * 100).toFixed(2)}% (임계값: ${(this.alertThresholds.webhookFailureThreshold * 100).toFixed(2)}%)`,
          value: webhookFailureRate
        });
        this.lastWebhookAlert = now;
      }
    }

    // 알림 제한 (최근 100개만 유지)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * 매분 집계
   */
  startAggregation() {
    setInterval(() => {
      const now = new Date();
      const onehourAgo = new Date(now.getTime() - 3600000);
      const minuteKeyThreshold = onehourAgo.toISOString().slice(0, 16);

      // 1시간 이상 된 데이터 제거
      for (const key in this.metrics.minuteData) {
        if (key < minuteKeyThreshold) {
          delete this.metrics.minuteData[key];
        }
      }
    }, 60000); // 매분
  }

  /**
   * 대시보드 데이터 반환
   */
  getDashboardData() {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const errorRate =
      this.metrics.totalRequests > 0
        ? (
            (this.metrics.totalErrors / this.metrics.totalRequests) *
            100
          ).toFixed(2)
        : 0;
    const successRate = (100 - errorRate).toFixed(2);

    // 엔드포인트별 상세
    const endpointDetails = Object.entries(this.metrics.endpoints).map(
      ([endpoint, data]) => ({
        endpoint,
        requests: data.requests,
        errors: data.errors,
        errorRate: data.requests > 0 ? ((data.errors / data.requests) * 100).toFixed(2) : 0,
        avgTime: data.requests > 0 ? Math.round(data.totalTime / data.requests) : 0
      })
    );

    // 시간별 데이터 (최근 30분)
    const hourlyData = Object.entries(this.metrics.minuteData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([minute, data]) => ({
        minute,
        requests: data.requests,
        errors: data.errors,
        avgTime:
          data.requests > 0
            ? Math.round(data.totalTime / data.requests)
            : 0,
        errorRate:
          data.requests > 0
            ? ((data.errors / data.requests) * 100).toFixed(2)
            : 0
      }));

    // 메모리 정보
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (
      (memUsage.heapUsed / memUsage.heapTotal) *
      100
    ).toFixed(2);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        uptime,
        totalRequests: this.metrics.totalRequests,
        totalErrors: this.metrics.totalErrors,
        totalSuccesses: this.metrics.totalSuccesses,
        errorRate,
        successRate
      },
      performance: {
        avgResponseTime: Math.round(this.metrics.avgResponseTime),
        maxResponseTime: this.metrics.maxResponseTime,
        minResponseTime: this.metrics.minResponseTime,
        p95ResponseTime: Math.round(this.metrics.p95ResponseTime)
      },
      statusCodes: this.metrics.statusCodes,
      endpoints: endpointDetails,
      hourlyData,
      webhooks: {
        total: this.metrics.webhookMetrics.totalWebhooks,
        events: this.metrics.webhookMetrics.totalEvents,
        successful: this.metrics.webhookMetrics.successfulEvents,
        failed: this.metrics.webhookMetrics.failedEvents,
        successRate:
          this.metrics.webhookMetrics.totalEvents > 0
            ? (
                (this.metrics.webhookMetrics.successfulEvents /
                  this.metrics.webhookMetrics.totalEvents) *
                100
              ).toFixed(2)
            : 0
      },
      resources: {
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          usagePercent: heapUsagePercent
        },
        uptime: process.uptime()
      },
      alerts: this.alerts.slice(-20) // 최근 20개 알림
    };
  }

  /**
   * 특정 기간의 통계
   */
  getTimeSeries(minutes = 60) {
    const now = new Date();
    const series = [];

    for (let i = minutes - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      const minuteKey = time.toISOString().slice(0, 16);

      const data = this.metrics.minuteData[minuteKey];
      if (data) {
        series.push({
          minute: minuteKey,
          requests: data.requests,
          errors: data.errors,
          avgTime:
            data.requests > 0
              ? Math.round(data.totalTime / data.requests)
              : 0
        });
      } else {
        series.push({
          minute: minuteKey,
          requests: 0,
          errors: 0,
          avgTime: 0
        });
      }
    }

    return series;
  }

  /**
   * 알림 조회
   */
  getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  /**
   * 알림 임계값 설정
   */
  setAlertThreshold(type, value) {
    if (this.alertThresholds.hasOwnProperty(type)) {
      this.alertThresholds[type] = value;
      return { success: true, message: `${type} 임계값 업데이트: ${value}` };
    }
    return {
      success: false,
      error: `Unknown threshold type: ${type}`
    };
  }

  /**
   * 메트릭 리셋
   */
  reset() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalSuccesses: 0,
      minuteData: {},
      responseTimes: [],
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      p95ResponseTime: 0,
      endpoints: {},
      webhookMetrics: {
        totalWebhooks: 0,
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        avgProcessingTime: 0
      },
      statusCodes: {},
      startTime: Date.now(),
      lastUpdated: Date.now()
    };
    this.alerts = [];

    return { success: true, message: 'Metrics reset' };
  }

  /**
   * 상태 보고서
   */
  getHealthReport() {
    const errorRate =
      this.metrics.totalRequests > 0
        ? this.metrics.totalErrors / this.metrics.totalRequests
        : 0;

    const memUsage = process.memoryUsage();
    const heapUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

    let status = 'healthy';
    const issues = [];

    if (errorRate > this.alertThresholds.errorRateThreshold) {
      status = 'degraded';
      issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    if (
      this.metrics.avgResponseTime >
      this.alertThresholds.responseTimeThreshold
    ) {
      status = 'degraded';
      issues.push(
        `Slow response time: ${Math.round(this.metrics.avgResponseTime)}ms`
      );
    }

    if (heapUsagePercent > this.alertThresholds.memoryUsageThreshold) {
      status = 'critical';
      issues.push(
        `High memory usage: ${(heapUsagePercent * 100).toFixed(2)}%`
      );
    }

    return {
      status,
      issues,
      metrics: {
        errorRate: (errorRate * 100).toFixed(2),
        avgResponseTime: Math.round(this.metrics.avgResponseTime),
        memoryUsagePercent: (heapUsagePercent * 100).toFixed(2),
        uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000)
      }
    };
  }
}

export default MonitoringSystem;
