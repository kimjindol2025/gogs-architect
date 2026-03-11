#!/usr/bin/env node

/**
 * Gogs AI 아키텍트 CLI
 *
 * 명령어:
 * - gogs-ai ask "질문"           - 질문 응답 (RAG 기반)
 * - gogs-ai audit                - 종합 아키텍처 감사
 * - gogs-ai route "질문"         - 전문 에이전트 분석
 * - gogs-ai analyze "패턴"       - 코드 패턴 분석
 * - gogs-ai status               - 상태 조회
 * - gogs-ai dashboard            - 대시보드
 * - gogs-ai chat                 - 대화형 모드
 */

import readline from 'readline';
import GogsClient from './gogs-client.js';
import KnowledgeBase from './knowledge-base.js';
import Embedder from './embedder.js';
import RAGEngine from './rag-engine.js';
import ArchitectPersona from './architect-persona.js';
import DecisionEngine from './decision-engine.js';
import TeamRouter from './team-router.js';
import PatternAnalyzer from './pattern-analyzer.js';

class CLI {
  constructor() {
    this.gogsClient = new GogsClient();
    this.kb = new KnowledgeBase();
    this.embedder = new Embedder(this.kb);
    this.rag = new RAGEngine(this.kb, this.embedder);
    this.persona = new ArchitectPersona(this.kb, this.rag);
    this.engine = new DecisionEngine();
    this.router = new TeamRouter(this.kb, this.embedder);
    this.analyzer = new PatternAnalyzer();
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
    this.log('명령어: ask, audit, route, analyze, status, dashboard, exit', 'dim');
    this.log('예: ask "질문" | audit | route "질문" | analyze "패턴"\n', 'dim');

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
        } else if (cmd === 'audit') {
          await this.audit();
        } else if (cmd === 'route') {
          await this.route(args.join(' '));
        } else if (cmd === 'analyze') {
          await this.analyze(args.join(' '));
        } else if (cmd === 'status') {
          await this.status();
        } else if (cmd === 'dashboard') {
          await this.dashboard();
        } else if (cmd === 'help') {
          this.log('명령어: ask, audit, route, analyze, status, dashboard, exit', 'cyan');
        } else {
          this.log('❌ 알 수 없는 명령어\n', 'yellow');
        }

        prompt();
      });
    };

    prompt();
  }

  /**
   * 종합 아키텍처 감사 (decision-engine 실행)
   */
  async audit() {
    this.log('\n🔍 아키텍처 종합 감사 시작...\n', 'cyan');

    try {
      await this.engine.connect();

      // 1. 리스크 스코어 계산
      await this.engine.calculateRiskScores();

      // 2. 순환 의존성 탐지
      const cycles = await this.engine.detectCircularDependencies();

      // 3. 미사용 함수 탐지
      const unused = await this.engine.detectUnusedFunctions();

      // 4. 중복 함수 탐지
      const dups = await this.engine.detectDuplicates();

      // 5. 핫스팟 탐지
      const hotspots = await this.engine.detectHotspots();

      // 6. 액션 계획 생성
      await this.engine.generateActionPlan(cycles, unused, dups, hotspots);

      this.log('\n✓ 감사 완료\n', 'green');
      this.engine.db.close();
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
  }

  /**
   * 팀 라우터 (질문 자동 분류 및 에이전트 분석)
   */
  async route(query) {
    this.log(`\n🤖 "${query}" 전문 에이전트 분석...\n`, 'cyan');

    try {
      // 질문 분류
      const classified = this.router.classifyQuery(query);
      this.log(`📋 주 에이전트: ${classified.agent.toUpperCase()} (신뢰도: ${(classified.confidence * 100).toFixed(0)}%)`, 'blue');

      // 다중 에이전트 분석
      const result = await this.router.analyzeWithMultipleAgents(query, 2);

      // 결과 출력
      this.log(`\n🎯 분석 결과\n`, 'bright');
      result.results.forEach((agentResult, idx) => {
        this.log(`\n[${idx + 1}] ${agentResult.agent.toUpperCase()} 분석`, 'cyan');

        if (agentResult.findings && agentResult.findings.length > 0) {
          agentResult.findings.forEach(finding => {
            console.log(`  📍 ${finding.chunk.name}`);
            console.log(`     위치: ${finding.chunk.meta.repo}/${finding.chunk.meta.file}:${finding.chunk.meta.lineStart}`);
            console.log(`     점수: ${finding.finalScore.toFixed(3)}`);
          });
        }
      });

      this.log(`\n✓ 분석 완료\n`, 'green');
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
  }

  /**
   * 패턴 분석 (코드 패턴 검색 및 개선 제안)
   */
  async analyze(pattern) {
    this.log(`\n🔍 코드 패턴 분석 중...\n`, 'cyan');

    try {
      await this.analyzer.connect();
      const results = await this.analyzer.findPatternUsage(pattern);
      this.analyzer.printResults(results);
      await this.analyzer.close();
    } catch (error) {
      this.log(`❌ 오류: ${error.message}\n`, 'red');
    }
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
      this.log('  gogs-ai ask "질문"        - 질문 응답 (RAG 기반)', 'cyan');
      this.log('  gogs-ai audit             - 종합 아키텍처 감사 (decision-engine)', 'cyan');
      this.log('  gogs-ai route "질문"      - 전문 에이전트 분석 (팀 라우터)', 'cyan');
      this.log('  gogs-ai analyze "패턴"    - 코드 패턴 분석 (277개 저장소)', 'cyan');
      this.log('  gogs-ai status            - 상태 조회', 'cyan');
      this.log('  gogs-ai dashboard         - 대시보드', 'cyan');
      this.log('  gogs-ai chat              - 대화형 모드\n', 'cyan');
      return;
    }

    const cmd = args[0];
    const rest = args.slice(1).join(' ');

    if (cmd === 'ask') {
      await this.ask(rest);
    } else if (cmd === 'audit') {
      await this.audit();
    } else if (cmd === 'route') {
      await this.route(rest);
    } else if (cmd === 'analyze') {
      await this.analyze(rest);
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
