/**
 * Webhook Manager - GOGS Webhook 통합 관리
 * 
 * 역할:
 * - Webhook 등록/해제
 * - 이벤트 감지 및 라우팅
 * - 이벤트 히스토리 추적
 * - 재시도 로직
 */

class WebhookManager {
  constructor(indexer, validator) {
    this.indexer = indexer;
    this.validator = validator;

    // 등록된 Webhook 목록
    this.webhooks = new Map();

    // 이벤트 히스토리
    this.eventHistory = [];
    this.maxHistory = 1000;

    // 통계
    this.stats = {
      totalWebhooks: 0,
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      lastEventTime: null
    };
  }

  /**
   * Webhook 등록
   */
  registerWebhook(webhookId, config) {
    // 기본 검증
    if (!webhookId || typeof webhookId !== 'string') {
      return { success: false, error: 'Invalid webhookId' };
    }

    if (this.webhooks.has(webhookId)) {
      return { success: false, error: `Webhook ID '${webhookId}' already exists` };
    }

    const { repositoryId, repositoryName, url, events, secret } = config;

    // URL 검증
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return { success: false, error: 'url is required and must be non-empty string' };
    }

    // 이벤트 배열 검증
    if (!events || !Array.isArray(events) || events.length === 0) {
      return { success: false, error: 'events must be non-empty array' };
    }

    // 유효한 이벤트 타입 확인
    const validEvents = ['push', 'create', 'delete'];
    for (const event of events) {
      if (!validEvents.includes(event)) {
        return { success: false, error: `Invalid event type: ${event}` };
      }
    }

    // Webhook ID 포맷 검증 (alphanumeric, hyphen, underscore만 허용)
    if (!/^[a-zA-Z0-9_-]+$/.test(webhookId)) {
      return { success: false, error: 'webhookId must contain only alphanumeric characters, hyphens, and underscores' };
    }

    this.webhooks.set(webhookId, {
      id: webhookId,
      repositoryId,
      repositoryName,
      url,
      events: events || ['push', 'create', 'delete'],
      secret,
      registeredAt: new Date().toISOString(),
      status: 'active',
      lastTriggeredAt: null,
      eventCount: 0
    });

    this.stats.totalWebhooks++;

    console.log(`✅ Webhook 등록: ${webhookId} (${repositoryName})`);
    console.log(`   イベント: ${this.webhooks.get(webhookId).events.join(', ')}`);

