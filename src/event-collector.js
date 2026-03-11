/**
 * 중앙 이벤트 수집기
 * 
 * 역할:
 * - 모든 Gogs 저장소의 Push 이벤트 수집 (중앙 API)
 * - 메모리 캐시에 저장 (RAM 활용)
 * - 봇에게 변경사항 알림
 * 
 * 포트: 9998
 * 
 * 사용:
 *   export COLLECTOR_PORT=9998
 *   node src/event-collector.js
 */

import http from 'http';
import fs from 'fs';

class EventCollector {
  constructor(options = {}) {
    this.port = options.port || 9998;
    this.cacheFile = options.cacheFile || 'data/event-cache.json';
    
    // 메모리 캐시
    this.cache = {
      events: [],        // 최근 이벤트
      repos: {},         // 저장소별 메타
      stats: {
        totalEvents: 0,
        totalRepos: 0,
        lastUpdate: null
      }
    };
    
    // 디스크에서 캐시 로드
    this.loadCache();
    
    this.server = null;
  }

  /**
   * 디스크에서 캐시 로드
   */
  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        this.cache = JSON.parse(data);
        console.log(`💾 캐시 로드: ${this.cache.events.length}개 이벤트`);
      }
    } catch (error) {
      console.log(`ℹ️  캐시 없음 (신규 생성): ${error.message}`);
    }
  }

  /**
   * 캐시를 디스크에 저장
   */
  saveCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error(`❌ 캐시 저장 실패: ${error.message}`);
    }
  }

  /**
   * 이벤트 처리
   */
  async handleEvent(event) {
    const { repository, pusher, commits } = event;
    
    if (!repository) return;

    const repoName = repository.name;
    const owner = repository.owner.username;
    const timestamp = new Date().toISOString();

    // 저장소 메타 업데이트
    if (!this.cache.repos[repoName]) {
      this.cache.repos[repoName] = {
        owner,
        created: timestamp,
        lastPush: timestamp,
        eventCount: 0,
        commitCount: 0
      };
      this.cache.stats.totalRepos++;
    } else {
      this.cache.repos[repoName].lastPush = timestamp;
    }

    // 이벤트 추가
    const eventData = {
      timestamp,
      repo: repoName,
      owner,
      pusher: pusher?.name || 'unknown',
      commits: (commits || []).map(c => ({
        id: c.id,
        message: c.message,
        author: c.author?.name || 'unknown'
      })),
      branch: event.push?.ref?.replace('refs/heads/', '') || 'unknown'
    };

    this.cache.events.push(eventData);
    this.cache.repos[repoName].eventCount++;
    this.cache.repos[repoName].commitCount += (commits || []).length;
    this.cache.stats.totalEvents++;
    this.cache.stats.lastUpdate = timestamp;

    // 최근 1000개 이벤트만 유지 (메모리 효율)
    if (this.cache.events.length > 1000) {
      this.cache.events = this.cache.events.slice(-1000);
    }

    // 캐시 저장
    this.saveCache();

    console.log(`\n📨 [${timestamp}] ${owner}/${repoName}`);
    console.log(`   커밋: ${commits?.length || 0}개`);
    console.log(`   푸셔: ${pusher?.name || 'unknown'}`);
    
    return eventData;
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
          timestamp: new Date().toISOString(),
          cached: this.cache.stats.totalEvents
        }));
        return;
      }

      // 캐시 조회
      if (req.url === '/api/cache' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(this.cache, null, 2));
        return;
      }

      // 최근 이벤트 (limit 파라미터)
      if (req.url.startsWith('/api/events') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        
        res.writeHead(200);
        res.end(JSON.stringify({
          events: this.cache.events.slice(-limit),
          total: this.cache.stats.totalEvents
        }, null, 2));
        return;
      }

      // 저장소별 통계
      if (req.url === '/api/repos' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
          repos: this.cache.repos,
          total: this.cache.stats.totalRepos
        }, null, 2));
        return;
      }

      // 이벤트 수신 (모든 저장소에서)
      if (req.url === '/api/event' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const event = JSON.parse(body);
            await this.handleEvent(event);

            res.writeHead(200);
            res.end(JSON.stringify({ status: 'received' }));
          } catch (error) {
            console.error(`❌ 이벤트 처리 실패: ${error.message}`);
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
      console.log(`\n🚀 이벤트 수집기 시작`);
      console.log(`📍 포트: ${this.port}`);
      console.log(`📥 이벤트 수신: http://localhost:${this.port}/api/event`);
      console.log(`📊 캐시 조회: http://localhost:${this.port}/api/cache`);
      console.log(`❤️  헬스 체크: http://localhost:${this.port}/health\n`);
    });

    this.server.on('error', (err) => {
      console.error(`❌ 서버 오류: ${err.message}`);
    });
  }
}

// 실행
const port = process.env.COLLECTOR_PORT || 9998;
const collector = new EventCollector({ port });
collector.start();
