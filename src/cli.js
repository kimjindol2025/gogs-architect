#!/usr/bin/env node

/**
 * Gogs AI 아키텍트 CLI
 *
 * 명령어:
 * - gogs-ai ask "질문"
 * - gogs-ai review [repo]
 * - gogs-ai status
 * - gogs-ai chat
 * - gogs-ai dashboard
 */

import readline from 'readline';
import GogsClient from './gogs-client.js';
import KnowledgeBase from './knowledge-base.js';
import Embedder from './embedder.js';
import RAGEngine from './rag-engine.js';
import ArchitectPersona from './architect-persona.js';

class CLI {
  constructor() {
    this.gogsClient = new GogsClient();
    this.kb = new KnowledgeBase();
    this.embedder = new Embedder(this.kb);
    this.rag = new RAGEngine(this.kb, this.embedder);
    this.persona = new ArchitectPersona(this.kb, this.rag);
  }

  /**
   * ANSI 색상 (zero-dependency)
   */
  colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
  };

  /**
   * 색상 출력
   */
  log(text, color = 'reset') {
    console.log(`${this.colors[color]}${text}${this.colors.reset}`);
  }

  /**
   * 질문 응답
   */
  async ask(query) {
    this.log(`\n🔍 "${query}" 분석 중...\n`, 'cyan');

    try {
      const analysis = await this.persona.analyzeQuery(query);
      const report = this.persona.generateReport(analysis);

      console.log(report);

      this.log(`\n✓ 분석 완료\n`, 'green');
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
  }

  /**
   * 저장소 상태
   */
  async status() {
    this.log('\n📊 Gogs AI 아키텍트 상태\n', 'bright');

    try {
      const user = await this.gogsClient.getUser();
      const repos = await this.gogsClient.getUserRepos(1, 5);
      const stats = this.kb.getStatistics();

      this.log(`사용자: ${user.login}`, 'green');
      this.log(`저장소: ${repos.length}개 (최근)`, 'green');
      this.log(`청크: ${stats.totalChunks}개`, 'green');
      this.log(`커밋: ${stats.totalCommits}개`, 'green');
      this.log(`언어: ${stats.languages.join(', ')}`, 'green');
      this.log(`\n마지막 업데이트: ${stats.lastUpdated}\n`, 'dim');
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
  }

  /**
   * 대시보드
   */
  async dashboard() {
    this.log('\n', 'reset');
    this.printBox('📊 Gogs AI 아키텍트 대시보드', 'cyan');

    try {
      const user = await this.gogsClient.getUser();
      const stats = this.kb.getStatistics();
      const repos = this.kb.getRepositories();

      const content = `
사용자: ${user.login}
저장소: ${stats.totalRepositories}개
청크: ${stats.totalChunks}개
커밋: ${stats.totalCommits}개
파일: ${stats.totalFiles}개
키워드: ${stats.uniqueKeywords}개
ADR: ${stats.adrCount}개
마지막 업데이트: ${new Date(stats.lastUpdated).toLocaleString()}
`;

      this.printBox(content.trim(), 'green');
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
  }

  /**
   * 대화형 REPL
   */
  async chat() {
    this.log('\n💬 Gogs AI 아키텍트 (대화 모드)\n', 'bright');
    this.log('명령어: ask, status, dashboard, exit', 'dim');
    this.log('예: ask "architecture decision"\n', 'dim');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('> ', async (input) => {
        const [cmd, ...args] = input.trim().split(' ');

        if (cmd === 'exit' || cmd === 'quit') {
          this.log('\n👋 종료\n', 'cyan');
          rl.close();
          return;
        }

        if (cmd === 'ask') {
          await this.ask(args.join(' '));
        } else if (cmd === 'status') {
          await this.status();
        } else if (cmd === 'dashboard') {
          await this.dashboard();
        } else if (cmd === 'help') {
          this.log('명령어: ask, status, dashboard, exit', 'cyan');
        } else {
          this.log('❌ 알 수 없는 명령어\n', 'yellow');
        }

        prompt();
      });
    };

    prompt();
  }

  /**
   * 박스 출력 (테이블 형식)
   */
  printBox(text, color = 'reset') {
    const lines = text.split('\n');
    const maxWidth = Math.max(...lines.map(l => l.length));
    const border = '═'.repeat(maxWidth + 4);

    this.log(`╔${border}╗`, color);
    lines.forEach(line => {
      this.log(`║ ${line.padEnd(maxWidth + 2)}║`, color);
    });
    this.log(`╚${border}╝`, color);
    this.log('', color);
  }

  /**
   * 메인 진입점
   */
  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      this.log('\n📖 Gogs AI 아키텍트 CLI\n', 'bright');
      this.log('사용법:', 'cyan');
      this.log('  gogs-ai ask "질문"        - 질문 응답', 'cyan');
      this.log('  gogs-ai status            - 상태 조회', 'cyan');
      this.log('  gogs-ai dashboard         - 대시보드', 'cyan');
      this.log('  gogs-ai chat              - 대화형 모드\n', 'cyan');
      return;
    }

    const cmd = args[0];
    const rest = args.slice(1).join(' ');

    if (cmd === 'ask') {
      await this.ask(rest);
    } else if (cmd === 'status') {
      await this.status();
    } else if (cmd === 'dashboard') {
      await this.dashboard();
    } else if (cmd === 'chat') {
      await this.chat();
    } else {
      this.log(`❌ 알 수 없는 명령어: ${cmd}\n`, 'red');
    }
  }
}

const cli = new CLI();
cli.run().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
