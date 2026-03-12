#!/usr/bin/env node

/**
 * Gogs AI Architect - REST API Server v3 (모니터링 포함)
 *
 * Phase 2 개선사항:
 * - MonitoringSystem 통합
 * - 모든 요청에서 통계 수집
 * - /metrics 엔드포인트
 * - /health 상세 정보
 * - 웹 대시보드 제공
 */

import http from 'http';
import url from 'url';
import SearchEnhanced from './search-enhanced.js';
import AutoIndexer from './auto-indexer.js';
import KnowledgeBase from './knowledge-base.js';
import Embedder from './embedder.js';
import PatternAnalyzer from './pattern-analyzer.js';
import DatabaseIntegration from './database-integration.js';
import RateLimiter from './rate-limiter.js';
import InputValidator from './input-validator.js';
import WebhookManager from './webhook-manager.js';
import MonitoringSystem from './monitoring-system.js';

// API 서버 클래스
class APIServerV3 {
  constructor(port = 3000) {
    this.port = port;
    this.kb = new KnowledgeBase();
    this.embedder = new Embedder(this.kb);
    this.analyzer = new PatternAnalyzer();
    this.search = new SearchEnhanced(this.kb, this.embedder, this.analyzer);
    this.indexer = new AutoIndexer(null, this.kb, this.search);
    this.db = new DatabaseIntegration();
    this.rateLimiter = new RateLimiter();
    this.validator = new InputValidator();
    this.webhookManager = new WebhookManager(this.indexer, this.validator);
    this.monitoring = new MonitoringSystem();

    this.server = null;
  }

  // 공통 응답 형식
  jsonResponse(res, statusCode, data) {
    const response = {
      status: statusCode >= 400 ? 'error' : 'success',
      timestamp: new Date().toISOString(),
      ...data
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
  }

  // 요청 본문 파싱
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
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

  // 라우터
  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const startTime = Date.now();

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

      // Rate Limiting
      if (!this.rateLimiter.isAllowed(clientIp)) {
        const responseTime = Date.now() - startTime;
        this.monitoring.recordRequest(pathname, 429, responseTime);
        return this.jsonResponse(res, 429, {
          code: 'RATE_LIMITED',
          message: 'Too many requests'
        });
      }

      // 라우팅
      if (pathname === '/api/v1/search' && method === 'POST') {
        await this.handleSearch(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/search/three-words' && method === 'POST') {
        await this.handleThreeWords(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/agent/status' && method === 'GET') {
        await this.handleAgentStatus(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/agent/index' && method === 'POST') {
        await this.handleAgentIndex(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/webhook/gogs' && method === 'POST') {
        await this.handleWebhook(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/repositories' && method === 'GET') {
        await this.handleRepositories(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/metrics' && method === 'GET') {
        await this.handleMetrics(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/alerts' && method === 'GET') {
        await this.handleAlerts(req, res, startTime, pathname);
      }
      else if (pathname === '/api/v1/health' && method === 'GET') {
        await this.handleHealthDetail(req, res, startTime, pathname);
      }
      else if (pathname === '/dashboard' && method === 'GET') {
        this.handleDashboard(req, res);
      }
      else if (pathname === '/health' && method === 'GET') {
        this.jsonResponse(res, 200, { message: 'API Server is running' });
        this.monitoring.recordRequest(pathname, 200, Date.now() - startTime);
      }
      else if (pathname === '/' && method === 'GET') {
        this.handleDocs(req, res);
      }
      else {
        this.jsonResponse(res, 404, {
          code: 'NOT_FOUND',
          message: 'Not Found'
        });
        this.monitoring.recordRequest(pathname, 404, Date.now() - startTime);
      }
    } catch (error) {
      console.error('Error:', error);
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  // 검색 API
  async handleSearch(req, res, startTime, pathname) {
    try {
      const body = await this.parseBody(req);
      const { query } = body;

      const validation = this.validator.validateSearchQuery(query);
      if (!validation.valid) {
        const responseTime = Date.now() - startTime;
        this.monitoring.recordRequest(pathname, 400, responseTime);
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: validation.error
        });
      }

      const result = this.search.searchAdvanced(query);
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: result
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'SEARCH_FAILED',
        message: error.message
      });
    }
  }

  // 3단어 분석
  async handleThreeWords(req, res, startTime, pathname) {
    try {
      const body = await this.parseBody(req);
      const { words } = body;

      const validation = this.validator.validateThreeWordQuery(words);
      if (!validation.valid) {
        const responseTime = Date.now() - startTime;
        this.monitoring.recordRequest(pathname, 400, responseTime);
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: validation.error
        });
      }

      const results = [];
      let foundCount = 0;

      for (const word of words) {
        const usages = this.search.findUsages(word);
        const found = usages.length > 0;
        if (found) foundCount++;

        results.push({
          word,
          found,
          count: usages.length,
          locations: usages.slice(0, 2)
        });
      }

      const rating = foundCount === 3 ? '⭐⭐⭐⭐⭐ 완벽 매칭' :
                     foundCount === 2 ? '⭐⭐⭐⭐ 높은 관련성' :
                     foundCount === 1 ? '⭐⭐⭐ 부분적 일치' :
                     '⭐ 미발견';

      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: {
          words,
          results,
          analysis: {
            matchScore: foundCount,
            rating,
            matchPercentage: Math.round((foundCount / 3) * 100)
          }
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'ANALYSIS_FAILED',
        message: error.message
      });
    }
  }

  // 에이전트 상태
  async handleAgentStatus(req, res, startTime, pathname) {
    try {
      const status = this.indexer.getStatus();
      const report = this.indexer.generateReport();

      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: {
          status,
          report
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'AGENT_ERROR',
        message: error.message
      });
    }
  }

