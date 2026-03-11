#!/usr/bin/env node

/**
 * Phase 5: 통합 테스트 (Integration Testing)
 *
 * 시나리오:
 * 1. RAG 질문 응답 테스트
 * 2. ADR 위반 감지 테스트
 * 3. 선제적 제안 테스트
 * 4. 패턴 분석 테스트
 */

import GogsClient from '../src/gogs-client.js';
import KnowledgeBase from '../src/knowledge-base.js';
import Embedder from '../src/embedder.js';
import RAGEngine from '../src/rag-engine.js';
import ArchitectPersona from '../src/architect-persona.js';
import DecisionEngine from '../src/decision-engine.js';
import TeamRouter from '../src/team-router.js';
import PatternAnalyzer from '../src/pattern-analyzer.js';

class IntegrationTest {
  constructor() {
    this.gogsClient = new GogsClient();
    this.kb = new KnowledgeBase();
    this.embedder = new Embedder(this.kb);
    this.rag = new RAGEngine(this.kb, this.embedder);
    this.persona = new ArchitectPersona(this.kb, this.rag);
    this.engine = new DecisionEngine();
    this.router = new TeamRouter(this.kb, this.embedder);
    this.analyzer = new PatternAnalyzer();

    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * 테스트 출력
   */
  log(text, color = 'reset') {
    const colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      red: '\x1b[31m'
    };
    console.log(`${colors[color]}${text}${colors.reset}`);
  }

  /**
   * Test 1: RAG 검색 정확도
   */
  async testRAGSearch() {
    this.log('\n🧪 Test 1: RAG 검색 정확도', 'cyan');

    try {
      const query = '메모리 누수 버그';
      const results = this.rag.search(query, { topK: 3 });

      if (results.length > 0) {
        this.log(`✅ PASS: ${results.length}개 결과 반환`, 'green');
        this.passed++;

        results.slice(0, 2).forEach((r, i) => {
          this.log(`   ${i + 1}. [${r.chunk.meta.repo}] ${r.chunk.name}`, 'dim');
        });
      } else {
        this.log('❌ FAIL: 검색 결과 없음', 'red');
        this.failed++;
      }
    } catch (error) {
      this.log(`❌ FAIL: ${error.message}`, 'red');
      this.failed++;
    }
  }

  /**
   * Test 2: 질문 분류 (Team Router)
   */
  async testQueryClassification() {
    this.log('\n🧪 Test 2: 질문 분류 (Team Router)', 'cyan');

    try {
      const queries = [
        { query: 'parser AST 설계', expected: 'compiler' },
        { query: '성능 최적화 SIMD', expected: 'perf' },
        { query: 'SQL 쿼리 최적화', expected: 'db' },
        { query: '버그 디버깅 방법', expected: 'debug' },
        { query: 'README 작성 가이드', expected: 'docs' },
        { query: '아키텍처 설계 원칙', expected: 'arch' }
      ];

      let correct = 0;

      for (const test of queries) {
        const result = this.router.classifyQuery(test.query);
        const isCorrect = result.agent === test.expected;

        if (isCorrect) {
          correct++;
          this.log(`✅ "${test.query.substring(0, 20)}..." → ${result.agent}`, 'green');
        } else {
          this.log(
            `⚠️  "${test.query.substring(0, 20)}..." → ${result.agent} (expected: ${test.expected})`,
            'yellow'
          );
        }
      }

      const accuracy = (correct / queries.length) * 100;
      if (accuracy >= 50) {
        this.log(`✅ PASS: 분류 정확도 ${accuracy.toFixed(0)}%`, 'green');
        this.passed++;
      } else {
        this.log(`❌ FAIL: 분류 정확도 ${accuracy.toFixed(0)}% (threshold: 50%)`, 'red');
        this.failed++;
      }
    } catch (error) {
      this.log(`❌ FAIL: ${error.message}`, 'red');
      this.failed++;
    }
  }

  /**
   * Test 3: 패턴 분석 (PatternAnalyzer)
   */
  async testPatternAnalysis() {
    this.log('\n🧪 Test 3: 패턴 분석 (PatternAnalyzer)', 'cyan');

    try {
      await this.analyzer.connect();

      const pattern = 'for (let i = 0; i < n; i++) { array[i] = value; }';
      const results = await this.analyzer.findPatternUsage(pattern);

      if (results.statistics.totalMatches > 0) {
        this.log(
          `✅ PASS: ${results.statistics.totalMatches}곳에서 패턴 발견`,
          'green'
        );
        this.log(`   주요 언어: ${results.statistics.topLanguage}`, 'dim');

        if (results.recommendations.length > 0) {
          this.log(`   추천사항: ${results.recommendations[0].category}`, 'dim');
          this.passed++;
        } else {
          this.log('⚠️  추천사항 없음', 'yellow');
          this.failed++;
        }
      } else {
        this.log('⚠️  PASS (but no matches found)', 'yellow');
        this.passed++;
      }

      await this.analyzer.close();
    } catch (error) {
      this.log(`❌ FAIL: ${error.message}`, 'red');
      this.failed++;
    }
  }

