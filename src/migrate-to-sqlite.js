#!/usr/bin/env node

/**
 * Event Collector → SQLite 마이그레이션
 *
 * 목표: 4개 repo 데이터를 SQLite에 로드
 * - repos 테이블
 * - commits 테이블
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = 'data/architect.db';
const CACHE_PATH = 'data/event-cache.json';

const TARGET_REPOS = [
  'c-compiler-from-scratch',
  'freelang-v2',
  'pyfree',
  'gogs-architect'
];

class Migrator {
  constructor() {
    this.db = null;
    this.stats = {
      repos: 0,
      commits: 0,
      skipped: 0
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ SQLite 연결: ${DB_PATH}`);
          resolve();
        }
      });
    });
  }

  loadCache() {
    try {
      const data = fs.readFileSync(CACHE_PATH, 'utf8');
      const cache = JSON.parse(data);
      console.log(`✅ Event Collector 캐시 로드: ${cache.events.length}개 이벤트`);
      return cache;
    } catch (err) {
      console.error(`❌ 캐시 로드 실패: ${err.message}`);
      return null;
    }
  }

  filterTargetRepos(cache) {
    const filtered = cache.events.filter(e => TARGET_REPOS.includes(e.repo));
    console.log(`✅ 필터링: ${filtered.length}개 이벤트 (4개 repo)`);
    return filtered;
  }

  async insertRepo(owner, name) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO repos (owner, name, last_push)
        VALUES (?, ?, datetime('now'))
      `;

      this.db.run(query, [owner, name], function(err) {
        if (err) reject(err);
        else {
          if (this.changes > 0) {
            this.stats.repos++;
          }
          resolve();
        }
      });
    });
  }

  async insertCommit(repoName, commit, timestamp) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO commits (
          id, repo_id, hash, author, message, timestamp
        )
        SELECT
          printf('%s_%s', ?, ?),
          repos.id,
          ?,
          ?,
          ?,
          ?
        FROM repos
        WHERE repos.name = ?
      `;

      const id = `${repoName}_${commit.id}`;

      this.db.run(
        query,
        [id, commit.id, commit.id, commit.author || 'unknown', commit.message, timestamp, repoName],
        function(err) {
          if (err) {
            console.error(`⚠️  Commit 삽입 실패: ${err.message}`);
          } else {
            if (this.changes > 0) {
              this.stats.commits++;
            }
          }
          resolve();
        }
      );
    });
  }

  async migrate() {
    try {
      // Step 1: 캐시 로드
      const cache = this.loadCache();
      if (!cache || cache.events.length === 0) {
        console.error('❌ 캐시 데이터 없음');
        return;
      }

      // Step 2: 4개 repo 필터링
      const filtered = this.filterTargetRepos(cache);
      if (filtered.length === 0) {
        console.error('❌ 해당하는 repo 없음');
        return;
      }

      // Step 3: repos 테이블 채우기
      console.log('\n📝 repos 테이블 마이그레이션...');
      const uniqueRepos = new Set();

      for (const event of filtered) {
        if (!uniqueRepos.has(event.repo)) {
          uniqueRepos.add(event.repo);
          await this.insertRepo(event.owner, event.repo);
        }
      }

      console.log(`✅ ${this.stats.repos}개 repo 추가`);

      // Step 4: commits 테이블 채우기
      console.log('\n📝 commits 테이블 마이그레이션...');

      for (const event of filtered) {
        for (const commit of event.commits || []) {
          await this.insertCommit(event.repo, commit, event.timestamp);
        }
      }

      console.log(`✅ ${this.stats.commits}개 commit 추가`);

      // Step 5: 통계
      console.log('\n📊 마이그레이션 완료');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`repos:     ${this.stats.repos}`);
      console.log(`commits:   ${this.stats.commits}`);

    } catch (err) {
      console.error(`❌ 마이그레이션 실패: ${err.message}`);
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('\n✅ DB 연결 종료');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// 실행
const migrator = new Migrator();

(async () => {
  try {
    await migrator.connect();
    await migrator.migrate();
    await migrator.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