  // 에이전트 수동 인덱싱
  async handleAgentIndex(req, res, startTime, pathname) {
    try {
      const body = await this.parseBody(req);
      const { repositoryId, repositoryName, repositoryUrl, action, priority } = body;

      if (!repositoryId) {
        const responseTime = Date.now() - startTime;
        this.monitoring.recordRequest(pathname, 400, responseTime);
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: 'repositoryId is required'
        });
      }

      this.indexer.enqueueRepository({
        id: repositoryId,
        name: repositoryName || repositoryId,
        url: repositoryUrl,
        action: action || 'update',
        priority: priority || 'normal'
      });

      const status = this.indexer.getStatus();
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        message: '저장소가 인덱싱 큐에 추가되었습니다',
        data: {
          repositoryId,
          queueSize: status.queueSize,
          isIndexing: status.isIndexing
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'INDEXING_ERROR',
        message: error.message
      });
    }
  }

  // Webhook 수신
  async handleWebhook(req, res, startTime, pathname) {
    try {
      const body = await this.parseBody(req);
      const { action, repository } = body;

      const validation = this.validator.validateWebhookPayload(body);
      if (!validation.valid) {
        const responseTime = Date.now() - startTime;
        this.monitoring.recordRequest(pathname, 400, responseTime, true);
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: validation.error
        });
      }

      // 웹훅 처리
      await this.webhookManager.handleEvent(body);

      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime, true);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        message: '웹훅 이벤트가 처리되었습니다',
        data: {
          action,
          repositoryId: repository.id,
          repositoryName: repository.full_name
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime, true);
      this.jsonResponse(res, 500, {
        code: 'WEBHOOK_ERROR',
        message: error.message
      });
    }
  }

  // 저장소 관리
  async handleRepositories(req, res, startTime, pathname) {
    try {
      const repositories = [
        {
          id: 'freelang-v6',
          name: 'FreeLang v6 (Core)',
          url: 'https://gogs.dclub.kr/kim/freelang-v6.git',
          status: 'indexed',
          fileCount: 86,
          chunkCount: 450,
          lastIndexed: new Date().toISOString(),
          language: 'TypeScript'
        },
        {
          id: 'freelang-sql',
          name: 'FreeLang SQL',
          url: 'https://gogs.dclub.kr/kim/freelang-sql.git',
          status: 'indexed',
          fileCount: 9,
          chunkCount: 127,
          lastIndexed: new Date().toISOString(),
          language: 'TypeScript'
        }
      ];

      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 200, responseTime);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: {
          total: repositories.length,
          repositories
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.monitoring.recordRequest(pathname, 500, responseTime);
      this.jsonResponse(res, 500, {
        code: 'REPOSITORY_ERROR',
        message: error.message
      });
    }
  }

  // 메트릭 조회
  async handleMetrics(req, res, startTime, pathname) {
    const responseTime = Date.now() - startTime;
    this.monitoring.recordRequest(pathname, 200, responseTime);

    const data = this.monitoring.getDashboardData();
    this.jsonResponse(res, 200, {
      code: 'SUCCESS',
      data
    });
  }

  // 알림 조회
  async handleAlerts(req, res, startTime, pathname) {
    const responseTime = Date.now() - startTime;
    this.monitoring.recordRequest(pathname, 200, responseTime);

    const alerts = this.monitoring.getAlerts();
    this.jsonResponse(res, 200, {
      code: 'SUCCESS',
      data: {
        total: alerts.length,
        alerts
      }
    });
  }

  // 헬스 체크 (상세)
  async handleHealthDetail(req, res, startTime, pathname) {
    const responseTime = Date.now() - startTime;
    this.monitoring.recordRequest(pathname, 200, responseTime);

    const health = this.monitoring.getHealthReport();
    this.jsonResponse(res, 200, {
      code: 'SUCCESS',
      data: health
    });
  }

  // 웹 대시보드
  handleDashboard(req, res) {
    const dashboard = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gogs AI Architect Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      color: white;
      margin-bottom: 30px;
      text-align: center;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 0.95em;
      opacity: 0.9;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .metric-card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s;
    }

    .metric-card:hover {
      transform: translateY(-5px);
    }

    .metric-label {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }

    .metric-unit {
      font-size: 0.6em;
      color: #999;
      margin-left: 5px;
    }

    .metric-status {
      margin-top: 10px;
      font-size: 0.85em;
      color: #666;
    }

    .status-healthy { color: #27ae60; }
    .status-warning { color: #f39c12; }
    .status-critical { color: #e74c3c; }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .chart-card {
      background: white;
      border-radius: 10px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .chart-title {
      font-size: 1.2em;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
    }

    .chart-area {
      height: 300px;
      background: #f5f5f5;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    .endpoints-card,
    .alerts-card {
      background: white;
      border-radius: 10px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      margin-bottom: 30px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    tr:hover {
      background: #f9f9f9;
    }

    .endpoint-name {
      font-family: 'Courier New', monospace;
      color: #667eea;
      font-weight: 500;
    }

    .alert-item {
      padding: 15px;
      margin-bottom: 10px;
      border-left: 4px solid #f39c12;
      background: #fff8e1;
      border-radius: 4px;
    }

    .alert-warning { border-left-color: #f39c12; background: #fff8e1; }
    .alert-critical { border-left-color: #e74c3c; background: #ffe8e8; }

    .alert-time {
      font-size: 0.85em;
      color: #666;
      margin-top: 5px;
    }

    .footer {
      text-align: center;
      color: white;
      opacity: 0.9;
      margin-top: 30px;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 1.8em;
      }

      .charts-grid {
        grid-template-columns: 1fr;
      }

      .metric-value {
        font-size: 1.5em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Gogs AI Architect</h1>
      <p class="subtitle">실시간 모니터링 대시보드</p>
    </header>

    <div id="metrics-container" class="metrics-grid">
      <!-- JavaScript로 채워짐 -->
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">📈 시간별 요청</div>
        <div class="chart-area">차트 렌더링 중...</div>
      </div>
      <div class="chart-card">
        <div class="chart-title">⏱️ 응답 시간 (ms)</div>
        <div class="chart-area">차트 렌더링 중...</div>
      </div>
    </div>

    <div class="endpoints-card">
      <h2 class="chart-title">🔗 엔드포인트 성능</h2>
      <table id="endpoints-table">
        <thead>
          <tr>
            <th>엔드포인트</th>
            <th>요청</th>
            <th>에러</th>
            <th>에러율</th>
            <th>평균 시간</th>
          </tr>
        </thead>
        <tbody>
          <!-- JavaScript로 채워짐 -->
        </tbody>
      </table>
    </div>

    <div class="alerts-card">
      <h2 class="chart-title">🔔 최근 알림</h2>
      <div id="alerts-container">
        <!-- JavaScript로 채워짐 -->
      </div>
    </div>

    <div class="footer">
      <p>마지막 업데이트: <span id="update-time">--:--:--</span></p>
      <p>자동 새로고침: 10초마다</p>
    </div>
  </div>

  <script>
    async function updateDashboard() {
      try {
        const response = await fetch('/api/v1/metrics');
        const result = await response.json();

        if (result.status !== 'success') {
          console.error('Failed to fetch metrics');
          return;
        }

        const data = result.data;

        // 메트릭 카드 업데이트
        const metricsHtml = \`
          <div class="metric-card">
            <div class="metric-label">총 요청</div>
            <div class="metric-value">\${data.summary.totalRequests.toLocaleString()}</div>
            <div class="metric-status">가동 중: \${Math.floor(data.summary.uptime)}초</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">에러율</div>
            <div class="metric-value">\${data.summary.errorRate}%</div>
            <div class="metric-status \${parseFloat(data.summary.errorRate) > 5 ? 'status-warning' : 'status-healthy'}">\${parseFloat(data.summary.errorRate) > 5 ? '⚠️ 높음' : '✅ 정상'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">평균 응답 시간</div>
            <div class="metric-value">\${data.performance.avgResponseTime}<span class="metric-unit">ms</span></div>
            <div class="metric-status">P95: \${data.performance.p95ResponseTime}ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">메모리 사용</div>
            <div class="metric-value">\${data.resources.memory.usagePercent}%</div>
            <div class="metric-status \${parseFloat(data.resources.memory.usagePercent) > 80 ? 'status-critical' : 'status-healthy'}">\${data.resources.memory.heapUsed}MB / \${data.resources.memory.heapTotal}MB</div>
          </div>
        \`;

        document.getElementById('metrics-container').innerHTML = metricsHtml;

        // 엔드포인트 테이블 업데이트
        const endpointsHtml = data.endpoints.map(ep => \`
          <tr>
            <td><span class="endpoint-name">\${ep.endpoint}</span></td>
            <td>\${ep.requests}</td>
            <td>\${ep.errors}</td>
            <td>\${ep.errorRate}%</td>
            <td>\${ep.avgTime}ms</td>
          </tr>
        \`).join('');

        document.querySelector('#endpoints-table tbody').innerHTML = endpointsHtml;

        // 알림 업데이트
        const alertsHtml = data.alerts.map(alert => \`
          <div class="alert-item alert-\${alert.level}">
            <strong>[\${alert.type.toUpperCase()}]</strong> \${alert.message}
            <div class="alert-time">\${new Date(alert.timestamp).toLocaleTimeString()}</div>
          </div>
        \`).join('') || '<p style="color: #666;">알림 없음</p>';

        document.getElementById('alerts-container').innerHTML = alertsHtml;

        // 시간 업데이트
        document.getElementById('update-time').textContent = new Date().toLocaleTimeString();

      } catch (error) {
        console.error('Dashboard update error:', error);
      }
    }

    // 초기 로드
    updateDashboard();

    // 10초마다 업데이트
    setInterval(updateDashboard, 10000);
  </script>
</body>
</html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboard);
  }

  // API 문서
  handleDocs(req, res) {
    const docs = `
<!DOCTYPE html>
<html>
<head>
  <title>Gogs AI Architect API v3</title>
  <style>
    body { font-family: monospace; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
    code { background: #eee; padding: 2px 6px; }
  </style>
</head>
<body>
  <h1>🚀 Gogs AI Architect API v3.0</h1>

  <h2>📚 엔드포인트</h2>

  <div class="endpoint">
    <h3>POST /api/v1/search</h3>
    <p>코드 패턴 검색</p>
    <code>{"query": "useState"}</code>
  </div>

  <div class="endpoint">
    <h3>POST /api/v1/search/three-words</h3>
    <p>3단어 AI 분석</p>
    <code>{"words": ["sql", "parser", "aws"]}</code>
  </div>

  <div class="endpoint">
    <h3>GET /api/v1/agent/status</h3>
    <p>에이전트 상태 조회</p>
  </div>

  <div class="endpoint">
    <h3>POST /api/v1/agent/index</h3>
    <p>저장소 수동 인덱싱</p>
    <code>{"repositoryId": "freelang-v6"}</code>
  </div>

  <div class="endpoint">
    <h3>POST /api/v1/webhook/gogs</h3>
    <p>GOGS Webhook 수신</p>
  </div>

  <div class="endpoint">
    <h3>GET /api/v1/repositories</h3>
    <p>등록된 저장소 목록</p>
  </div>

  <div class="endpoint">
    <h3>GET /api/v1/metrics</h3>
    <p>📊 실시간 통계 (JSON)</p>
  </div>

  <div class="endpoint">
    <h3>GET /api/v1/alerts</h3>
    <p>🔔 최근 알림</p>
  </div>

  <div class="endpoint">
    <h3>GET /api/v1/health</h3>
    <p>🏥 상세 헬스 체크</p>
  </div>

  <div class="endpoint">
    <h3>GET /dashboard</h3>
    <p>📈 웹 대시보드 UI</p>
  </div>

  <hr>
  <p>문서: <a href="/dashboard">대시보드</a></p>
</body>
</html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(docs);
  }

  // 서버 시작
  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      console.log(`\n🚀 Gogs AI Architect API Server v3`);
      console.log(`📍 listening on http://localhost:${this.port}`);
      console.log(`📊 dashboard: http://localhost:${this.port}/dashboard`);
      console.log(`📖 docs: http://localhost:${this.port}/`);
      console.log(`💚 health: http://localhost:${this.port}/health\n`);
    });
  }

  // 서버 종료
  stop() {
    if (this.server) {
      this.server.close();
      console.log('API Server stopped');
    }
  }
}

// 메인 실행
const port = process.env.PORT || 3000;
const apiServer = new APIServerV3(port);
apiServer.start();

// graceful shutdown
process.on('SIGTERM', () => apiServer.stop());
process.on('SIGINT', () => apiServer.stop());

export default APIServerV3;
