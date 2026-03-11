/**
 * 커밋 로그 파서 (ADR + Phase 추출)
 */

class CommitExtractor {
  constructor(gogsClient) {
    this.client = gogsClient;
  }

  /**
   * 저장소 커밋 수집
   */
  async extractCommits(owner, repo, limit = 500) {
    const commits = [];
    let page = 1;
    let collected = 0;

    while (collected < limit) {
      const batchLimit = Math.min(50, limit - collected);
      const batch = await this.client.getCommits(owner, repo, page, batchLimit);

      if (!batch || batch.length === 0) break;

      batch.forEach(c => {
        commits.push(this.analyzeCommit(c));
      });

      collected += batch.length;
      page++;
    }

    return commits;
  }

  /**
   * 커밋 분석 (메시지에서 키워드 추출)
   */
  analyzeCommit(commit) {
    const msg = commit.commit.message;
    const body = commit.commit.message.split('\n').slice(1).join('\n');

    return {
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: msg.split('\n')[0],
      body: body,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
      keywords: this.extractKeywords(msg),
      isADR: this.isADR(msg),
      phase: this.extractPhase(msg),
      type: this.detectType(msg)
    };
  }

  /**
   * 키워드 추출
   */
  extractKeywords(message) {
    const keywords = [];
    const text = message.toLowerCase();

    const patterns = {
      'fix': ['fix', 'fixed', 'bug', '버그', '수정'],
      'feature': ['feat', 'feature', 'add', 'added', '기능', '추가'],
      'refactor': ['refactor', '리팩', '정리', '개선'],
      'optimize': ['optimize', '최적', 'perf', '성능'],
      'docs': ['docs', 'doc', 'readme', '문서', '설명'],
      'test': ['test', 'tests', '테스트'],
      'ci': ['ci', 'cd', 'github', 'build'],
      'phase': ['phase', '단계', 'step']
    };

    for (const [key, terms] of Object.entries(patterns)) {
      if (terms.some(t => text.includes(t))) {
        keywords.push(key);
      }
    }

    return keywords;
  }

  /**
   * ADR 여부 판단
   */
  isADR(message) {
    return /ADR-\d+|Architecture Decision Record/i.test(message);
  }

  /**
   * Phase 추출
   */
  extractPhase(message) {
    const match = message.match(/Phase\s*(\d+)/i);
    if (match) return parseInt(match[1]);

    const match2 = message.match(/Step\s*(\d+)/i);
    if (match2) return parseInt(match2[1]);

    return null;
  }

  /**
   * 커밋 타입 판단
   */
  detectType(message) {
    const text = message.toLowerCase();
    if (text.startsWith('fix') || text.includes('bug')) return 'fix';
    if (text.startsWith('feat')) return 'feature';
    if (text.startsWith('refactor')) return 'refactor';
    if (text.startsWith('perf') || text.includes('optimize')) return 'perf';
    if (text.startsWith('docs')) return 'docs';
    if (text.startsWith('test')) return 'test';
    return 'other';
  }

  /**
   * 통계 생성
   */
  getStatistics(commits) {
    const stats = {
      total: commits.length,
      byType: {},
      byAuthor: {},
      byKeyword: {},
      adrCount: 0,
      phaseCount: 0
    };

    commits.forEach(c => {
      stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
      stats.byAuthor[c.author] = (stats.byAuthor[c.author] || 0) + 1;

      c.keywords.forEach(k => {
        stats.byKeyword[k] = (stats.byKeyword[k] || 0) + 1;
      });

      if (c.isADR) stats.adrCount++;
      if (c.phase) stats.phaseCount++;
    });

    return stats;
  }
}

export default CommitExtractor;
