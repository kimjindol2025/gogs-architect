#!/usr/bin/env node

/**
 * Claude Code CLI - Gogs 검색 통합
 * 
 * 사용법:
 *   gogs search "키워드"          # 코드 검색
 *   gogs find "함수명"            # 함수/클래스 찾기
 *   gogs repo kim/저장소명        # 저장소 파일 목록
 *   gogs file kim/저장소명/path   # 파일 내용 조회
 *   gogs status                   # 시스템 상태
 */

import http from 'http';
import { argv, exit } from 'process';

class GogsSearchCLI {
  constructor() {
    this.searchUrl = 'http://localhost:9996';
    this.collectorUrl = 'http://localhost:9998';
  }

  /**
   * HTTP GET 요청
   */
  async fetch(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * 코드 검색
   */
  async search(keyword) {
    console.log(`\n🔍 "${keyword}" 검색 중...\n`);
    
    try {
      const result = await this.fetch(
        `${this.searchUrl}/api/search?q=${encodeURIComponent(keyword)}`
      );

      if (result.error) {
        console.error(`❌ 오류: ${result.error}`);
        return;
      }

      console.log(`✅ ${result.found}개 저장소에서 발견\n`);

      result.results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.owner}/${r.repo}`);
        console.log(`   마지막 Push: ${new Date(r.lastPush).toLocaleString()}`);
        
        if (r.commits.length > 0) {
          console.log(`   관련 커밋:`);
          r.commits.slice(0, 3).forEach(c => {
            console.log(`     - ${c.message}`);
          });
        }
        console.log();
      });
    } catch (error) {
      console.error(`❌ 검색 실패: ${error.message}`);
    }
  }

  /**
   * 함수/클래스 찾기
   */
  async findFunction(keyword) {
    console.log(`\n🔎 함수/클래스 "${keyword}" 찾는 중...\n`);
    
    try {
      const result = await this.fetch(
        `${this.searchUrl}/api/search-function?q=${encodeURIComponent(keyword)}`
      );

      if (result.error) {
        console.error(`❌ 오류: ${result.error}`);
        return;
      }

      console.log(`✅ ${result.found}개 파일에서 발견\n`);

      result.results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.repo}/${r.file}`);
        console.log(`   언어: ${r.type.toUpperCase()}`);
        console.log(`   라인 수: ${r.lines}`);
        console.log();
      });
    } catch (error) {
      console.error(`❌ 검색 실패: ${error.message}`);
    }
  }

  /**
   * 저장소 파일 목록
   */
  async listRepo(repoPath) {
    const [owner, repo] = repoPath.split('/');
    
    if (!owner || !repo) {
      console.error('❌ 형식: gogs repo owner/repo');
      return;
    }

    console.log(`\n📂 ${owner}/${repo} 파일 목록\n`);
    
    try {
      const result = await this.fetch(
        `${this.searchUrl}/api/repo/${owner}/${repo}`
      );

      if (result.error) {
        console.error(`❌ 오류: ${result.error}`);
        return;
      }

      result.files.forEach(file => {
        const icon = file.type === 'dir' ? '📁' : '📄';
        console.log(`${icon} ${file.path}`);
      });
      console.log();
    } catch (error) {
      console.error(`❌ 조회 실패: ${error.message}`);
    }
  }

  /**
   * 파일 내용 조회
   */
  async showFile(owner, repo, path) {
    console.log(`\n📄 ${owner}/${repo}/${path}\n`);
    console.log('─'.repeat(60) + '\n');
    
    try {
      const result = await this.fetch(
        `${this.searchUrl}/api/file?owner=${owner}&repo=${repo}&path=${encodeURIComponent(path)}`
      );

      if (result.error) {
        console.error(`❌ 오류: ${result.error}`);
        return;
      }

      const lines = result.content.split('\n');
      lines.forEach((line, i) => {
        console.log(`${String(i + 1).padStart(4, ' ')} | ${line}`);
      });
      
      console.log('\n' + '─'.repeat(60));
      console.log(`총 ${lines.length}줄\n`);
    } catch (error) {
      console.error(`❌ 조회 실패: ${error.message}`);
    }
  }

  /**
   * 시스템 상태
   */
  async status() {
    console.log(`\n📊 Gogs AI 아키텍트 상태\n`);
    
    try {
      const collector = await this.fetch(`${this.collectorUrl}/health`);
      const search = await this.fetch(`${this.searchUrl}/health`);
      
      console.log(`Event Collector (9998): ${collector.status === 'ok' ? '✅' : '❌'}`);
      console.log(`Search API (9996): ${search.status === 'ok' ? '✅' : '❌'}`);

      if (collector.status === 'ok') {
        const cache = await this.fetch(`${this.collectorUrl}/api/cache`);
        console.log(`\n이벤트: ${cache.stats.totalEvents}개`);
        console.log(`저장소: ${cache.stats.totalRepos}개`);
      }
      
      console.log();
    } catch (error) {
      console.error(`❌ 상태 조회 실패: ${error.message}`);
    }
  }

  /**
   * 도움말
   */
  help() {
    console.log(`
🔍 Gogs AI 아키텍트 - Claude Code CLI

사용법:
  gogs search "키워드"           # 코드 검색
  gogs find "함수명"             # 함수/클래스 찾기
  gogs repo owner/repo           # 저장소 파일 목록
  gogs file owner/repo/path      # 파일 내용 조회
  gogs status                    # 시스템 상태
  gogs help                      # 도움말

예시:
  gogs search "range bug"
  gogs find "createWebhook"
  gogs repo kim/gogs-architect
  gogs file kim/gogs-architect/src/webhook-server.js
    `);
  }

  /**
   * CLI 실행
   */
  async run(args) {
    if (args.length === 0) {
      this.help();
      exit(0);
    }

    const [command, ...params] = args;

    switch (command) {
      case 'search':
        await this.search(params.join(' '));
        break;
      case 'find':
        await this.findFunction(params.join(' '));
        break;
      case 'repo':
        await this.listRepo(params[0]);
        break;
      case 'file':
        const [owner, repo, ...pathParts] = params[0]?.split('/') || [];
        const path = pathParts.join('/');
        await this.showFile(owner, repo, path);
        break;
      case 'status':
        await this.status();
        break;
      case 'help':
      case '--help':
      case '-h':
        this.help();
        break;
      default:
        console.error(`❌ 알 수 없는 명령: ${command}`);
        console.log(`사용: gogs help`);
    }
  }
}

// 실행
const cli = new GogsSearchCLI();
cli.run(argv.slice(2)).catch(error => {
  console.error(`❌ 오류: ${error.message}`);
  exit(1);
});
