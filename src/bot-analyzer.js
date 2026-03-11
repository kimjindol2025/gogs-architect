/**
 * Gogs AI 봇 - Event Collector + Analysis API 통합
 * 
 * 역할:
 * - Event Collector의 캐시 주기적 폴링
 * - 변경사항 감지 → Analysis API 호출
 * - 결과 요약 및 보고
 * 
 * 사용:
 *   export GOGS_TOKEN=...
 *   export ANTHROPIC_API_KEY=sk-...
 *   node src/bot-analyzer.js
 */

import http from 'http';
import GogsClient from './gogs-client.js';

class BotAnalyzer {
  constructor(options = {}) {
    this.collectorUrl = 'http://localhost:9998';
    this.analysisUrl = 'http://localhost:9997';
    this.gogsClient = new GogsClient();
    
    this.lastAnalyzedEventCount = 0;
    this.pollInterval = options.pollInterval || 30000; // 30초마다 폴링
  }

  /**
   * Analysis API 호출
   */
  async callAnalysisAPI(endpoint) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 9997,
        path: endpoint,
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ error: 'Parse error' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ error: e.message });
      });

      req.end();
    });
  }

  /**
   * Event Collector의 캐시 조회
   */
  async getCollectorStats() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 9998,
        path: '/api/cache',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      });

      req.on('error', () => resolve({}));
      req.end();
    });
  }

  /**
   * 변경사항 감지 및 분석
   */
  async analyzeChanges() {
    const stats = await this.getCollectorStats();
    const currentCount = stats.stats?.totalEvents || 0;

    if (currentCount <= this.lastAnalyzedEventCount) {
      return null;
    }

    const newEvents = currentCount - this.lastAnalyzedEventCount;
    console.log(`\n🔍 변경 감지: ${newEvents}개 새 이벤트`);
    this.lastAnalyzedEventCount = currentCount;

    // 커밋 분석
    console.log(`\n📊 커밋 분석 중...`);
    const commitAnalysis = await this.callAnalysisAPI('/api/analyze/commits');

    // 패턴 분석
    console.log(`📈 패턴 분석 중...`);
    const patternAnalysis = await this.callAnalysisAPI('/api/analyze/patterns');

    // 아키텍처 검토
    console.log(`🏗️  아키텍처 검토 중...`);
    const archReview = await this.callAnalysisAPI('/api/review/architecture');

    return {
      timestamp: new Date().toISOString(),
      newEvents,
      totalEvents: currentCount,
      commitAnalysis,
      patternAnalysis,
      archReview
    };
  }

  /**
   * 분석 결과 보고
   */
  async reportAnalysis(result) {
    if (!result) return;

    console.log('\n' + '═'.repeat(70));
    console.log('📋 분석 보고서');
    console.log('═'.repeat(70));

    // 커밋 분석
    if (result.commitAnalysis && result.commitAnalysis.analysis) {
      console.log('\n🔹 커밋 분석:');
      const lines = result.commitAnalysis.analysis.split('\n').slice(0, 5);
      lines.forEach(line => {
        if (line.trim()) console.log(`   ${line.substring(0, 66)}`);
      });
    }

    // 패턴 분석
    if (result.patternAnalysis && result.patternAnalysis.analysis) {
      console.log('\n🔹 패턴 분석:');
      const lines = result.patternAnalysis.analysis.split('\n').slice(0, 5);
      lines.forEach(line => {
        if (line.trim()) console.log(`   ${line.substring(0, 66)}`);
      });
    }

    // 아키텍처 검토
    if (result.archReview && result.archReview.analysis) {
      console.log('\n🔹 아키텍처 검토:');
      const lines = result.archReview.analysis.split('\n').slice(0, 5);
      lines.forEach(line => {
        if (line.trim()) console.log(`   ${line.substring(0, 66)}`);
      });
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`✓ ${result.timestamp} - 분석 완료`);
  }

  /**
   * 주기적 폴링 시작
   */
  start() {
    console.log(`\n🤖 Gogs AI 봇 시작`);
    console.log(`📍 폴링 간격: ${this.pollInterval}ms`);
    console.log(`🔗 Collector: ${this.collectorUrl}`);
    console.log(`🔗 Analysis: ${this.analysisUrl}\n`);

    // 초기 상태 조회
    this.getCollectorStats().then(stats => {
      this.lastAnalyzedEventCount = stats.stats?.totalEvents || 0;
      console.log(`📊 초기 이벤트: ${this.lastAnalyzedEventCount}개\n`);
    });

    // 주기적 폴링
    setInterval(async () => {
      const result = await this.analyzeChanges();
      if (result) {
        await this.reportAnalysis(result);
      }
    }, this.pollInterval);
  }
}

// 실행
const bot = new BotAnalyzer();
bot.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 봇 종료 중...');
  process.exit(0);
});
