#!/usr/bin/env node

/**
 * Gogs AI Architect - REST API Server
 * 
 * 기능:
 * - 검색 API (패턴 검색, 3단어 분석)
 * - 에이전트 API (상태, 수동 인덱싱)
 * - Webhook API (GOGS 이벤트)
 * - 저장소 관리 API
 */

import http from 'http';
import url from 'url';
import SearchEnhanced from './search-enhanced.js';
import AutoIndexer from './auto-indexer.js';
import KnowledgeBase from './knowledge-base.js';
import Embedder from './embedder.js';
import PatternAnalyzer from './pattern-analyzer.js';

// API 서버 클래스
class APIServer {
  constructor(port = 3000) {
    this.port = port;
    this.kb = new KnowledgeBase();
    this.embedder = new Embedder(this.kb);
    this.analyzer = new PatternAnalyzer();
    this.search = new SearchEnhanced(this.kb, this.embedder, this.analyzer);
    this.indexer = new AutoIndexer(null, this.kb, this.search);
    
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

      // 검색 API
      if (pathname === '/api/v1/search' && method === 'POST') {
        await this.handleSearch(req, res);
      }
      // 3단어 분석
      else if (pathname === '/api/v1/search/three-words' && method === 'POST') {
        await this.handleThreeWords(req, res);
      }
      // 에이전트 상태
      else if (pathname === '/api/v1/agent/status' && method === 'GET') {
        await this.handleAgentStatus(req, res);
      }
      // 에이전트 수동 인덱싱
      else if (pathname === '/api/v1/agent/index' && method === 'POST') {
        await this.handleAgentIndex(req, res);
      }
      // Webhook
      else if (pathname === '/api/v1/webhook/gogs' && method === 'POST') {
        await this.handleWebhook(req, res);
      }
      // 저장소 목록
      else if (pathname === '/api/v1/repositories' && method === 'GET') {
        await this.handleRepositories(req, res);
      }
      // 헬스 체크
      else if (pathname === '/health' && method === 'GET') {
        this.jsonResponse(res, 200, { message: 'API Server is running' });
      }
      // 문서
      else if (pathname === '/' && method === 'GET') {
        this.handleDocs(req, res);
      }
      // 404
      else {
        this.jsonResponse(res, 404, {
          code: 'NOT_FOUND',
          message: 'Not Found'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      this.jsonResponse(res, 500, {
        code: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  // 검색 API
  async handleSearch(req, res) {
    try {
      const body = await this.parseBody(req);
      const { query } = body;

      if (!query) {
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: 'query is required'
        });
      }

      const result = this.search.searchAdvanced(query);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: result
      });
    } catch (error) {
      this.jsonResponse(res, 500, {
        code: 'SEARCH_FAILED',
        message: error.message
      });
    }
  }

  // 3단어 분석
  async handleThreeWords(req, res) {
    try {
      const body = await this.parseBody(req);
      const { words } = body;

      if (!words || words.length !== 3) {
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: 'words array with exactly 3 items is required'
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
      this.jsonResponse(res, 500, {
        code: 'ANALYSIS_FAILED',
        message: error.message
      });
    }
  }

  // 에이전트 상태
  async handleAgentStatus(req, res) {
    try {
      const status = this.indexer.getStatus();
      const report = this.indexer.generateReport();

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: {
          status,
          report
        }
      });
    } catch (error) {
      this.jsonResponse(res, 500, {
        code: 'AGENT_ERROR',
        message: error.message
      });
    }
  }

  // 에이전트 수동 인덱싱
  async handleAgentIndex(req, res) {
    try {
      const body = await this.parseBody(req);
      const { repositoryId, repositoryName, repositoryUrl, action, priority } = body;

      if (!repositoryId) {
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
      this.jsonResponse(res, 500, {
        code: 'INDEXING_ERROR',
        message: error.message
      });
    }
  }

  // Webhook 수신
  async handleWebhook(req, res) {
    try {
      const body = await this.parseBody(req);
      const { action, repository } = body;

      if (!repository) {
        return this.jsonResponse(res, 400, {
          code: 'VALIDATION_ERROR',
          message: 'repository data is required'
        });
      }

      // 자동 인덱서에 이벤트 전달
      await this.indexer.handleWebhookEvent(body);

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        message: '저장소가 인덱싱 큐에 추가되었습니다',
        data: {
          action,
          repositoryId: repository.id,
          repositoryName: repository.full_name
        }
      });
    } catch (error) {
      this.jsonResponse(res, 500, {
        code: 'WEBHOOK_ERROR',
        message: error.message
      });
    }
  }

  // 저장소 관리
  async handleRepositories(req, res) {
    try {
      // 모의 저장소 목록
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
        },
        {
          id: 'freelang-aws',
          name: 'FreeLang AWS',
          url: 'https://gogs.dclub.kr/kim/freelang-aws.git',
          status: 'indexed',
          fileCount: 34,
          chunkCount: 89,
          lastIndexed: new Date().toISOString(),
          language: 'JavaScript'
        }
      ];

      this.jsonResponse(res, 200, {
        code: 'SUCCESS',
        data: {
          total: repositories.length,
          repositories
        }
      });
    } catch (error) {
      this.jsonResponse(res, 500, {
        code: 'REPOSITORY_ERROR',
        message: error.message
      });
    }
  }

  // API 문서
  handleDocs(req, res) {
    const docs = `
<!DOCTYPE html>
<html>
<head>
  <title>Gogs AI Architect API</title>
  <style>
    body { font-family: monospace; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
    code { background: #eee; padding: 2px 6px; }
  </style>
</head>
<body>
  <h1>🚀 Gogs AI Architect API v1.0</h1>
  
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
  
  <hr>
  <p>문서: <a href="/api/v1/docs">API_DESIGN.md</a></p>
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
      console.log(`\n🚀 Gogs AI Architect API Server`);
      console.log(`📍 listening on http://localhost:${this.port}`);
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
const apiServer = new APIServer(port);
apiServer.start();

// graceful shutdown
process.on('SIGTERM', () => apiServer.stop());
process.on('SIGINT', () => apiServer.stop());

export default APIServer;
