/**
 * 이슈 자동 생성기
 *
 * 역할:
 * - 리뷤어 결과 기반 이슈 생성
 * - 중복 이슈 방지
 * - 라벨 자동 지정
 */

import GogsClient from './gogs-client.js';

class IssueBot {
  constructor() {
    this.gogsClient = new GogsClient();
    this.createdIssues = new Map(); // 중복 방지 캐시
  }

  /**
   * 리뷰 결과 → 이슈 변환
   */
  async createIssueFromReview(owner, repo, commit, review) {
    if (!review.violations.length && !review.warnings.length) {
      return null;
    }

    // 1. 제목 생성
    const title = this.generateTitle(review);

    // 2. 중복 확인
    if (this.isDuplicate(owner, repo, title)) {
      console.log(`  ⏭️ 이미 생성됨: ${title}`);
      return null;
    }

    // 3. 본문 생성
    const body = this.generateBody(commit, review);

    // 4. 라벨 생성
    const labels = this.generateLabels(review);

    try {
      const issue = await this.gogsClient.createIssue(owner, repo, title, {
        body: body,
        labels: labels
      });

      // 5. 캐시에 저장
      const key = `${owner}/${repo}:${title}`;
      this.createdIssues.set(key, issue.id);

      console.log(`  ✓ 이슈 생성: #${issue.number} - ${title}`);
      return issue;
    } catch (error) {
      console.error(`  ❌ 이슈 생성 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * 제목 생성
   */
  generateTitle(review) {
    if (review.violations.length > 0) {
      const violation = review.violations[0];
      return `[${violation.adr}] ${violation.message}`;
    }

    if (review.warnings.length > 0) {
      return `⚠️ ${review.warnings[0]}`;
    }

    return '코드 리뷰 결과';
  }

  /**
   * 본문 생성
   */
  generateBody(commit, review) {
    let body = '## 자동 코드 분석 결과\n\n';

    body += `**커밋**: ${commit.sha.substring(0, 7)}\n`;
    body += `**메시지**: ${commit.message.split('\n')[0]}\n`;
    body += `**작성자**: ${commit.author.name}\n\n`;

    if (review.violations.length > 0) {
      body += '### 🔴 위반사항\n';
      review.violations.forEach(v => {
        body += `- **${v.adr}**: ${v.message}\n`;
        body += `  - 심각도: ${v.severity}\n`;
      });
      body += '\n';
    }

    if (review.warnings.length > 0) {
      body += '### 🟡 경고\n';
      review.warnings.forEach(w => {
        body += `- ${w}\n`;
      });
      body += '\n';
    }

    body += '### 💡 권고\n';
    body += '- ADR 문서를 참고하여 코드를 수정하세요\n';
    body += '- 변경사항을 커밋하면 자동으로 재검증됩니다\n';

    body += '\n---\n*이 이슈는 자동으로 생성되었습니다.*';

    return body;
  }

  /**
   * 라벨 생성
   */
  generateLabels(review) {
    const labels = [];

    review.violations.forEach(v => {
      if (v.adr === 'ADR-001') {
        labels.push('architecture-violation');
      }
    });

    review.warnings.forEach(w => {
      if (w.includes('complexity') || w.includes('복잡도')) {
        labels.push('optimization');
      }
      if (w.includes('Phase')) {
        labels.push('phase-mismatch');
      }
    });

    return [...new Set(labels)]; // 중복 제거
  }

  /**
   * 중복 이슈 확인
   */
  isDuplicate(owner, repo, title) {
    const key = `${owner}/${repo}:${title}`;
    return this.createdIssues.has(key);
  }

  /**
   * 이슈에 코멘트 추가
   */
  async addComment(owner, repo, issueId, comment) {
    try {
      await this.gogsClient.createIssueComment(owner, repo, issueId, comment);
      console.log(`  ✓ 코멘트 추가: #${issueId}`);
      return true;
    } catch (error) {
      console.error(`  ❌ 코멘트 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 배치 이슈 생성
   */
  async createIssuesFromReviews(owner, repo, reviews) {
    console.log(`\n📝 이슈 생성: ${owner}/${repo}`);

    const created = [];
    for (const { sha, commit, review } of reviews) {
      const issue = await this.createIssueFromReview(owner, repo, commit, review);
      if (issue) {
        created.push(issue);
      }
    }

    console.log(`  ✓ ${created.length}개 이슈 생성\n`);
    return created;
  }
}

export default IssueBot;