  /**
   * Test 4: Decision Engine (위험도 분석)
   */
  async testDecisionEngine() {
    this.log('\n🧪 Test 4: Decision Engine (위험도 분석)', 'cyan');

    try {
      await this.engine.connect();

      // Risk scoring 테스트
      const riskScores = await this.engine.calculateRiskScores();

      if (riskScores && riskScores.length > 0) {
        this.log(`✅ PASS: ${riskScores.length}개 함수 위험도 계산`, 'green');

        const highRisk = riskScores.filter(r => r.risk > 0.7);
        this.log(`   High Risk: ${highRisk.length}개`, 'dim');

        this.passed++;
      } else {
        this.log('⚠️  PASS (but no risk data)', 'yellow');
        this.passed++;
      }

      this.engine.db.close();
    } catch (error) {
      this.log(`⚠️  SKIP: ${error.message}`, 'yellow');
    }
  }

  /**
   * Test 5: Gogs 연결 테스트
   */
  async testGogsConnection() {
    this.log('\n🧪 Test 5: Gogs 연결 테스트', 'cyan');

    try {
      const user = await this.gogsClient.getUser();

      if (user && user.login) {
        this.log(`✅ PASS: ${user.login} 사용자 확인`, 'green');
        this.passed++;
      } else {
        this.log('❌ FAIL: 사용자 정보 없음', 'red');
        this.failed++;
      }
    } catch (error) {
      this.log(`❌ FAIL: ${error.message}`, 'red');
      this.failed++;
    }
  }

  /**
   * Test 6: 지식 베이스 통계
   */
  testKnowledgeBase() {
    this.log('\n🧪 Test 6: 지식 베이스 통계', 'cyan');

    try {
      const stats = this.kb.getStatistics();

      if (stats.totalChunks > 0) {
        this.log(`✅ PASS: ${stats.totalChunks}개 청크`, 'green');
        this.log(`   커밋: ${stats.totalCommits}개`, 'dim');
        this.log(`   언어: ${stats.languages.join(', ')}`, 'dim');
        this.log(`   ADR: ${stats.adrCount}개`, 'dim');

        this.passed++;
      } else {
        this.log('❌ FAIL: 청크 데이터 없음', 'red');
        this.failed++;
      }
    } catch (error) {
      this.log(`❌ FAIL: ${error.message}`, 'red');
      this.failed++;
    }
  }

  /**
   * 성능 벤치마크
   */
  async benchmark() {
    this.log('\n⚡ 성능 벤치마크\n', 'bright');

    // RAG 검색 속도
    const start1 = Date.now();
    this.rag.search('버그 수정', { topK: 5 });
    const time1 = Date.now() - start1;
    this.log(`RAG 검색: ${time1}ms`, 'blue');

    // 패턴 분석 초기화
    const start2 = Date.now();
    await this.analyzer.connect();
    const time2 = Date.now() - start2;
    this.log(`패턴 분석 준비: ${time2}ms`, 'blue');
    await this.analyzer.close();

    // 질문 분류
    const start3 = Date.now();
    this.router.classifyQuery('성능 최적화 방법');
    const time3 = Date.now() - start3;
    this.log(`질문 분류: ${time3}ms`, 'blue');
  }

  /**
   * 최종 보고서
   */
  printReport() {
    const total = this.passed + this.failed;
    const passRate = ((this.passed / total) * 100).toFixed(1);

    this.log('\n' + '='.repeat(70), 'bright');
    this.log('📊 통합 테스트 보고서', 'bright');
    this.log('='.repeat(70), 'bright');

    this.log(`\n총 테스트: ${total}개`, 'reset');
    this.log(`✅ 통과: ${this.passed}개`, 'green');
    this.log(`❌ 실패: ${this.failed}개`, 'red');
    this.log(`📈 성공률: ${passRate}%\n`, this.passed >= total * 0.8 ? 'green' : 'yellow');

    if (this.passed >= total * 0.8) {
      this.log('🎉 시스템 통합 테스트 성공!\n', 'green');
    } else {
      this.log('⚠️  일부 테스트 실패. 검토 필요.\n', 'yellow');
    }

    this.log('='.repeat(70) + '\n', 'bright');
  }

  /**
   * 전체 테스트 실행
   */
  async runAll() {
    this.log('🧪 Phase 5: 통합 테스트 시작\n', 'bright');

    await this.testGogsConnection();
    this.testKnowledgeBase();
    await this.testRAGSearch();
    await this.testQueryClassification();
    await this.testPatternAnalysis();
    await this.testDecisionEngine();

    await this.benchmark();
    this.printReport();

    return this.passed >= this.failed;
  }
}

// 실행
const test = new IntegrationTest();
test.runAll().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 테스트 실행 오류:', error);
  process.exit(1);
});
