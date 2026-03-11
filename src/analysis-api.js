/**
 * Claude 기반 코드 분석 API
 * 
 * 역할:
 * - Event Collector의 캐시 이용하여 변경된 파일 분석
 * - Claude AI로 아키텍처/성능/보안 분석
 * - 개선 제안 + 자동 이슈 생성
 * 
 * 포트: 9997
 * 
 * 사용:
 *   export ANALYSIS_PORT=9997
 *   export ANTHROPIC_API_KEY=sk-...
 *   node src/analysis-api.js
 */

import http from 'http';
import https from 'https';

class AnalysisAPI {
  constructor(options = {}) {
    this.port = options.port || 9997;
    this.collectorUrl = options.collectorUrl || 'http://localhost:9998';
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.server = null;
    
    if (!this.apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    }
  }

  /**
   * Claude API 호출
   */
  async callClaude(prompt, maxTokens = 1000) {
    if (!this.apiKey) {
      return { error: 'API key not set' };
    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': body.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.content && json.content.length > 0) {
              resolve({ 
                analysis: json.content[0].text,
                usage: json.usage
              });
            } else {
              resolve({ error: 'No content in response' });
            }
          } catch (e) {
            resolve({ error: e.message });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ error: e.message });
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Event Collector에서 최근 이벤트 조회
   */
  async getRecentEvents(limit = 10) {
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
   * 저장소 통계 조회
   */
  async getRepoStats() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 9998,
        path: '/api/repos',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve({});
          }
        });
      });

      req.on('error', () => resolve({}));
      req.end();
    });
  }

  /**
   * 커밋 분석
   */
  async analyzeCommits(events) {
    const commits = events.flatMap(e => 
      e.commits.map(c => ({
        id: c.id,
        message: c.message,
        repo: e.repo
      }))
    );

    if (commits.length === 0) {
      return { analysis: 'No commits to analyze', commits: [] };
    }

    const prompt = `다음 커밋 메시지들을 분석하고 개선 제안을 해줘.

${commits.map(c => `- [${c.repo}] ${c.message}`).join('\n')}

분석 항목:
1. 커밋 메시지 품질 (명확성, 설명성)
2. 변경 패턴 (리팩토링, 버그 수정, 기능 추가)
3. 아키텍처 일관성 (Phase, ADR 준수 여부)
4. 개선 제안

JSON 형식으로 반환: {"quality": 점수, "patterns": [], "suggestions": []}`;

    const result = await this.callClaude(prompt, 500);
    return { ...result, commits };
  }

  /**
   * 코드 패턴 분석
   */
  async analyzePatterns(repos) {
    const repoList = Object.entries(repos).map(([name, data]) => ({
      name,
      commits: data.commitCount,
      lastPush: data.lastPush
    }));

    const prompt = `다음 저장소들의 활동 패턴을 분석해줘.

${repoList.slice(0, 20).map(r => `- ${r.name}: ${r.commits}개 커밋 (마지막: ${r.lastPush})`).join('\n')}

분석 항목:
1. 가장 활발한 저장소
2. 변경 빈도 추세
3. 팀 개발 패턴
4. 리스크 신호 (비활성 저장소, 급격한 변화)
5. 운영 제안

JSON 형식으로 반환.`;

    const result = await this.callClaude(prompt, 800);
    return { ...result, repos: repoList.length };
  }

  /**
   * 아키텍처 검토
   */
  async reviewArchitecture(events) {
    const summary = {
      totalEvents: events.length,
      repos: new Set(events.map(e => e.repo)).size,
      totalCommits: events.reduce((sum, e) => sum + e.commits.length, 0),
      timeSpan: events.length > 0 
        ? new Date(events[events.length - 1].timestamp) - new Date(events[0].timestamp)
        : 0
    };

    const prompt = `Gogs AI 아키텍트 시스템의 성능을 평가해줘.

시스템 통계:
- 총 이벤트: ${summary.totalEvents}개
- 추적 저장소: ${summary.repos}개
- 총 커밋: ${summary.totalCommits}개
- 처리 시간: ${(summary.timeSpan / 1000).toFixed(2)}초

평가 항목:
1. 시스템 건강도 (0-100)
2. 성능 분석
3. 확장성 검토
4. 개선 기회
5. 다음 마일스톤 제안

JSON 형식으로 반환: {"health": 점수, "analysis": "", "improvements": []}`;

    const result = await this.callClaude(prompt, 1000);
    return { ...result, summary };
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
        res.end(JSON.stringify({ 
          status: 'ok',
          hasApiKey: !!this.apiKey
        }));
        return;
      }

      // 커밋 분석
      if (req.url === '/api/analyze/commits' && req.method === 'GET') {
        const events = await this.getRecentEvents(20);
        const result = await this.analyzeCommits(events);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 패턴 분석
      if (req.url === '/api/analyze/patterns' && req.method === 'GET') {
        const stats = await this.getRepoStats();
        const result = await this.analyzePatterns(stats.repos || {});
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 아키텍처 검토
      if (req.url === '/api/review/architecture' && req.method === 'GET') {
        const events = await this.getRecentEvents(100);
        const result = await this.reviewArchitecture(events);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // 커스텀 분석
      if (req.url.startsWith('/api/analyze') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { prompt } = JSON.parse(body);
            const result = await this.callClaude(prompt, 1000);
            res.writeHead(200);
            res.end(JSON.stringify(result, null, 2));
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ error: '찾을 수 없음' }));
    });

    this.server.listen(this.port, () => {
      console.log(`\n🤖 Claude 분석 API 시작`);
      console.log(`📍 포트: ${this.port}`);
      console.log(`📊 분석 엔드포인트:`);
      console.log(`   GET /api/analyze/commits      - 커밋 분석`);
      console.log(`   GET /api/analyze/patterns     - 패턴 분석`);
      console.log(`   GET /api/review/architecture  - 아키텍처 검토`);
      console.log(`   POST /api/analyze             - 커스텀 분석`);
      console.log(`   GET /health                   - 헬스 체크\n`);
      console.log(`🔑 API Key 상태: ${this.apiKey ? '✅ 설정됨' : '⚠️ 미설정'}\n`);
    });

    this.server.on('error', (err) => {
      console.error(`❌ 서버 오류: ${err.message}`);
    });
  }
}

// 실행
const port = process.env.ANALYSIS_PORT || 9997;
const api = new AnalysisAPI({ port });
api.start();
