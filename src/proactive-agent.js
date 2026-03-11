/**
 * 선제적 설계 제안 엔진 (Proactive Agent)
 *
 * 역할:
 * - 주기적 분석 (6시간마다)
 * - Phase 진도 파악 → 다음 Phase 준비 사항 제안
 * - 코드 복잡도 증가 추세 → 리팩토링 필요 시점 예측
 * - 의존성 부채(Dependency Debt) 계산
 * - 테스트 커버리지 추정
 * - 결과 → CLI 알림 + Gogs 이슈 생성
 */

import KnowledgeBase from './knowledge-base.js';
import ArchitectPersona from './architect-persona.js';
import IssueBot from './issue-bot.js';

class ProactiveAgent {
  constructor(kb, embedder) {
    this.kb = kb;
    this.embedder = embedder;
    this.persona = new ArchitectPersona(kb, null);
    this.issueBot = new IssueBot();
    this.lastAnalysis = null;
  }

  /**
   * Phase 진도 분석
   */
  analyzePhaseProgress(commits) {
    const phases = {};
    let currentPhase = 0;

    commits.forEach(commit => {
      const message = commit.message || commit.commit?.message || '';

      // Phase X 패턴 감지
      const match = message.match(/Phase\s+(\d+)/i);
      if (match) {
        const phaseNum = parseInt(match[1]);
        currentPhase = Math.max(currentPhase, phaseNum);

        if (!phases[phaseNum]) {
          phases[phaseNum] = {
            number: phaseNum,
            commits: 0,
            completed: false,
            completionDate: null
          };
        }

        phases[phaseNum].commits++;

        // "complete", "done", "finish" 감지
        if (/complete|done|finish/i.test(message)) {
          phases[phaseNum].completed = true;
          phases[phaseNum].completionDate = commit.author?.date || commit.committer?.date;
        }
      }
    });

    return {
      currentPhase: currentPhase,
      phases: phases,
      nextPhase: currentPhase + 1
    };
  }

  /**
   * 코드 복잡도 분석
   */
  analyzeComplexity(chunks) {
    const stats = {
      totalChunks: chunks.length,
      avgSize: 0,
      largeChunks: [],
      highComplexity: [],
      nestedLevels: []
    };

    let totalSize = 0;

    chunks.forEach(chunk => {
      const lines = chunk.content.split('\n').length;
      totalSize += lines;

      // 큰 청크 (>100줄)
      if (lines > 100) {
        stats.largeChunks.push({
          name: chunk.name,
          file: chunk.meta.file,
          lines: lines
        });
      }

      // 복잡도: 들여쓰기 깊이 분석
      const maxIndent = Math.max(
        ...chunk.content.split('\n').map(line => {
          const match = line.match(/^(\s*)/);
          return match ? match[1].length : 0;
        })
      );

      if (maxIndent > 20) {
        stats.highComplexity.push({
          name: chunk.name,
          file: chunk.meta.file,
          nesting: Math.floor(maxIndent / 2)
        });
      }

      stats.nestedLevels.push(Math.floor(maxIndent / 2));
    });

    stats.avgSize = Math.round(totalSize / chunks.length);
    stats.avgNesting = Math.round(
      stats.nestedLevels.reduce((a, b) => a + b, 0) / stats.nestedLevels.length
    );

    return stats;
  }