    return { success: true, webhookId, webhook: this.webhooks.get(webhookId) };
  }

  /**
   * Webhook 해제
   */
  unregisterWebhook(webhookId) {
    if (!this.webhooks.has(webhookId)) {
      console.warn(`⚠️  Webhook 없음: ${webhookId}`);
      return { success: false, error: 'Webhook not found' };
    }

    const webhook = this.webhooks.get(webhookId);
    this.webhooks.delete(webhookId);

    console.log(`🗑️  Webhook 해제: ${webhookId} (${webhook.repositoryName})`);

    return { success: true };
  }

  /**
   * 이벤트 처리
   */
  async handleEvent(payload) {
    const startTime = Date.now();

    // 페이로드 검증 (validator가 있으면 사용, 없으면 기본 검증)
    if (this.validator) {
      const validation = this.validator.validateWebhookPayload(payload);
      if (!validation.valid) {
        return {
          processed: false,
          success: false,
          error: validation.error,
          duration: Date.now() - startTime
        };
      }
    } else {
      // 기본 검증
      if (!payload || typeof payload !== 'object') {
        return {
          processed: false,
          success: false,
          error: 'Invalid payload',
          duration: Date.now() - startTime
        };
      }

      if (!payload.action || !payload.repository) {
        return {
          processed: false,
          success: false,
          error: 'Missing required fields: action, repository',
          duration: Date.now() - startTime
        };
      }
    }

    const { action, repository } = payload;

    // 관련 Webhook 찾기
    const webhooks = Array.from(this.webhooks.values()).filter(w =>
      w.events.includes(action)
    );

    if (webhooks.length === 0) {
      return {
        processed: false,
        success: false,
        error: `No webhooks registered for ${action} event`,
        triggeredWebhooks: 0,
        duration: Date.now() - startTime
      };
    }

    const results = [];

    for (const webhook of webhooks) {
      try {
        // 인덱서를 통해 이벤트 처리 (인덱서가 있으면)
        let result = { success: true };
        if (this.indexer && this.indexer.handleWebhookEvent) {
          result = await this.indexer.handleWebhookEvent({
            action,
            repository
          });
        }

        webhook.lastTriggeredAt = new Date().toISOString();
        webhook.eventCount++;

        results.push({
          webhookId: webhook.id,
          success: result.success,
          message: result.message
        });

        if (result.success) {
          this.stats.successfulEvents++;
        } else {
          this.stats.failedEvents++;
        }
      } catch (error) {
        console.error(`❌ Webhook 처리 실패: ${webhook.id}`, error.message);

        results.push({
          webhookId: webhook.id,
          success: false,
          error: error.message
        });

        this.stats.failedEvents++;
      }
    }

    // 이벤트 기록
    const eventRecord = {
      timestamp: new Date().toISOString(),
      action,
      repository: repository.full_name || repository.name || 'unknown',
      webhookCount: webhooks.length,
      results,
      duration: Date.now() - startTime
    };

    this.eventHistory.push(eventRecord);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }

    this.stats.totalEvents++;
    this.stats.lastEventTime = eventRecord.timestamp;

    console.log(`📨 Webhook 이벤트 처리: ${action} (${eventRecord.repository})`);
    console.log(`   결과: ${results.filter(r => r.success).length}/${results.length} 성공`);

    return {
      processed: true,
      success: true,
      results,
      triggeredWebhooks: webhooks.length,
      duration: eventRecord.duration
    };
  }

  /**
   * 이벤트 히스토리 조회
   */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Webhook 목록 조회
   */
  listWebhooks() {
    return Array.from(this.webhooks.values());
  }

  /**
   * Webhook 상세 조회
   */
  getWebhook(webhookId) {
    return this.webhooks.get(webhookId) || null;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalEvents > 0
        ? ((this.stats.successfulEvents / this.stats.totalEvents) * 100).toFixed(1)
        : 'N/A'
    };
  }

  /**
   * 재시도 로직 (실패한 Webhook)
   */
  async retryFailedEvents() {
    const failedEvents = this.eventHistory.filter(e =>
      e.results && e.results.some(r => !r.success)
    );

    console.log(`🔄 실패한 이벤트 재시도: ${failedEvents.length}개`);

    let retryCount = 0;
    for (const event of failedEvents.slice(-10)) {
      // 최근 10개만 재시도
      try {
        await this.handleEvent({
          action: event.action,
          repository: { full_name: event.repository, name: event.repository }
        });
        retryCount++;
      } catch (error) {
        console.error(`❌ 재시도 실패: ${event.repository}`, error.message);
      }
    }

    return {
      success: true,
      retriedCount: retryCount,
      totalAttempted: failedEvents.length
    };
  }

  /**
   * 테스트 이벤트 시뮬레이션
   */
  async simulateEvent(action, repositoryName) {
    return await this.handleEvent({
      action,
      repository: {
        id: Math.floor(Math.random() * 10000),
        full_name: repositoryName,
        clone_url: `https://gogs.dclub.kr/${repositoryName}.git`
      }
    });
  }

  /**
   * Webhook 정상 상태 확인
   */
  healthCheck() {
    const activeWebhooks = Array.from(this.webhooks.values())
      .filter(w => w.status === 'active').length;

    const successRate = this.stats.totalEvents > 0
      ? ((this.stats.successfulEvents / this.stats.totalEvents) * 100).toFixed(1)
      : 'N/A';

    return {
      status: activeWebhooks > 0 ? 'healthy' : 'no_webhooks',
      webhookCount: this.webhooks.size,
      totalWebhooks: this.webhooks.size,
      activeWebhooks,
      uptime: Math.floor(process.uptime()),
      eventCount: this.stats.totalEvents,
      successRate,
      lastEvent: this.stats.lastEventTime
    };
  }
}

export default WebhookManager;
