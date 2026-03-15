/**
 * Database Integration Layer
 * 
 * 역할:
 * - 메모리 기반 검색 인덱스 영속화
 * - 저장소 메타데이터 관리
 * - 재시작 후 상태 복구
 * - 트랜잭션 기반 연산
 */

import fs from 'fs';
import path from 'path';

class DatabaseIntegration {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDir();

    // 메모리 캐시
    this.repositories = new Map();
    this.searchIndex = new Map();
    this.stats = {
      totalIndexed: 0,
      totalAdded: 0,
      totalUpdated: 0,
      lastIndexTime: null
    };

    // 파일 경로
    this.repoFile = path.join(dataDir, 'repositories.json');
    this.indexFile = path.join(dataDir, 'search-index.json');
    this.statsFile = path.join(dataDir, 'statistics.json');

    this.load();
  }

  /**
   * 데이터 디렉토리 생성
   */
  ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`📁 데이터 디렉토리 생성: ${this.dataDir}`);
    }
  }

  /**
   * 디스크에서 데이터 로드
   */
  load() {
    try {
      // 저장소 메타데이터 로드
      if (fs.existsSync(this.repoFile)) {
        const data = JSON.parse(fs.readFileSync(this.repoFile, 'utf-8'));
        this.repositories = new Map(Object.entries(data));
        console.log(`✅ ${this.repositories.size}개 저장소 로드`);
      }

      // 검색 인덱스 로드
      if (fs.existsSync(this.indexFile)) {
        const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf-8'));
        this.searchIndex = new Map(Object.entries(data));
        console.log(`✅ ${this.searchIndex.size}개 검색 항목 로드`);
      }

      // 통계 로드
      if (fs.existsSync(this.statsFile)) {
        this.stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf-8'));
        console.log(`✅ 통계 로드: ${this.stats.totalIndexed}개 인덱싱`);
      }
    } catch (error) {
      console.error(`⚠️  데이터 로드 실패:`, error.message);
    }
  }

  /**
   * 디스크에 데이터 저장
   */
  save() {
    try {
      const timestamp = new Date().toISOString();

      // 저장소 메타데이터 저장
      const repoData = Object.fromEntries(this.repositories);
      fs.writeFileSync(
        this.repoFile,
        JSON.stringify(repoData, null, 2),
        'utf-8'
      );

      // 검색 인덱스 저장
      const indexData = Object.fromEntries(this.searchIndex);
      fs.writeFileSync(
        this.indexFile,
        JSON.stringify(indexData, null, 2),
        'utf-8'
      );

      // 통계 저장 (타임스탐프 포함)
      this.stats.lastSaveTime = timestamp;
      fs.writeFileSync(
        this.statsFile,
        JSON.stringify(this.stats, null, 2),
        'utf-8'
      );

      console.log(`💾 데이터 저장 완료 (${timestamp})`);
    } catch (error) {
      console.error(`❌ 데이터 저장 실패:`, error.message);
    }
  }

  /**
   * 저장소 추가
   */
  addRepository(repo) {
    const { id, name, url, files, chunks } = repo;

    // 저장소 메타데이터
    this.repositories.set(id, {
      id,
      name,
      url,
      fileCount: files?.length || 0,
      chunkCount: chunks?.length || 0,
      addedAt: new Date().toISOString(),
      status: 'active'
    });

    // 검색 인덱스 추가
    if (chunks) {
      chunks.forEach((chunk, idx) => {
        const key = `${id}_chunk_${idx}`;
        this.searchIndex.set(key, {
          repoId: id,
          repoName: name,
          chunkIdx: idx,
          content: chunk.content,
          line: chunk.line
        });
      });
    }

    this.stats.totalAdded++;
    this.stats.totalIndexed++;
    this.save();

    console.log(`✨ 저장소 추가: ${name} (${chunks?.length || 0}개 청크)`);
    return { success: true, repo: name };
  }

  /**
   * 저장소 업데이트
   */
  updateRepository(id, changes) {
    if (!this.repositories.has(id)) {
      console.warn(`⚠️  저장소 없음: ${id}`);
      return { success: false, error: 'Repository not found' };
    }

    const existing = this.repositories.get(id);
    const updated = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString()
    };

    this.repositories.set(id, updated);

    // 검색 인덱스 갱신
    const keysToDelete = [];
    for (const key of this.searchIndex.keys()) {
      if (key.startsWith(`${id}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.searchIndex.delete(key));

    // 새 청크 인덱싱
    if (changes.chunks) {
      changes.chunks.forEach((chunk, idx) => {
        const key = `${id}_chunk_${idx}`;
        this.searchIndex.set(key, {
          repoId: id,
          repoName: updated.name,
          chunkIdx: idx,
          content: chunk.content,
          line: chunk.line
        });
      });
    }

    this.stats.totalUpdated++;
    this.stats.totalIndexed++;
    this.save();

    console.log(`🔄 저장소 업데이트: ${updated.name}`);
    return { success: true, repo: updated.name };
  }

  /**
   * 저장소 제거
   */
  removeRepository(id) {
    if (!this.repositories.has(id)) {
      console.warn(`⚠️  저장소 없음: ${id}`);
      return { success: false };
    }

    const name = this.repositories.get(id).name;
    this.repositories.delete(id);

    // 검색 인덱스에서 제거
    const keysToDelete = [];
    for (const key of this.searchIndex.keys()) {
      if (key.startsWith(`${id}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.searchIndex.delete(key));

    this.stats.totalIndexed++;
    this.save();

    console.log(`🗑️  저장소 제거: ${name}`);
    return { success: true, repo: name };
  }

  /**
   * 저장소 목록 조회
   */
  getRepositories() {
    return Array.from(this.repositories.values());
  }

  /**
   * 저장소 ID 목록
   */
  getRepositoryIds() {
    return Array.from(this.repositories.keys());
  }

  /**
   * 저장소 조회
   */
  getRepository(id) {
    return this.repositories.get(id) || null;
  }

  /**
   * 검색 인덱스 조회
   */
  searchIndex(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [key, value] of this.searchIndex.entries()) {
      if (
        value.content.toLowerCase().includes(queryLower) ||
        value.repoName.toLowerCase().includes(queryLower)
      ) {
        results.push({
          key,
          ...value,
          match: true
        });
      }
    }

    return results;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      repositoryCount: this.repositories.size,
      indexSize: this.searchIndex.size,
      dataDir: this.dataDir
    };
  }

  /**
   * 데이터베이스 초기화
   */
  reset() {
    this.repositories.clear();
    this.searchIndex.clear();
    this.stats = {
      totalIndexed: 0,
      totalAdded: 0,
      totalUpdated: 0,
      lastIndexTime: null
    };

    // 파일 삭제
    [this.repoFile, this.indexFile, this.statsFile].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    console.log('🔄 데이터베이스 초기화 완료');
  }

  /**
   * 데이터 덤프 (디버깅용)
   */
  dump() {
    return {
      repositories: Array.from(this.repositories.entries()),
      searchIndexSize: this.searchIndex.size,
      stats: this.stats,
      dataFiles: {
        repositories: fs.existsSync(this.repoFile),
        searchIndex: fs.existsSync(this.indexFile),
        statistics: fs.existsSync(this.statsFile)
      }
    };
  }
}

export default DatabaseIntegration;
