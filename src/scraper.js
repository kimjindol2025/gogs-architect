/**
 * Gogs 저장소 스캔 & 파일 수집기
 *
 * 역할:
 * - 모든 Gogs 저장소를 순회
 * - 각 저장소의 파일 메타데이터 수집
 * - JSON 기반 인덱스 유지 (증분 업데이트)
 * - SHA 비교로 변경된 파일만 재수집
 *
 * 입력: GogsClient 인스턴스
 * 출력: index.json (메타데이터 저장소)
 */

import fs from 'fs';
import path from 'path';

class Scraper {
  constructor(gogsClient, options = {}) {
    this.client = gogsClient;
    this.indexPath = options.indexPath || './data/index.json';
    this.dataDir = options.dataDir || './data/raw';
    this.fileExtensions = options.fileExtensions || [
      '.free', '.fl', '.mojo', '.ts', '.js', '.md', '.py',
      '.json', '.yaml', '.yml', '.sh', '.go', '.rs'
    ];
    this.index = this.loadIndex();
  }

  /**
   * 인덱스 로드 (없으면 빈 객체)
   */
  loadIndex() {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn(`⚠ 인덱스 로드 실패: ${e.message}`);
    }
    return {
      lastUpdated: new Date().toISOString(),
      repositories: {},
      fileCount: 0,
      totalSize: 0
    };
  }

  /**
   * 인덱스 저장
   */
  saveIndex() {
    // 디렉토리 생성
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 인덱스 저장
    this.index.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  /**
   * 모든 저장소 스캔
   */
  async scanAllRepositories() {
    console.log('🔍 모든 Gogs 저장소 스캔 중...\n');

    let page = 1;
    let totalScanned = 0;
    let changedCount = 0;

    while (true) {
      try {
        const repos = await this.client.getUserRepos(page, 50);

        if (!repos || repos.length === 0) {
          break;
        }

        console.log(`📄 페이지 ${page}: ${repos.length}개 저장소`);

        for (const repo of repos) {
          const changed = await this.scanRepository(repo);
          if (changed) changedCount++;
          totalScanned++;

          // 진행 상황 출력 (10개마다)
          if (totalScanned % 10 === 0) {
            console.log(`  ✓ ${totalScanned}개 저장소 처리 완료`);
          }
        }

        page++;
      } catch (e) {
        console.error(`❌ 페이지 ${page} 스캔 실패: ${e.message}`);
        break;
      }
    }

    console.log(`\n✅ 스캔 완료!`);
    console.log(`  - 총 저장소: ${totalScanned}개`);
    console.log(`  - 변경된 저장소: ${changedCount}개`);
    console.log(`  - 총 파일: ${this.index.fileCount}개`);
    console.log(`  - 총 크기: ${(this.index.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // 인덱스 저장
    this.saveIndex();
  }

  /**
   * 개별 저장소 스캔
   */
  async scanRepository(repo) {
    const repoKey = `${repo.owner.login}/${repo.name}`;
    let changed = false;

    try {
      // 저장소 기본 정보
      const repoInfo = {
        name: repo.name,
        owner: repo.owner.login,
        url: repo.html_url,
        description: repo.description || '',
        language: repo.language || '',
        stars: repo.stars_count || 0,
        forks: repo.forks_count || 0,
        size: repo.size || 0,
        updated_at: repo.updated_at,
        lastScanned: new Date().toISOString(),
        files: {}
      };

      // 이전 정보 비교
      const prevRepo = this.index.repositories[repoKey];
      if (prevRepo && prevRepo.updated_at === repo.updated_at) {
        // 변경 없음
        return false;
      }

      // 파일 수집
      const files = await this.collectFiles(repo.owner.login, repo.name, 'master');

      for (const file of files) {
        repoInfo.files[file.path] = {
          path: file.path,
          sha: file.sha,
          size: file.size || 0,
          type: file.type // 'file' or 'dir'
        };
      }

      // 인덱스 업데이트
      const prevFileCount = prevRepo ? Object.keys(prevRepo.files).length : 0;
      const prevSize = prevRepo ? prevRepo.size : 0;

      this.index.repositories[repoKey] = repoInfo;
      this.index.fileCount = this.index.fileCount - prevFileCount + Object.keys(repoInfo.files).length;
      this.index.totalSize = this.index.totalSize - prevSize + repoInfo.size;

      changed = true;

    } catch (e) {
      console.warn(`⚠ ${repoKey} 스캔 실패: ${e.message}`);
    }

    return changed;
  }

  /**
   * 저장소 파일 수집
   */
  async collectFiles(owner, repo, ref = 'master') {
    const files = [];

    try {
      const tree = await this.client.getTreeContents(owner, repo, ref);

      if (!tree || !tree.tree) {
        return files;
      }

      for (const item of tree.tree) {
        // 특정 확장자만 수집
        if (item.type === 'blob' && this.isRelevantFile(item.path)) {
          files.push({
            path: item.path,
            sha: item.sha,
            size: item.size || 0,
            type: 'file'
          });
        }
      }
    } catch (e) {
      console.warn(`⚠ ${owner}/${repo} 파일 수집 실패: ${e.message}`);
    }

    return files;
  }

  /**
   * 관련 파일 여부 확인
   */
  isRelevantFile(filepath) {
    const ext = path.extname(filepath);
    return this.fileExtensions.includes(ext);
  }

  /**
   * 저장소 통계 조회
   */
  getStatistics() {
    return {
      totalRepositories: Object.keys(this.index.repositories).length,
      totalFiles: this.index.fileCount,
      totalSize: this.index.totalSize,
      averageFilesPerRepo: this.index.fileCount / Object.keys(this.index.repositories).length,
      lastUpdated: this.index.lastUpdated
    };
  }

  /**
   * 특정 저장소의 파일 목록
   */
  getRepositoryFiles(owner, repo) {
    const repoKey = `${owner}/${repo}`;
    const repoInfo = this.index.repositories[repoKey];
    return repoInfo ? repoInfo.files : null;
  }

  /**
   * 저장소 검색
   */
  searchRepositories(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, repo] of Object.entries(this.index.repositories)) {
      if (key.includes(lowerQuery) ||
          repo.name.toLowerCase().includes(lowerQuery) ||
          repo.description.toLowerCase().includes(lowerQuery)) {
        results.push({ key, ...repo });
      }
    }

    return results;
  }
}

export default Scraper;
