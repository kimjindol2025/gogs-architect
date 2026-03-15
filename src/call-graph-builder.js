#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';
import path from 'path';
import CallDetector from './call-detector.js';

class CallGraphBuilder {
  constructor(dbPath = 'data/architect.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.callDetector = new CallDetector();
    this.stats = {
      calls_extracted: 0,
      calls_resolved: 0,
      calls_unresolved: 0,
      calls_saved: 0
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ SQLite 연결: ${this.dbPath}`);
          resolve();
        }
      });
    });
  }

  async buildCallGraph(repos) {
    try {
      await this.connect();

      for (const repo of repos) {
        console.log(`\n🔗 ${repo.name} Call Graph 구축 중...`);
        await this._processRepository(repo);
      }

      console.log('\n📊 Call Graph 구축 완료');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`호출 총계:  ${this.stats.calls_extracted}`);
      console.log(`해석됨:    ${this.stats.calls_resolved}`);
      console.log(`미해석:    ${this.stats.calls_unresolved}`);
      console.log(`저장됨:    ${this.stats.calls_saved}`);

      await this.close();
    } catch (err) {
      console.error(`❌ Call Graph 구축 실패: ${err.message}`);
    }
  }

  async _processRepository(repo) {
    return new Promise((resolve) => {
      // 모든 함수를 메모리에 로드 (빠른 매칭을 위해)
      this.db.all(
        `SELECT f.id, f.name, f.file_id, fi.path, r.id as repo_id
         FROM functions f
         JOIN files fi ON f.file_id = fi.id
         JOIN repos r ON fi.repo_id = r.id
         WHERE r.name = ?`,
        [repo.name],
        async (err, functions) => {
          if (err) {
            resolve();
            return;
          }

          const funcsByName = {};
          const funcsByFile = {};

          functions.forEach(f => {
            funcsByName[f.name] = f;
            if (!funcsByFile[f.file_id]) funcsByFile[f.file_id] = [];
            funcsByFile[f.file_id].push(f);
          });

          try {
            const files = execSync('git ls-files', {
              cwd: repo.path,
              encoding: 'utf8'
            })
              .trim()
              .split('\n')
              .filter(f => f);

            let filesProcessed = 0;

            for (const file of files) {
              const ext = path.extname(file).toLowerCase();
              if (!['.js', '.ts', '.jsx', '.tsx', '.py', '.c', '.h', '.free', '.fl'].includes(ext)) {
                continue;
              }

              const filePath = path.join(repo.path, file);
              const lang = ['.py'].includes(ext) ? 'python' : 'typescript';

              // 이 파일의 함수들
              const fileFuncs = await this._getFileFunc(repo.name, file, funcsByFile);

              // 호출들
              const calls = this.callDetector.extractCalls(filePath, lang);
              this.stats.calls_extracted += calls.length;

              // 호출들을 저장
              for (const call of calls) {
                await this._saveCall(fileFuncs, call, funcsByName, repo.name, file);
              }

              filesProcessed++;
            }

            console.log(`   ✓ ${filesProcessed}개 파일 처리`);
          } catch (err) {
            console.error(`   ❌ 저장소 처리 실패: ${err.message}`);
          }

          resolve();
        }
      );
    });
  }

  async _getFileFunc(repoName, filePath, funcsByFile) {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT id, name, start_line FROM functions
         WHERE file_id = (SELECT id FROM files WHERE repo_id = (SELECT id FROM repos WHERE name = ?) AND path = ?)
         ORDER BY start_line ASC`,
        [repoName, filePath],
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });
  }

  async _saveCall(fileFuncs, call, funcsByName, repoName, filePath) {
    return new Promise((resolve) => {
      // 호출이 속한 함수 찾기 (가장 최근 함수)
      let callerId = null;
      if (fileFuncs.length > 0) {
        for (let i = fileFuncs.length - 1; i >= 0; i--) {
          if (fileFuncs[i].start_line <= call.line_number) {
            callerId = fileFuncs[i].id;
            break;
          }
        }
      }

      if (!callerId) {
        // 호출자 없음 - 스킵
        resolve();
        return;
      }

      // 호출 대상 찾기
      const callee = funcsByName[call.callee_name];
      const calleeId = callee ? callee.id : null;

      // 저장
      this.db.get(
        `SELECT id FROM files WHERE repo_id = (SELECT id FROM repos WHERE name = ?) AND path = ?`,
        [repoName, filePath],
        (err, fileRow) => {
          if (!fileRow) {
            resolve();
            return;
          }

          const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO calls (
              caller_id, callee_id, callee_name, call_type,
              file_id, line_number
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            [callerId, calleeId, call.callee_name, call.call_type, fileRow.id, call.line_number],
            function(err) {
              if (!err && this.changes > 0) {
                this.stats.calls_saved++;
                if (calleeId) {
                  this.stats.calls_resolved++;
                } else {
                  this.stats.calls_unresolved++;
                }
              }
            }.bind(this)
          );

          stmt.finalize(() => resolve());
        }
      );
    });
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

if (process.argv[1].endsWith('call-graph-builder.js')) {
  const builder = new CallGraphBuilder();
  const repos = [
    { name: 'gogs-architect' }
  ];
  builder.buildCallGraph(repos).catch(console.error);
}

export default CallGraphBuilder;
