/**
 * Gogs REST API v1 클라이언트
 *
 * 역할: Gogs 서버와의 모든 API 통신을 담당
 * - 저장소 목록 조회
 * - 파일 내용 조회
 * - 커밋 로그 수집
 * - Webhook 등록/관리
 *
 * 특징:
 * - Token 기반 인증
 * - Rate-limit 처리
 * - 자동 재시도 (exponential backoff)
 * - npm zero-dependency (Node.js 표준 라이브러리만)
 */

import https from 'https';

class GogsClient {
  constructor(options = {}) {
    this.url = options.url || process.env.GOGS_URL || 'https://gogs.dclub.kr';
    this.token = options.token || process.env.GOGS_TOKEN;

    if (!this.token) {
      throw new Error('GOGS_TOKEN 환경변수 또는 token 옵션이 필수입니다');
    }

    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // ms
    this.timeout = options.timeout || 30000; // ms
    this.rateLimitDelay = options.rateLimitDelay || 100; // ms
  }

  /**
   * HTTP 요청 수행 (자동 재시도 + Rate-limit 처리)
   */
  async request(method, path, body = null, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(this.url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `/api/v1${path}`,
        method: method,
        headers: {
          'Authorization': `token ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GogsAIArchitect/0.1.0'
        },
        timeout: this.timeout,
        rejectUnauthorized: false // HTTPS 인증서 검증 비활성화 (테스트용)
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          // Rate-limit 처리
          if (res.statusCode === 429) {
            if (retryCount < this.maxRetries) {
              const delay = this.retryDelay * Math.pow(2, retryCount);
              setTimeout(() => {
                this.request(method, path, body, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, delay);
              return;
            }
            reject(new Error(`Rate limit exceeded after ${this.maxRetries} retries`));
            return;
          }

          // 성공 (2xx)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = data ? JSON.parse(data) : null;
              resolve({ status: res.statusCode, data: json });
            } catch (e) {
              resolve({ status: res.statusCode, data: data });
            }
            return;
          }

          // 에러 (3xx, 4xx, 5xx)
          if (retryCount < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, retryCount);
            setTimeout(() => {
              this.request(method, path, body, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
            return;
          }

          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      });

      req.on('error', (err) => {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          setTimeout(() => {
            this.request(method, path, body, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
          return;
        }
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * 사용자 정보 조회 (인증 확인)
   */
  async getUser() {
    const res = await this.request('GET', '/user');
    return res.data;
  }

  /**
   * 사용자의 모든 저장소 조회 (페이지네이션)
   */
  async getUserRepos(page = 1, limit = 50) {
    const res = await this.request('GET', `/user/repos?page=${page}&limit=${limit}`);
    return res.data;
  }

  /**
   * 특정 저장소 조회
   */
  async getRepo(owner, repo) {
    const res = await this.request('GET', `/repos/${owner}/${repo}`);
    return res.data;
  }

  /**
   * 저장소 생성
   */
  async createRepo(name, options = {}) {
    const body = {
      name: name,
      description: options.description || '',
      private: options.private || false,
      auto_init: options.auto_init || false,
      ...options
    };
    const res = await this.request('POST', '/user/repos', body);
    return res.data;
  }

  /**
   * 커밋 로그 조회 (페이지네이션)
   */
  async getCommits(owner, repo, page = 1, limit = 50) {
    const res = await this.request('GET', `/repos/${owner}/${repo}/commits?page=${page}&limit=${limit}`);
    return res.data;
  }

  /**
   * 특정 커밋 조회
   */
  async getCommit(owner, repo, sha) {
    const res = await this.request('GET', `/repos/${owner}/${repo}/commits/${sha}`);
    return res.data;
  }

  /**
   * 저장소 파일/폴더 트리 조회
   */
  async getTreeContents(owner, repo, ref = 'master') {
    const res = await this.request('GET', `/repos/${owner}/${repo}/git/trees/${ref}`);
    return res.data;
  }

  /**
   * 파일 내용 조회
   */
  async getFileContent(owner, repo, filepath, ref = 'master') {
    const res = await this.request('GET',
      `/repos/${owner}/${repo}/contents/${filepath}?ref=${ref}`);

    if (res.data.content && res.data.encoding === 'base64') {
      // Base64 디코딩
      return Buffer.from(res.data.content, 'base64').toString('utf-8');
    }
    return res.data.content || '';
  }

  /**
   * 이슈 생성
   */
  async createIssue(owner, repo, title, options = {}) {
    const body = {
      title: title,
      body: options.body || '',
      labels: options.labels || [],
      assignees: options.assignees || [],
      ...options
    };
    const res = await this.request('POST',
      `/repos/${owner}/${repo}/issues`, body);
    return res.data;
  }

  /**
   * 이슈 코멘트 작성
   */
  async createIssueComment(owner, repo, issueId, body) {
    const res = await this.request('POST',
      `/repos/${owner}/${repo}/issues/${issueId}/comments`,
      { body: body });
    return res.data;
  }

  /**
   * 커밋 코멘트 작성
   */
  async createCommitComment(owner, repo, sha, options = {}) {
    const body = {
      body: options.body || '',
      path: options.path,
      line: options.line,
      ...options
    };
    const res = await this.request('POST',
      `/repos/${owner}/${repo}/commits/${sha}/comments`, body);
    return res.data;
  }

  /**
   * Webhook 등록
   */
  async createWebhook(owner, repo, url, options = {}) {
    const body = {
      type: 'gogs',
      config: {
        url: url,
        content_type: 'json',
        secret: options.secret || ''
      },
      events: options.events || ['push', 'pull_request', 'issues', 'issue_comment'],
      active: options.active !== false,
      ...options
    };
    const res = await this.request('POST',
      `/repos/${owner}/${repo}/hooks`, body);
    return res.data;
  }

  /**
   * Webhook 목록 조회
   */
  async getWebhooks(owner, repo) {
    const res = await this.request('GET',
      `/repos/${owner}/${repo}/hooks`);
    return res.data;
  }

  /**
   * Webhook 삭제
   */
  async deleteWebhook(owner, repo, hookId) {
    await this.request('DELETE',
      `/repos/${owner}/${repo}/hooks/${hookId}`);
    return true;
  }

  /**
   * 모든 이슈 조회
   */
  async getIssues(owner, repo, page = 1, limit = 50) {
    const res = await this.request('GET',
      `/repos/${owner}/${repo}/issues?page=${page}&limit=${limit}`);
    return res.data;
  }

  /**
   * 조직 저장소 목록 조회
   */
  async getOrgRepos(orgname, page = 1, limit = 50) {
    const res = await this.request('GET',
      `/orgs/${orgname}/repos?page=${page}&limit=${limit}`);
    return res.data;
  }

  /**
   * 검색 (저장소)
   */
  async searchRepos(query, limit = 10) {
    const res = await this.request('GET',
      `/repos/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return res.data;
  }
}

export default GogsClient;
