#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';
import path from 'path';

const DB_PATH = 'data/architect.db';
const repos = [
  { name: 'c-compiler-from-scratch', path: '/home/kimjin/Desktop/kim/c-compiler-from-scratch' },
  { name: 'freelang-v2', path: '/home/kimjin/freelang-v2' },
  { name: 'pyfree', path: '/home/kimjin/Desktop/kim/pyfree' },
  { name: 'gogs-architect', path: '/home/kimjin/Desktop/kim/gogs-architect' }
];

const languageMap = {
  '.ts': 'ts', '.tsx': 'ts', '.js': 'js', '.jsx': 'js',
  '.py': 'py', '.free': 'free', '.fl': 'free',
  '.c': 'c', '.h': 'h', '.go': 'go', '.rs': 'rs'
};

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) throw err;
  console.log('✅ DB 연결됨\n');

  let filesAdded = 0;

  repos.forEach(repo => {
    console.log(`📁 ${repo.name} 파일 스캔...`);
    try {
      const files = execSync('git ls-files', {
        cwd: repo.path,
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .filter(f => f);

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO files (repo_id, path, language)
        SELECT repos.id, ?, ?
        FROM repos WHERE repos.name = ?
      `);

      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        const language = languageMap[ext] || null;

        stmt.run([file, language, repo.name], function(err) {
          if (!err && this.changes > 0) filesAdded++;
        });
      });

      stmt.finalize();
      console.log(`   ✓ ${files.length}개 파일 처리됨`);
    } catch (err) {
      console.error(`   ❌ 스캔 실패: ${err.message}`);
    }
  });

  setTimeout(() => {
    db.all('SELECT COUNT(*) as cnt FROM files', (err, rows) => {
      if (!err) console.log(`\n✅ 총 ${rows[0].cnt}개 파일 저장됨`);
      db.close();
    });
  }, 2000);
});
