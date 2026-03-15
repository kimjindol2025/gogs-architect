#!/usr/bin/env node

/**
 * Gogs AI Architect - REST API Server v2
 * 
 * 보안 계층 통합 버전:
 * - Database Integration (영속성)
 * - Rate Limiter (DDoS 방어)
 * - Input Validator (입력 검증)
 * - Structured Logging
 */

import http from 'http';
import url from 'url';
import DatabaseIntegration from './database-integration.js';
import RateLimiter from './rate-limiter.js';
import InputValidator from './input-validator.js';
import SearchEnhanced from './search-enhanced.js';
import AutoIndexer from './auto-indexer.js';

class APIServerV2 {
  constructor(port = 3000, options = {}) {
    this.port = port;

    // 보안 계층
    this.db = new DatabaseIntegration(options.dataDir || './data');
    this.rateLimiter = new RateLimiter(options.rateLimiter || {});
    this.validator = new InputValidator(options.validator || {});

    // 검색 및 인덱싱
    this.search = new SearchEnhanced(this.db, null, null);
    this.indexer = new AutoIndexer(null, this.db, this.search);

    // 요청 로그
    this.requestLog = [];
    this.maxLogs = options.maxLogs || 1000;

    // 통계
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      startTime: new Date().toISOString(),
      endpointStats: {}
    };