  /**
   * 의존성 부채(Dependency Debt) 계산
   */
  analyzeDependencyDebt(chunks) {
    const debt = {
      externalDeps: [],
      internalDeps: [],
      circularRisks: [],
      debtScore: 0
    };

    chunks.forEach(chunk => {
      // npm 패키지 감지
      const npmPattern = /require\(['"][\w-]+['"]\)|from ['"][\w-]+['"]|import.*from ['"][\w-]+['"]/g;
      let match;
      while ((match = npmPattern.exec(chunk.content)) !== null) {
        debt.externalDeps.push({
          module: match[0],
          file: chunk.meta.file
        });
      }

      // 상호 참조 (순환 의존성 위험)
      const refPattern = /require\(['"]\.\/|from ['"]\.\/|import.*from ['"]\.\//g;
      const internalCount = (chunk.content.match(refPattern) || []).length;
      if (internalCount > 3) {
        debt.circularRisks.push({
          file: chunk.meta.file,
          internalRefs: internalCount
        });
      }

      debt.internalDeps.push({
        file: chunk.meta.file,
        count: internalCount
      });
    });

    // 부채 점수 계산 (0-100)
    const externalWeight = Math.min(debt.externalDeps.length * 5, 30);
    const circularWeight = Math.min(debt.circularRisks.length * 10, 40);
    const complexityWeight = Math.min(
      chunks.filter(c => c.content.split('\n').length > 100).length * 3,
      30
    );

    debt.debtScore = Math.round(externalWeight + circularWeight + complexityWeight) / 3;

    return debt;
  }

  /**
   * 테스트 커버리지 추정
   */
  estimateTestCoverage(chunks) {
    let testChunks = 0;
    let testLines = 0;
    let totalLines = 0;

    chunks.forEach(chunk => {
      const lines = chunk.content.split('\n').length;
      totalLines += lines;

      if (chunk.meta.file && (chunk.meta.file.includes('test') || chunk.meta.file.includes('spec'))) {
        testChunks++;
        testLines += lines;
      }
    });

    // 간단한 추정: 테스트 코드 / 전체 코드
    const coverage = Math.round((testLines / totalLines) * 100);

    return {
      testChunks: testChunks,
      testLines: testLines,
      totalLines: totalLines,
      estimatedCoverage: Math.min(coverage, 100),
      verdict: coverage > 30 ? 'good' : coverage > 10 ? 'fair' : 'poor'
    };
  }

  /**
   * 다음 Phase 준비 사항 제안
   */
  suggestNextPhase(phaseProgress, complexity, dependencyDebt) {
    const nextPhase = phaseProgress.nextPhase;
    const suggestions = [];

    // Phase 기반 추천
    const phaseSuggestions = {
      1: ['환경 설정', 'API 클라이언트', '저장소 스캔'],
      2: ['지식 베이스 설계', '임베딩 엔진', 'RAG 검색'],
      3: ['CLI 인터페이스', 'Webhook 자동화', '코드 리뷰'],
      4: ['AI 팀 라우터', '자동 문서화', '선제적 제안'],
      5: ['통합 테스트', 'systemd 서비스', 'PyFree 자기호스팅']
    };

    if (phaseSuggestions[nextPhase]) {
      suggestions.push({
        priority: 'high',
        items: phaseSuggestions[nextPhase],
        reason: `Phase ${nextPhase} 준비`
      });
    }

    // 복잡도 기반 리팩토링
    if (complexity.largeChunks.length > 5) {
      suggestions.push({
        priority: 'high',
        items: ['큰 함수 분해', '모듈화 증진'],
        reason: `${complexity.largeChunks.length}개 대형 함수 (>100줄)`
      });
    }

    // 중첩 깊이
    if (complexity.avgNesting > 4) {
      suggestions.push({
        priority: 'medium',
        items: ['조기 반환(Early Return) 패턴', '헬퍼 함수 추출'],
        reason: `평균 중첩 깊이: ${complexity.avgNesting}단계`
      });
    }

    // 의존성 부채
    if (dependencyDebt.debtScore > 60) {
      suggestions.push({
        priority: 'high',
        items: ['외부 의존성 최소화', '순환 의존성 제거'],
        reason: `의존성 부채 점수: ${dependencyDebt.debtScore}/100`
      });
    }

    return suggestions;
  }

  /**
   * 전체 주기적 분석
   */
  async analyze(owner, repo, commits, chunks) {
    console.log(`\n🔮 선제적 분석: ${owner}/${repo}`);

    try {
      // 1. Phase 진도
      const phaseProgress = this.analyzePhaseProgress(commits);
      console.log(`  📊 현재 Phase: ${phaseProgress.currentPhase}`);

      // 2. 코드 복잡도
      const complexity = this.analyzeComplexity(chunks);
      console.log(`  📈 평균 크기: ${complexity.avgSize}줄, 평균 중첩: ${complexity.avgNesting}단계`);

      // 3. 의존성 부채
      const dependencyDebt = this.analyzeDependencyDebt(chunks);
      console.log(`  💳 의존성 부채: ${dependencyDebt.debtScore.toFixed(0)}/100`);

      // 4. 테스트 커버리지
      const testCoverage = this.estimateTestCoverage(chunks);
      console.log(`  ✅ 테스트 커버리지: ${testCoverage.estimatedCoverage}%`);

      // 5. 제안 생성
      const suggestions = this.suggestNextPhase(phaseProgress, complexity, dependencyDebt);

      this.lastAnalysis = {
        timestamp: new Date().toISOString(),
        owner: owner,
        repo: repo,
        phaseProgress: phaseProgress,
        complexity: complexity,
        dependencyDebt: dependencyDebt,
        testCoverage: testCoverage,
        suggestions: suggestions
      };

      return this.lastAnalysis;
    } catch (error) {
      console.error(`  ❌ 분석 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport(analysis) {
    if (!analysis) return null;

    let report = `\n## 🔮 선제적 분석 보고서\n\n`;
    report += `**저장소**: ${analysis.owner}/${analysis.repo}\n`;
    report += `**분석 시간**: ${new Date(analysis.timestamp).toLocaleString('ko-KR')}\n\n`;

    // Phase 진도
    report += `### 📊 Phase 진도\n`;
    report += `- 현재: Phase ${analysis.phaseProgress.currentPhase}\n`;
    report += `- 다음: Phase ${analysis.phaseProgress.nextPhase}\n`;
    report += `- 완료된 Phase: ${Object.values(analysis.phaseProgress.phases).filter(p => p.completed).length}개\n\n`;

    // 복잡도
    report += `### 📈 코드 복잡도\n`;
    report += `- 평균 청크 크기: ${analysis.complexity.avgSize}줄\n`;
    report += `- 평균 중첩 깊이: ${analysis.complexity.avgNesting}단계\n`;
    report += `- 대형 청크 (>100줄): ${analysis.complexity.largeChunks.length}개\n`;
    report += `- 고복잡도 (깊은 중첩): ${analysis.complexity.highComplexity.length}개\n\n`;

    // 의존성
    report += `### 💳 의존성 부채\n`;
    report += `- 부채 점수: ${analysis.dependencyDebt.debtScore.toFixed(0)}/100\n`;
    report += `- 외부 의존성: ${analysis.dependencyDebt.externalDeps.length}개\n`;
    report += `- 순환 위험: ${analysis.dependencyDebt.circularRisks.length}개\n\n`;

    // 테스트
    report += `### ✅ 테스트 커버리지\n`;
    report += `- 추정 커버리지: ${analysis.testCoverage.estimatedCoverage}%\n`;
    report += `- 평가: ${analysis.testCoverage.verdict.toUpperCase()}\n\n`;

    // 제안
    report += `### 💡 추천 사항\n`;
    analysis.suggestions.forEach(sugg => {
      report += `**[${sugg.priority.toUpperCase()}]** ${sugg.reason}\n`;
      sugg.items.forEach(item => {
        report += `  - ${item}\n`;
      });
      report += '\n';
    });

    return report;
  }

  /**
   * CLI 알림 생성
   */
  generateAlert() {
    if (!this.lastAnalysis) return null;

    const analysis = this.lastAnalysis;
    const alerts = [];

    if (analysis.dependencyDebt.debtScore > 70) {
      alerts.push({
        level: 'warning',
        message: `WARNING: 높은 의존성 부채 (${analysis.dependencyDebt.debtScore.toFixed(0)}/100)`
      });
    }

    if (analysis.complexity.largeChunks.length > 10) {
      alerts.push({
        level: 'warning',
        message: `WARNING: ${analysis.complexity.largeChunks.length}개 대형 함수 리팩토링 필요`
      });
    }

    if (analysis.testCoverage.estimatedCoverage < 20) {
      alerts.push({
        level: 'warning',
        message: `WARNING: 낮은 테스트 커버리지 (${analysis.testCoverage.estimatedCoverage}%)`
      });
    }

    if (analysis.suggestions.length > 0) {
      alerts.push({
        level: 'info',
        message: `INFO: ${analysis.suggestions.length}개 준비 사항 확인`
      });
    }

    return alerts;
  }
}

export default ProactiveAgent;
