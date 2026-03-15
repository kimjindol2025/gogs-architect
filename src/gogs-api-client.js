/**
 * GOGS API 클라이언트
 *
 * 기능:
 * - 저장소 목록 조회
 * - 웹훅 자동 등록/해제
 * - 파일 내용 조회
 * - 커밋 히스토리 조회
 */

import https from 'https';

class GogsApiClient {
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 끝의 슬래시 제거
    this.accessToken = accessToken;
  }

  /**
   * HTTP 요청 (GET/POST/DELETE)
   */
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/api/v1${path}`);

      // 토큰을 쿼리 파라미터로 추가
      url.searchParams.append('token', this.accessToken);

      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const request = https.request(url, options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data || '{}');

            if (res.statusCode >= 400) {
              reject(new Error(`GOGS API Error (${res.statusCode}): ${response.message || 'Unknown error'}`));
            } else {
              resolve(response);
            }
          } catch (error) {
            reject(new Error(`Failed to parse GOGS response: ${error.message}`));
          }
        });
      });

      request.on('error', reject);

      if (body) {
        request.write(JSON.stringify(body));
      }

      request.end();
    });
  }

  /**
   * 현재 사용자 정보 조회
   */
  async getCurrentUser() {
    try {
      const user = await this.request('GET', '/user');
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 사용자의 저장소 목록 조회
   */
  async listRepositories(username) {
    try {
      const repos = await this.request('GET', `/users/${username}/repos`);
      return { success: true, repositories: repos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 조직의 저장소 목록 조회
   */
  async listOrgRepositories(orgname) {
    try {
      const repos = await this.request('GET', `/orgs/${orgname}/repos`);
      return { success: true, repositories: repos };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 특정 저장소 정보
   */
  async getRepository(owner, repo) {
    try {
      const repository = await this.request('GET', `/repos/${owner}/${repo}`);
      return { success: true, repository };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 저장소 내 파일 목록
   */
  async listFiles(owner, repo, path = '') {
    try {
      const url = `/repos/${owner}/${repo}/contents${path ? '/' + path : ''}`;
      const contents = await this.request('GET', url);
      return { success: true, contents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 파일 내용 조회
   */
  async getFileContent(owner, repo, path) {
    try {
      const url = `/repos/${owner}/${repo}/contents/${path}`;
      const response = await this.request('GET', url);

      // GOGS는 파일 내용을 base64로 반환
      let content = response.content;
      if (content && typeof content === 'string') {
        content = Buffer.from(content, 'base64').toString('utf-8');
      }

      return { success: true, content, size: response.size };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 웹훅 등록
   */
  async createWebhook(owner, repo, webhookConfig) {
    try {
      const payload = {
        type: 'json',
        events: webhookConfig.events || ['push', 'create', 'delete'],
        config: {
          url: webhookConfig.url,
          content_type: 'json'
        },
        active: true
      };

      const hook = await this.request('POST', `/repos/${owner}/${repo}/hooks`, payload);
      return { success: true, webhook: hook, webhookId: hook.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 저장소의 웹훅 목록
   */
  async listWebhooks(owner, repo) {
    try {
      const hooks = await this.request('GET', `/repos/${owner}/${repo}/hooks`);
      return { success: true, webhooks: hooks };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 웹훅 제거
   */
  async deleteWebhook(owner, repo, hookId) {
    try {
      await this.request('DELETE', `/repos/${owner}/${repo}/hooks/${hookId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 커밋 히스토리 조회
   */
  async getCommitHistory(owner, repo, limit = 20) {
    try {
      const commits = await this.request('GET', `/repos/${owner}/${repo}/commits?limit=${limit}`);
      return { success: true, commits };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 특정 커밋 정보
   */
  async getCommit(owner, repo, sha) {
    try {
      const commit = await this.request('GET', `/repos/${owner}/${repo}/git/commits/${sha}`);
      return { success: true, commit };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 브랜치 목록
   */
  async listBranches(owner, repo) {
    try {
      const branches = await this.request('GET', `/repos/${owner}/${repo}/branches`);
      return { success: true, branches };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 모든 저장소 및 웹훅 자동 설정 (초기화)
   */
  async setupAllRepositories(username, webhookUrl) {
    const result = {
      username,
      webhookUrl,
      repositories: [],
      webhooksCreated: 0,
      errors: []
    };

    // 사용자의 저장소 목록 조회
    const repoResult = await this.listRepositories(username);
    if (!repoResult.success) {
      result.errors.push(`Failed to list repositories: ${repoResult.error}`);
      return result;
    }

    // 각 저장소에 웹훅 등록
    for (const repo of repoResult.repositories) {
      const repoInfo = {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        webhookSetup: false,
        webhookId: null,
        error: null
      };

      // 웹훅 자동 등록
      const webhookResult = await this.createWebhook(username, repo.name, {
        url: webhookUrl,
        events: ['push', 'create', 'delete']
      });

      if (webhookResult.success) {
        repoInfo.webhookSetup = true;
        repoInfo.webhookId = webhookResult.webhookId;
        result.webhooksCreated++;
      } else {
        repoInfo.error = webhookResult.error;
        result.errors.push(`Webhook failed for ${repo.full_name}: ${webhookResult.error}`);
      }

      result.repositories.push(repoInfo);
    }

    return result;
  }

  /**
   * 저장소 파일 전체 스캔 (인덱싱용)
   */
  async scanRepository(owner, repo, callback) {
    const files = [];
    const errors = [];

    async function walkTree(path = '') {
      try {
        const urlPath = path ? `${path}` : '';
        const contentsResult = await this.listFiles(owner, repo, urlPath);

        if (!contentsResult.success) {
          errors.push(`Failed to list ${path || 'root'}: ${contentsResult.error}`);
          return;
        }

        for (const item of contentsResult.contents || []) {
          if (item.type === 'file') {
            // 텍스트 파일만 처리
            const isTextFile = /\.(js|ts|py|java|go|rs|sh|json|yml|yaml|md|txt)$/i.test(item.name);

            if (isTextFile) {
              try {
                const contentResult = await this.getFileContent(owner, repo, item.path);
                if (contentResult.success) {
                  const file = {
                    path: item.path,
                    name: item.name,
                    size: contentResult.size,
                    content: contentResult.content
                  };

                  files.push(file);

                  // 콜백 함수 호출
                  if (callback) {
                    callback({
                      type: 'file',
                      file,
                      progress: {
                        totalFiles: files.length
                      }
                    });
                  }
                }
              } catch (error) {
                errors.push(`Failed to read ${item.path}: ${error.message}`);
              }
            }
          } else if (item.type === 'dir') {
            // 디렉토리 재귀 탐색 (깊이 제한: 10레벨)
            if (!item.path.split('/').some((p, i) => i > 10)) {
              await walkTree(item.path);
            }
          }
        }
      } catch (error) {
        errors.push(`Error scanning ${path}: ${error.message}`);
      }
    }

    // 재귀 함수 바인딩
    await walkTree.call(this);

    return { files, errors };
  }
}

export default GogsApiClient;
