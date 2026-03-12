/**
 * Rate Limiter - API 요청 제한
 * 
 * 역할:
 * - IP/클라이언트별 요청 제한
 * - 시간 윈도우 기반 제한 (Token Bucket)
 * - DDoS 방어
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;      // 시간당 요청 수
    this.windowMs = options.windowMs || 3600 * 1000;    // 1시간
    this.buckets = new Map();                            // IP별 토큰 버킷

    // 정리 작업 (1시간마다 오래된 엔트리 제거)
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.windowMs
    );
  }

  /**
   * IP별 요청 카운트 초기화
   */
  initBucket(ip) {
    this.buckets.set(ip, {
      count: 0,
      resetTime: Date.now() + this.windowMs,
      tokens: this.maxRequests
    });
  }

  /**
   * 요청 가능 여부 확인
   */
  isAllowed(ip) {
    if (!this.buckets.has(ip)) {
      this.initBucket(ip);
    }

    const bucket = this.buckets.get(ip);
    const now = Date.now();

    // 시간 윈도우 초과 시 리셋
    if (now > bucket.resetTime) {
      this.initBucket(ip);
    }

    // 토큰 차감
    if (bucket.tokens > 0) {
      bucket.tokens--;
      bucket.count++;
      return true;
    }

    return false;
  }

  /**
   * 요청 상태 조회
   */
  getStatus(ip) {
    if (!this.buckets.has(ip)) {
      this.initBucket(ip);
    }

    const bucket = this.buckets.get(ip);
    const now = Date.now();
    const remainingMs = Math.max(0, bucket.resetTime - now);

    return {
      ip,
      allowed: bucket.tokens > 0,
      tokensRemaining: bucket.tokens,
      requestsInWindow: bucket.count,
      maxRequests: this.maxRequests,
      resetIn: `${Math.ceil(remainingMs / 1000)}s`,
      resetTime: new Date(bucket.resetTime).toISOString()
    };
  }

  /**
   * 오래된 버킷 정리
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [ip, bucket] of this.buckets.entries()) {
      if (now > bucket.resetTime) {
        toDelete.push(ip);
      }
    }

    toDelete.forEach(ip => this.buckets.delete(ip));
    console.log(`🧹 Rate limiter 정리: ${toDelete.length}개 엔트리 제거`);
  }

  /**
   * 모든 버킷 초기화
   */
  reset() {
    this.buckets.clear();
    console.log('🔄 Rate limiter 초기화');
  }

  /**
   * 정리 작업 중단
   */
  destroy() {
    clearInterval(this.cleanupInterval);
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      activeBuckets: this.buckets.size,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      buckets: Array.from(this.buckets.entries()).map(([ip, bucket]) => ({
        ip,
        tokens: bucket.tokens,
        count: bucket.count,
        resetTime: new Date(bucket.resetTime).toISOString()
      }))
    };
  }
}

export default RateLimiter;
