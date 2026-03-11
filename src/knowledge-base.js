/**
 * JSON 기반 지식 베이스 (npm zero-dependency)
 *
 * 역할:
 * - 청크, 커밋, 파일, 키워드 저장
 * - 전문검색 (FTS) - 간단한 구현
 * - 역인덱스 (keyword → chunks)
 * - 통계
 */

import fs from 'fs';
import path from 'path';

class KnowledgeBase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || './data/knowledge-base.json';
    this.data = {
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '0.1.0'
      },
      chunks: [],
      commits: [],
      files: [],
      keywords: {},
      adr: []
    };

    this.load();
  }

  /**
   * 디스크에서 로드
   */
  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        const loaded = JSON.parse(content);

        // 요약 정보만 로드된 경우 (메모리 기반 사용)
        if (loaded.stats && !loaded.chunks) {
          // 메타데이터만 업데이트
          this.data.metadata = loaded.metadata || this.data.metadata;
        } else {
          // 전체 데이터 로드
          this.data = loaded;
        }
      }
    } catch (e) {
      console.warn(`⚠️  KB 로드 실패: ${e.message} (새로 생성합니다)`);
      // 로드 실패 시 data 초기화 (이미 constructor에서 했음)
    }

    // data가 없으면 초기화
    if (!this.data || !this.data.chunks) {
      this.data = {
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '0.1.0'
        },
        chunks: [],
        commits: [],
        files: [],
        keywords: {},
        adr: []
      };
    }
  }

  /**
   * 디스크에 저장 (청크와 커밋만 저장, 메타 정보는 메모리에만)
   */
  save() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      // 요약 정보만 저장 (전체 청크는 메모리에만 유지)
      const summary = {
        metadata: this.data.metadata,
        stats: {
          totalChunks: this.data.chunks.length,
          totalCommits: this.data.commits.length,
          uniqueKeywords: Object.keys(this.data.keywords).length,
          repositories: [...new Set(this.data.chunks.map(c => c.meta.repo))],
          languages: [...new Set(this.data.chunks.map(c => c.meta.language))]
        }
      };

      this.data.metadata.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.dbPath, JSON.stringify(summary, null, 2));
      console.log(`✓ 지식 베이스 요약 저장 (${summary.stats.totalChunks}개 청크, 메모리에만 유지)`);
    } catch (e) {
      console.warn(`⚠️  저장 실패: ${e.message} (데이터는 메모리에만 유지)`);
    }
  }

  /**
   * 청크 추가
   */
  addChunk(chunk) {
    this.data.chunks.push(chunk);
    // 키워드 인덱싱은 나중에 buildKeywordIndex()로 한 번에 수행
  }

  /**
   * 모든 청크의 키워드 인덱스 구축 (한 번에 수행)
   */
  buildKeywordIndex() {
    console.log('\n📚 키워드 인덱싱 중...');
    const startTime = Date.now();

    const tempKeywords = {};
    this.data.chunks.forEach((chunk, idx) => {
      if (idx % 50000 === 0 && idx > 0) process.stdout.write(`(${idx})`);

      try {
        const keywords = this.extractKeywords((chunk.content || '') + ' ' + (chunk.name || ''));
        keywords.forEach(kw => {
          if (!tempKeywords[kw]) {
            tempKeywords[kw] = [];
          }
          tempKeywords[kw].push(chunk.id);
        });
      } catch (e) {
        // 개별 청크 키워드 추출 오류 무시
      }
    });

    this.data.keywords = tempKeywords;
    const elapsed = Date.now() - startTime;
    console.log(`\n✓ 키워드 인덱싱 완료: ${Object.keys(tempKeywords).length}개 키워드 (${(elapsed / 1000).toFixed(1)}초)\n`);
  }

  /**
   * 청크 여러 개 추가
   */
  addChunks(chunks) {
    chunks.forEach(c => this.addChunk(c));
  }

  /**
   * 커밋 추가
   */
  addCommit(commit) {
    this.data.commits.push(commit);

    if (commit.isADR) {
      this.data.adr.push(commit);
    }
  }

  /**
   * 파일 메타데이터 추가
   */
  addFile(file) {
    this.data.files.push({
      path: file.path,
      repo: file.repo,
      sha: file.sha,
      size: file.size,
      addedAt: new Date().toISOString()
    });
  }

  /**
   * 키워드 추출 (간단한 버전)
   */
  extractKeywords(text) {
    const words = text.toLowerCase()
      .replace(/[^a-z0-9_한-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    return [...new Set(words)].slice(0, 10);
  }

  /**
   * 키워드 검색
   */
  searchByKeyword(keyword) {
    const lowerKw = keyword.toLowerCase();
    const results = [];

    // 정확히 일치하는 키워드
    if (this.data.keywords[lowerKw]) {
      this.data.keywords[lowerKw].forEach(chunkId => {
        const chunk = this.data.chunks.find(c => c.id === chunkId);
        if (chunk) results.push(chunk);
      });
    }

    // 부분 일치
    const matching = Object.keys(this.data.keywords)
      .filter(k => k.includes(lowerKw) && k !== lowerKw);

    matching.forEach(k => {
      this.data.keywords[k].forEach(chunkId => {
        const chunk = this.data.chunks.find(c => c.id === chunkId);
        if (chunk && !results.find(r => r.id === chunk.id)) {
          results.push(chunk);
        }
      });
    });

    return results;
  }

  /**
   * 저장소별 검색
   */
  searchByRepository(repo) {
    return this.data.chunks.filter(c => c.meta.repo === repo);
  }

  /**
   * 함수명 검색
   */
  searchByName(name) {
    const lower = name.toLowerCase();
    return this.data.chunks.filter(c => c.name.toLowerCase().includes(lower));
  }

  /**
   * 전체 텍스트 검색 (간단한 버전)
   */
  search(query) {
    const lower = query.toLowerCase();

    return this.data.chunks.filter(c => {
      return c.name.toLowerCase().includes(lower) ||
             c.content.toLowerCase().includes(lower) ||
             c.meta.file.toLowerCase().includes(lower);
    }).slice(0, 20);
  }

  /**
   * ADR 검색
   */
  getADRs() {
    return this.data.adr;
  }

  /**
   * Phase별 커밋
   */
  getCommitsByPhase(phase) {
    return this.data.commits.filter(c => c.phase === phase);
  }

  /**
   * 통계 조회
   */
  getStatistics() {
    return {
      totalChunks: this.data.chunks.length,
      totalCommits: this.data.commits.length,
      totalFiles: this.data.files.length,
      uniqueKeywords: Object.keys(this.data.keywords).length,
      adrCount: this.data.adr.length,
      repositories: [...new Set(this.data.chunks.map(c => c.meta.repo))].length,
      languages: [...new Set(this.data.chunks.map(c => c.meta.language))],
      lastUpdated: this.data.metadata.updatedAt
    };
  }

  /**
   * 청크 개수
   */
  countChunks() {
    return this.data.chunks.length;
  }

  /**
   * 저장소 목록
   */
  getRepositories() {
    return [...new Set(this.data.chunks.map(c => c.meta.repo))];
  }
}

export default KnowledgeBase;
