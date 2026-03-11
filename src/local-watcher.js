#!/usr/bin/env node

// 로컬 변경 감시 (Crontab용)
// 역할: 5분마다 실행, git fetch + 변경사항 감지, Event Collector로 전송

import http from 'http';
import LocalScraper from './local-scraper.js';
import { execSync } from 'child_process';

class LocalWatcher {
  constructor() {
    this.scraper = new LocalScraper();
    this.collectorUrl = 'http://localhost:9998';
    this.lastChecked = {};
  }

  /**
   * 모든 프로젝트 감시
   */
  async watchAll() {
    const projects = this.scraper.scan();
    let changedCount = 0;

    console.log(`\n🔍 변경사항 감시 시작 (${projects.length}개 프로젝트)`);
    console.log(`⏰ ${new Date().toISOString()}\n`);

    for (const project of projects) {
      const changed = await this.checkProject(project);
      if (changed) {
        changedCount++;
        await this.sendEvent(project);
      }
    }

    console.log(`\n✓ 감시 완료: ${changedCount}개 변경사항 감지`);
  }

  /**
   * 특정 프로젝트 변경사항 확인
   */
  async checkProject(project) {
    try {
      // git fetch (원격 변경 동기화)
      try {
        execSync('git fetch', {
          cwd: project.path,
          timeout: 5000,
          stdio: 'pipe'
        });
      } catch (err) {
        // fetch 실패는 무시 (오프라인 등)
      }

      // 현재 상태
      const currentInfo = this.scraper._getProjectInfo(project.path);
      const lastInfo = this.lastChecked[project.path];

      // 처음인 경우 저장만
      if (!lastInfo) {
        this.lastChecked[project.path] = currentInfo;
        return false;
      }

      // 변경 감지
      const hasChanges =
        currentInfo.lastCommit !== lastInfo.lastCommit ||
        currentInfo.isDirty !== lastInfo.isDirty ||
        currentInfo.branch !== lastInfo.branch;

      if (hasChanges) {
        console.log(`  📝 ${project.name}`);
        this.lastChecked[project.path] = currentInfo;
      }

      return hasChanges;
    } catch (err) {
      return false;
    }
  }

  /**
   * Event Collector로 이벤트 전송
   */
  async sendEvent(project) {
    try {
      const commits = this.scraper.getCommits(project.path, 5);

      const event = {
        timestamp: new Date().toISOString(),
        repository: {
          name: project.name,
          owner: {
            username: 'local'
          }
        },
        pusher: {
          name: 'local-watcher'
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
          let respData = '';
          res.on('data', chunk => respData += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log(`     ✓ Event Collector로 전송`);
            }
            resolve();
          });
        });

        req.on('error', () => resolve());
        req.write(buffer);
        req.end();
      });
    } catch (err) {
      // 이벤트 전송 실패는 무시
    }
  }
}

// CLI 실행
const watcher = new LocalWatcher();
watcher.watchAll().catch(console.error);
