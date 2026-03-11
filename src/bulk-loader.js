#!/usr/bin/env node

/**
 * 대량 데이터 로더 (초기화용)
 *
 * 모든 185개 프로젝트의 커밋을 한 번에 Event Collector에 로드
 * 5분 기다릴 필요 없음 - 즉시 실행!
 */

import http from 'http';
import LocalScraper from './local-scraper.js';

class BulkLoader {
  constructor() {
    this.scraper = new LocalScraper();
    this.collectorUrl = 'http://localhost:9998';
    this.loaded = 0;
  }

  /**
   * 모든 프로젝트의 최근 커밋을 로드
   */
  async loadAll() {
    const projects = this.scraper.scan();
    console.log(`\n📦 ${projects.length}개 프로젝트 데이터 로드 시작...\n`);

    for (const project of projects) {
      try {
        const commits = this.scraper.getCommits(project.path, 10);

        if (commits.length === 0) continue;

        const event = {
          timestamp: new Date().toISOString(),
          repository: {
            name: project.name,
            owner: {
              username: 'local'
            }
          },
          pusher: {
            name: 'bulk-loader'
          },
          branch: project.branch,
          commits: commits.map(c => ({
            id: c.hash,
            message: c.subject,
            author: {
              name: c.email
            }
          }))
        };

        await this.sendEvent(event);
        this.loaded++;

        if (this.loaded % 10 === 0) {
          console.log(`  ✓ ${this.loaded}개 로드 중...`);
        }

        // 약간의 지연으로 요청 분산 (병렬 처리 방지)
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        // 에러는 무시하고 계속
      }
    }

    console.log(`\n✅ 완료! ${this.loaded}개 프로젝트 데이터 로드됨\n`);
  }

  /**
   * Event Collector로 이벤트 전송
   */
  async sendEvent(event) {
    return new Promise((resolve) => {
      const data = JSON.stringify(event);
      const buffer = Buffer.from(data, 'utf8');
      const options = {
        hostname: 'localhost',
        port: 9998,
        path: '/api/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': buffer.length
        }
      };

      const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });

      req.on('error', () => resolve());
      req.write(buffer);
      req.end();
    });
  }
}

// 즉시 실행
const loader = new BulkLoader();
loader.loadAll().catch(console.error);
