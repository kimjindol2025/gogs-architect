/**
 * 자동 코드 리뷰어
 *
 * 역할:
 * - Push Diff 분석
 * - ADR 위반 감지
 * - npm 의존성 감지
 * - Phase 일관성 검증
 * - Gogs 코멘트 자동 생성
 */

import GogsClient from './gogs-client.js';
import ArchitectPersona from './architect-persona.js';

class Reviewer {
  constructor(kb, persona) {
    this.kb = kb;
    this.persona = persona;
    this.gogsClient = new GogsClient();
  }

  /**
   * 커밋 리뷰
   */
  async reviewCommit(owner, repo, sha) {
    console.log(`\n🔍 리뷰: ${owner}/${repo}@${sha.substring(0, 7)}`);

    try {
      const commit = await this.gogsClient.getCommit(owner, repo, sha);
      const message = commit.commit.message;
      const body = commit.commit.message.split('\n').slice(1).join('\n');

      const review = {
        findings: [],
        violations: [],
        warnings: [],
        suggestions: []
      };

      // 1. ADR 위반 검증
      const adrCheck = this.persona.validateADR(body);
      if (adrCheck.hasViolations) {
        review.violations = adrCheck.violations;
      }

      // 2. npm 의존성 감지
      if (this.detectNpmDependency(message + ' ' + body)) {
        review.violations.push({
          adr: 'ADR-001',
          message: 'npm 외부 의존성 감지',
          severity: 'high'
        });
      }

      // 3. Phase 일관성 검증
      const phaseMatch = message.match(/Phase\s*(\d+)/i);
      if (phaseMatch) {
        const phase = parseInt(phaseMatch[1]);
        if (phase > 20) {
          review.warnings.push(`Phase 범위 초과: ${phase}`);
        }
      }

      // 4. 복잡도 분석
      const complexity = this.analyzeComplexity(body);
      if (complexity.high) {
        review.warnings.push(`높은 복잡도: ${complexity.lines}줄`);
      }

      // 5. 권고사항
      if (review.violations.length === 0 && review.warnings.length === 0) {
        review.suggestions.push('✓ 아키텍처 준수 OK');
      }

      return review;
    } catch (error) {
      console.error(`❌ 리뷰 실패: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * npm 의존성 감지
   */
  detectNpmDependency(text) {
    const patterns = [
      /npm install/i,
      /require\(['"][\w-]+['"]\)/,
      /from ['"][\w-]+['"]/,
      /import.*from/i,
      /package\.json/i
    ];

    return patterns.some(p => p.test(text));
  }

  /**
   * 복잡도 분석
   */
  analyzeComplexity(code) {
    const lines = code.split('\n').length;
    const hasNestedLoops = /for.*for|while.*while/i.test(code);
    const functionCount = (code.match(/def\s+\w+|function\s+\w+/gi) || []).length;

    return {
      lines: lines,
      high: lines > 500 || (hasNestedLoops && lines > 200),
      functions: functionCount,
      cyclomatic: Math.ceil(functionCount * 1.5)
    };
  }

  /**
   * Gogs 코멘트 작성
   */
  async postComment(owner, repo, sha, review) {
    if (!review.violations.length && !review.warnings.length) {
      return true;
    }

    let body = '## 🤖 자동 코드 리뷰\n\n';

    if (review.violations.length > 0) {
      body += '### ⚠️ 위반사항\n';
      review.violations.forEach(v => {
        body += `- **${v.adr}**: ${v.message} (심각도: ${v.severity})\n`;
      });
      body += '\n';
    }

    if (review.warnings.length > 0) {
      body += '### ⚠️ 경고\n';
      review.warnings.forEach(w => {
        body += `- ${w}\n`;
      });
      body += '\n';
    }

    if (review.suggestions.length > 0) {
      body += '### 💡 권고\n';
      review.suggestions.forEach(s => {
        body += `- ${s}\n`;
      });
    }

    try {
      await this.gogsClient.createCommitComment(owner, repo, sha, { body });
      console.log(`  ✓ 코멘트 작성 완료`);
      return true;
    } catch (error) {
      console.error(`  ❌ 코멘트 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 배치 리뷰 (여러 커밋)
   */
  async reviewCommits(owner, repo, limit = 5) {
    console.log(`\n📋 배치 리뷰: ${owner}/${repo} (최근 ${limit}개 커밋)`);

    try {
      const commits = await this.gogsClient.getCommits(owner, repo, 1, limit);

      const results = [];
      for (const commit of commits) {
        const review = await this.reviewCommit(owner, repo, commit.sha);
        if (review.violations.length > 0 || review.warnings.length > 0) {
          await this.postComment(owner, repo, commit.sha, review);
        }
        results.push({ sha: commit.sha, review });
      }

      return results;
    } catch (error) {
      console.error(`❌ 배치 리뷰 실패: ${error.message}`);
      return [];
    }
  }
}

export default Reviewer;