    this.server = null;
  }

  /**
   * 공통 응답 형식
   */
  jsonResponse(res, statusCode, data, metadata = {}) {
    const response = {
      status: statusCode >= 400 ? 'error' : 'success',
      code: statusCode,
      timestamp: new Date().toISOString(),
      ...data,
      meta: {
        version: '2.0.0',
        ...metadata
      }
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
  }

  /**
   * 요청 본문 파싱
   */
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1024 * 100) { // 100KB 제한
          reject(new Error('Payload too large'));
        }
      });

      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * 요청 로깅
   */
  logRequest(req, endpoint, statusCode, metadata = {}) {
    const now = new Date().toISOString();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const log = {
      timestamp: now,
      method: req.method,
      endpoint,
      statusCode,
      clientIp,
      userAgent: req.headers['user-agent'],
      ...metadata
    };

    this.requestLog.push(log);

    // 로그 크기 제한
    if (this.requestLog.length > this.maxLogs) {
      this.requestLog = this.requestLog.slice(-this.maxLogs);
    }

    console.log(`[${statusCode}] ${req.method} ${endpoint} (${clientIp})`);
  }

  /**
   * 검색 엔드포인트
   */
  async handleSearch(req, res) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Rate limiting 확인
    if (!this.rateLimiter.isAllowed(clientIp)) {
      this.logRequest(req, '/api/v1/search', 429, { reason: 'rate_limit' });
      return this.jsonResponse(res, 429, {
        data: { error: 'Too many requests' },
        meta: this.rateLimiter.getStatus(clientIp)
      });
    }

    try {
      const body = await this.parseBody(req);

      // 입력 검증
      const validation = this.validator.validateSearchQuery(body.query);
      if (!validation.valid) {
        this.logRequest(req, '/api/v1/search', 400, { reason: validation.error });
        return this.jsonResponse(res, 400, {
          data: { error: validation.error }
        });
      }

      // 검색 실행
      const startTime = Date.now();
      const results = this.search.searchAdvanced(body.query);
      const duration = Date.now() - startTime;

      this.logRequest(req, '/api/v1/search', 200, {
        duration,
        resultCount: results.usages.length
      });

      this.jsonResponse(res, 200, {
        data: results
      }, { responseTime: `${duration}ms` });
    } catch (error) {
      this.stats.totalErrors++;
      this.logRequest(req, '/api/v1/search', 400, { error: error.message });
      this.jsonResponse(res, 400, {
        data: { error: error.message }
      });
    }
  }

  /**
   * 3단어 분석 엔드포인트
   */
  async handleThreeWords(req, res) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Rate limiting
    if (!this.rateLimiter.isAllowed(clientIp)) {
      this.logRequest(req, '/api/v1/search/three-words', 429);
      return this.jsonResponse(res, 429, {
        data: { error: 'Too many requests' }
      });
    }

    try {
      const body = await this.parseBody(req);

      // 입력 검증
      const validation = this.validator.validateThreeWordQuery(body.words || []);
      if (!validation.valid) {
        this.logRequest(req, '/api/v1/search/three-words', 400);
        return this.jsonResponse(res, 400, {
          data: { error: validation.error }
        });
      }

      // 3단어 분석
      const startTime = Date.now();
      const results = {
        query: body.words,
        matches: body.words.map(word => ({
          word,
          usages: this.search.findUsages(word)
        })),
        timestamp: new Date().toISOString()
      };
      const duration = Date.now() - startTime;

      this.logRequest(req, '/api/v1/search/three-words', 200, { duration });
      this.jsonResponse(res, 200, { data: results }, { responseTime: `${duration}ms` });
    } catch (error) {
      this.stats.totalErrors++;
      this.logRequest(req, '/api/v1/search/three-words', 400);
      this.jsonResponse(res, 400, {
        data: { error: error.message }
      });
    }
  }

  /**
   * 에이전트 상태 엔드포인트
   */
  async handleAgentStatus(req, res) {
    try {
      const status = {
        agent: this.indexer.getStatus(),
        database: this.db.getStats(),
        rateLimiter: this.rateLimiter.getStats(),
        api: this.stats
      };

      this.logRequest(req, '/api/v1/agent/status', 200);
      this.jsonResponse(res, 200, { data: status });
    } catch (error) {
      this.stats.totalErrors++;
      this.logRequest(req, '/api/v1/agent/status', 500);
      this.jsonResponse(res, 500, {
        data: { error: error.message }
      });
    }
  }

  /**
   * Webhook 수신 엔드포인트
   */
  async handleWebhook(req, res) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Rate limiting (더 엄격함)
    const webhookLimiter = new RateLimiter({ maxRequests: 100, windowMs: 3600000 });
    if (!webhookLimiter.isAllowed(clientIp)) {
      this.logRequest(req, '/api/v1/webhook/gogs', 429);
      return this.jsonResponse(res, 429, {
        data: { error: 'Too many webhook events' }
      });
    }

    try {
      const payload = await this.parseBody(req);

      // Webhook 페이로드 검증
      const validation = this.validator.validateWebhookPayload(payload);
      if (!validation.valid) {
        this.logRequest(req, '/api/v1/webhook/gogs', 400);
        return this.jsonResponse(res, 400, {
          data: { error: validation.error }
        });
      }

      // Webhook 이벤트 처리
      await this.indexer.handleWebhookEvent(payload);

      this.logRequest(req, '/api/v1/webhook/gogs', 200);
      this.jsonResponse(res, 200, {
        data: { message: 'Webhook processed' }
      });
    } catch (error) {
      this.stats.totalErrors++;
      this.logRequest(req, '/api/v1/webhook/gogs', 500);
      this.jsonResponse(res, 500, {
        data: { error: error.message }
      });
    }
  }

  /**
   * 저장소 목록 엔드포인트
   */
  async handleRepositories(req, res) {
    try {
      const repos = this.db.getRepositories();

      this.logRequest(req, '/api/v1/repositories', 200);
      this.jsonResponse(res, 200, {
        data: {
          repositories: repos,
          count: repos.length
        }
      });
    } catch (error) {
      this.stats.totalErrors++;
      this.logRequest(req, '/api/v1/repositories', 500);
      this.jsonResponse(res, 500, {
        data: { error: error.message }
      });
    }
  }

  /**
   * 헬스 체크 엔드포인트
   */
  async handleHealth(req, res) {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      components: {
        database: 'online',
        search: 'online',
        indexer: 'online'
      }
    };

    this.jsonResponse(res, 200, { data: health });
  }

  /**
   * 요청 로그 엔드포인트
   */
  async handleLogs(req, res) {
    try {
      this.jsonResponse(res, 200, {
        data: {
          logs: this.requestLog,
          count: this.requestLog.length,
          maxSize: this.maxLogs
        }
      });
    } catch (error) {
      this.jsonResponse(res, 500, {
        data: { error: error.message }
      });
    }
  }

  /**
   * 라우터
   */
  async handleRequest(req, res) {
    this.stats.totalRequests++;

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      // CORS 헤더
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // 라우팅
      if (pathname === '/api/v1/search' && method === 'POST') {
        return await this.handleSearch(req, res);
      } else if (pathname === '/api/v1/search/three-words' && method === 'POST') {
        return await this.handleThreeWords(req, res);
      } else if (pathname === '/api/v1/agent/status' && method === 'GET') {
        return await this.handleAgentStatus(req, res);
      } else if (pathname === '/api/v1/webhook/gogs' && method === 'POST') {
        return await this.handleWebhook(req, res);
      } else if (pathname === '/api/v1/repositories' && method === 'GET') {
        return await this.handleRepositories(req, res);
      } else if (pathname === '/health' && method === 'GET') {
        return await this.handleHealth(req, res);
      } else if (pathname === '/logs' && method === 'GET') {
        return await this.handleLogs(req, res);
      } else {
        this.logRequest(req, pathname, 404);
        return this.jsonResponse(res, 404, {
          data: { error: 'Endpoint not found' }
        });
      }
    } catch (error) {
      this.stats.totalErrors++;
      console.error('❌ 서버 에러:', error);
      this.jsonResponse(res, 500, {
        data: { error: 'Internal server error' }
      });
    }
  }

  /**
   * 서버 시작
   */
  start() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.port, () => {
      console.log(`🚀 API Server v2.0 시작 (포트 ${this.port})`);
      console.log(`📊 보안 계층:`);
      console.log(`   ✅ Database Integration`);
      console.log(`   ✅ Rate Limiter`);
      console.log(`   ✅ Input Validator`);
      console.log(`   ✅ Request Logging`);
    });
  }

  /**
   * 서버 종료
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.rateLimiter.destroy();
      console.log('🛑 API Server 종료');
    }
  }
}

export default APIServerV2;

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new APIServerV2(3000);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}
