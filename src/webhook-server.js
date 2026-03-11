/**
 * Webhook 수신 서버
 *
 * 역할:
 * - Gogs Push 이벤트 수신
 * - 자동 재인덱싱
 * - 커밋 메시지 분석
 */

import http from 'http';
import crypto from 'crypto';
import GogsClient from './gogs-client.js';
import Scraper from './scraper.js';
import CommitExtractor from './commit-extractor.js';

class WebhookServer {
  constructor(options = {}) {
    this.port = options.port || 9090;
    this.secret = options.secret || process.env.WEBHOOK_SECRET || 'default-secret';
    this.gogsClient = new GogsClient();
    this.scraper = new Scraper(this.gogsClient);
    this.extractor = new CommitExtractor(this.gogsClient);
    this.server = null;
  }

  /**
   * HMAC 서명 검증
   */
  verifySignature(payload, signature) {
    // 'sha256=' 접두사 제거
    const sig = signature.replace(/^sha256=/, '');

    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return hash === sig;
  }

  /**
   * Webhook 처리
   */
  async handleWebhook(event) {
    const { action, push } = event;

    if (push) {
      // Push 이벤트 처리
      console.log(`\n📨 Push 이벤트: ${event.repository.name}`);

      const owner = event.repository.owner.username;
      const repo = event.repository.name;

      try {
        // 저장소 재스캔
        const repoData = await this.gogsClient.getRepo(owner, repo);
        const changed = await this.scraper.scanRepository(repoData);

        if (changed) {
          console.log(`  ✓ 저장소 재인덱싱 완료`);

          // 커밋 수집
          const commits = await this.extractor.extractCommits(owner, repo, 10);
          console.log(`  ✓ 커밋 ${commits.length}개 분석 완료`);

          // ADR 감지
          const adrs = commits.filter(c => c.isADR);
          if (adrs.length > 0) {
            console.log(`  ⚠ ADR 감지: ${adrs.length}개`);
          }

          // Phase 변경 감지
          const phases = new Set(commits.map(c => c.phase).filter(p => p));
          if (phases.size > 0) {
            console.log(`  📊 Phase: ${Array.from(phases).join(', ')}`);
          }
        } else {
          console.log(`  - 변경사항 없음`);
        }
      } catch (error) {
        console.error(`  ❌ 오류: ${error.message}`);
      }
    }
  }

  /**
   * 서버 시작
   */
  start() {
    this.server = http.createServer(async (req, res) => {
      // CORS 헤더
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      // 헬스 체크
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      // Webhook 수신
      if (req.url === '/webhook' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            // 서명 검증
            const signature = req.headers['x-gogs-signature'];
            if (signature && !this.verifySignature(body, signature)) {
              res.writeHead(401);
              res.end(JSON.stringify({ error: '서명 불일치' }));
              return;
            }

            // 이벤트 처리
            const event = JSON.parse(body);
            await this.handleWebhook(event);

            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok' }));
          } catch (error) {
            console.error('❌ Webhook 처리 오류:', error.message);
            res.writeHead(500);
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
      console.log(`\n🚀 Webhook 서버 시작: http://localhost:${this.port}`);
      console.log(`📍 Webhook URL: http://localhost:${this.port}/webhook`);
      console.log(`❤️  헬스 체크: http://localhost:${this.port}/health\n`);
    });

    this.server.on('error', (err) => {
      console.error('❌ 서버 오류:', err.message);
    });
  }

  /**
   * 서버 중지
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('\n👋 Webhook 서버 중지\n');
    }
  }
}

// CLI 실행
if (process.argv[1].endsWith('webhook-server.js')) {
  const server = new WebhookServer({
    port: process.env.WEBHOOK_PORT || 9090
  });

  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}

export default WebhookServer;
