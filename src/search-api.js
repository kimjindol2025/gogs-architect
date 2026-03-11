/**
 * 코드 검색 API - Claude Code 통합
 * 
 * 역할:
 * - 277개 저장소의 코드를 전문 검색
 * - Event Collector의 데이터 활용
 * - Claude Code CLI에서 직접 호출 가능
 * 
 * 포트: 9996
 * 
 * 사용:
 *   export SEARCH_PORT=9996
 *   node src/search-api.js
 */

import http from 'http';
import GogsClient from './gogs-client.js';

class SearchAPI {
  constructor(options = {}) {
    this.port = options.port || 9996;
    this.gogsClient = new GogsClient();
    this.collectorUrl = 'http://localhost:9998';
    this.server = null;
  }

  /**
   * Event Collector에서 최근 파일들 조회
   */
  async getRecentChanges(limit = 100) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 9998,
        path: `/api/events?limit=${limit}`,
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.events || []);
          } catch {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.end();
    });
  }

  /**
   * 코드 검색 (텍스트 기반)
   */
  async searchCode(keyword) {
    const results = [];
    const events = await this.getRecentChanges(200);

    // 이벤트의 커밋 메시지에서 검색
    const exactMatches = events.filter(e => {
      return e.commits.some(c => 
        c.message.toLowerCase().includes(keyword.toLowerCase())
      );
    });

    // 저장소명에서 검색
    const repoMatches = events.filter(e =>
      e.repo.toLowerCase().includes(keyword.toLowerCase())
    );

    // 결과 조합 (중복 제거)
    const allMatches = [...exactMatches, ...repoMatches];
    const uniqueRepos = new Map();

    allMatches.forEach(event => {
      if (!uniqueRepos.has(event.repo)) {
        uniqueRepos.set(event.repo, event);
      }
    });

    return {
      keyword,
      found: uniqueRepos.size,
      results: Array.from(uniqueRepos.values()).map(event => ({
        repo: event.repo,
        owner: event.owner,
        commits: event.commits.filter(c => 
          c.message.toLowerCase().includes(keyword.toLowerCase())
        ),
        lastPush: event.timestamp,
        branch: event.branch
      }))
    };
  }

  /**
   * 저장소 파일 목록 조회
   */
  async getRepoFiles(owner, repo, path = '') {
    try {
      const contents = await this.gogsClient.getTreeContents(owner, repo);
      
      return {
        repo,
        owner,
        path,
        files: (contents || []).map(file => ({
          name: file.name,
          path: file.path,
          type: file.type, // 'file' or 'dir'
          sha: file.sha,
          size: file.size
        }))
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 파일 내용 조회
   */
  async getFileContent(owner, repo, path) {
    try {
      const content = await this.gogsClient.getFileContent(owner, repo, path);
      
      return {
        repo,
        owner,
        path,
        content,
        size: content.length,
        lines: content.split('\n').length
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 함수/클래스 검색 (간단한 정규식)
   */
  async searchFunction(keyword) {
    const events = await this.getRecentChanges(50);
    const results = [];

    // 파일 확장자별로 검색 패턴 다름
    const patterns = {
      js: new RegExp(`(?:function|const|class)\\s+${keyword}\\s*[({]`, 'gi'),
      py: new RegExp(`(?:def|class)\\s+${keyword}\\s*[(:)]`, 'gi'),
      fl: new RegExp(`(?:fn|struct)\\s+${keyword}\\s*[({]`, 'gi'),
    };

    for (const event of events) {
      // 저장소의 최상위 파일 목록 조회
      const filesRes = await this.getRepoFiles(event.owner, event.repo);
      
      if (filesRes.files) {
        for (const file of filesRes.files) {
          if (file.type === 'file') {
            const ext = file.name.split('.').pop();
            const pattern = patterns[ext];
            
            if (pattern) {
              const contentRes = await this.getFileContent(event.owner, event.repo, file.path);
              
              if (contentRes.content && pattern.test(contentRes.content)) {
                results.push({
                  repo: event.repo,
                  file: file.path,
                  type: ext,
                  lines: contentRes.lines
                });
              }
            }
          }
        }
      }
    }

    return {
      keyword,
      found: results.length,
      results
    };
  }

  /**
   * 서버 시작
   */
  start() {
    this.server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      // 헬스 체크
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      // 코드 검색
      if (req.url.startsWith('/api/search') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const keyword = url.searchParams.get('q');

        if (!keyword) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'q parameter required' }));
          return;
        }

        const result = await this.searchCode(keyword);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 함수/클래스 검색
      if (req.url.startsWith('/api/search-function') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const keyword = url.searchParams.get('q');

        if (!keyword) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'q parameter required' }));
          return;
        }

        const result = await this.searchFunction(keyword);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 저장소 파일 목록
      if (req.url.startsWith('/api/repo/') && req.method === 'GET') {
        const parts = req.url.split('/');
        const owner = parts[3];
        const repo = parts[4]?.split('?')[0];

        if (!owner || !repo) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'owner and repo required' }));
          return;
        }

        const result = await this.getRepoFiles(owner, repo);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 파일 내용 조회
      if (req.url.startsWith('/api/file/') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const owner = url.searchParams.get('owner');
        const repo = url.searchParams.get('repo');
        const path = url.searchParams.get('path');

        if (!owner || !repo || !path) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'owner, repo, path required' }));
          return;
        }

        const result = await this.getFileContent(owner, repo, path);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ error: '찾을 수 없음' }));
    });

    this.server.listen(this.port, () => {
      console.log(`\n🔍 코드 검색 API 시작`);
      console.log(`📍 포트: ${this.port}`);
      console.log(`\n📚 검색 엔드포인트:`);
      console.log(`   GET /api/search?q=키워드              - 코드 검색`);
      console.log(`   GET /api/search-function?q=함수명     - 함수/클래스 검색`);
      console.log(`   GET /api/repo/{owner}/{repo}         - 저장소 파일 목록`);
      console.log(`   GET /api/file?owner=...&repo=...     - 파일 내용 조회`);
      console.log(`   GET /health                          - 헬스 체크\n`);
    });

    this.server.on('error', (err) => {
      console.error(`❌ 서버 오류: ${err.message}`);
    });
  }
}

// 실행
const port = process.env.SEARCH_PORT || 9996;
const api = new SearchAPI({ port });
api.start();
