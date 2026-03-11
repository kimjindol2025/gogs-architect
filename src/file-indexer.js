#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import sqlite3 from 'sqlite3';
import TypeScriptParser from './parser-typescript.js';
import CParser from './parser-c.js';
import FreeLangParser from './parser-freelang.js';

class FileIndexer {
  constructor(dbPath = 'data/architect.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.stats = { files_scanned: 0, functions_extracted: 0 };
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

  async scanRepository(repoPath, repoName) {
    console.log(`\n📁 ${repoName} 스캔 중...`);
    try {
      const files = execSync('git ls-files', { cwd: repoPath, encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(f => f);

      const functions = [];
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const filePath = path.join(repoPath, file);
        
        if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
          this._parseWithTypeScript(filePath, repoName, file, functions);
        } else if (['.py'].includes(ext)) {
          await this._parseWithPython(filePath, repoName, file, functions);
        } else if (['.c', '.h'].includes(ext)) {
          this._parseWithC(filePath, repoName, file, functions);
        } else if (['.free', '.fl'].includes(ext)) {
          this._parseWithFreeLang(filePath, repoName, file, functions);
        }
        this.stats.files_scanned++;
      }
      console.log(`   📊 ${functions.length}개 함수 추출`);
      this.stats.functions_extracted += functions.length;
      return functions;
    } catch (err) {
      console.error(`   ❌ 스캔 실패: ${err.message}`);
      return [];
    }
  }

  _parseWithTypeScript(filePath, repoName, relPath, functions) {
    try {
      const parser = new TypeScriptParser();
      const fns = parser.extractFunctions(filePath);
      for (const fn of fns) {
        functions.push({
          repo_name: repoName,
          file_path: relPath,
          name: fn.name,
          type: fn.type,
          line_number: fn.line_number,
          signature: fn.signature
        });
      }
    } catch (err) {}
  }

  async _parseWithPython(filePath, repoName, relPath, functions) {
    return new Promise((resolve) => {
      const pythonScript = new URL('./parser-python.py', import.meta.url).pathname;
      const child = spawn('python3', [pythonScript, filePath, '--json']);
      let jsonOutput = '';
      child.stdout.on('data', (data) => { jsonOutput += data.toString(); });
      child.on('close', (code) => {
        try {
          if (code === 0) {
            const lines = jsonOutput.split('\n');
            const jsonLine = lines.find(l => l.startsWith('['));
            if (jsonLine) {
              const fns = JSON.parse(jsonLine);
              for (const fn of fns) {
                functions.push({
                  repo_name: repoName,
                  file_path: relPath,
                  name: fn.name,
                  type: fn.type,
                  line_number: fn.line_number,
                  signature: fn.signature
                });
              }
            }
          }
        } catch (err) {}
        resolve();
      });
    });
  }

  _parseWithC(filePath, repoName, relPath, functions) {
    try {
      const parser = new CParser();
      const fns = parser.extractFunctions(filePath);
      for (const fn of fns) {
        functions.push({
          repo_name: repoName,
          file_path: relPath,
          name: fn.name,
          type: fn.type,
          line_number: fn.line_number,
          signature: fn.signature
        });
      }
    } catch (err) {}
  }

  _parseWithFreeLang(filePath, repoName, relPath, functions) {
    try {
      const parser = new FreeLangParser();
      const fns = parser.extractFunctions(filePath);
      for (const fn of fns) {
        functions.push({
          repo_name: repoName,
          file_path: relPath,
          name: fn.name,
          type: fn.type,
          line_number: fn.line_number,
          signature: fn.signature
        });
      }
    } catch (err) {}
  }

  async insertFunctions(functions) {
    console.log(`\n💾 ${functions.length}개 함수를 SQLite에 저장 중...`);
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        const stmt = this.db.prepare(`
          INSERT INTO functions (repo_id, file_id, name, type, signature, start_line)
          SELECT repos.id, files.id, ?, ?, ?, ?
          FROM repos
          JOIN files ON files.repo_id = repos.id
          WHERE repos.name = ? AND files.path = ?
        `);
        
        let inserted = 0;
        for (const fn of functions) {
          stmt.run(
            [fn.name, fn.type, fn.signature, fn.line_number, fn.repo_name, fn.file_path],
            function(err) {
              if (!err && this.changes > 0) inserted++;
            }
          );
        }
        
        stmt.finalize(() => {
          this.db.run('COMMIT', (err) => {
            if (err) reject(err);
            else {
              console.log(`✅ ${inserted}개 함수 저장됨`);
              resolve(inserted);
            }
          });
        });
      });
    });
  }

  async index(repos) {
    try {
      await this.connect();
      const allFunctions = [];
      for (const repo of repos) {
        const functions = await this.scanRepository(repo.path, repo.name);
        allFunctions.push(...functions);
      }
      if (allFunctions.length > 0) {
        await this.insertFunctions(allFunctions);
      }
      console.log('\n📊 인덱싱 완료');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`files:     ${this.stats.files_scanned}`);
      console.log(`functions: ${this.stats.functions_extracted}`);
      await this.close();
    } catch (err) {
      console.error(`❌ 인덱싱 실패: ${err.message}`);
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('\n✅ DB 연결 종료');
          resolve();
        });
      } else resolve();
    });
  }
}

if (process.argv[1].endsWith('file-indexer.js')) {
  const indexer = new FileIndexer();
  const repos = [
    { name: 'c-compiler-from-scratch', path: '/home/kimjin/Desktop/kim/c-compiler-from-scratch' },
    { name: 'freelang-v2', path: '/home/kimjin/freelang-v2' },
    { name: 'pyfree', path: '/home/kimjin/Desktop/kim/pyfree' },
    { name: 'gogs-architect', path: '/home/kimjin/Desktop/kim/gogs-architect' }
  ];
  indexer.index(repos).catch(console.error);
}

export default FileIndexer;
