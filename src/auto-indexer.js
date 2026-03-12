/**
 * Auto-Indexer 에이전트
 *
 * 역할:
 * - 새 저장소 감지 (Webhook 수신)
 * - 자동 인덱싱 (코드 스캔/파싱)
 * - DB 자동 업데이트 (증분)
 * - 캐시 자동 갱신
 * - 실시간 검색 엔진 반영
 *
 * 작동 방식:
 * 1. Webhook 이벤트 받음
 * 2. 저장소 분석 (병렬)
 * 3. 청크 생성
 * 4. DB에 추가
 * 5. 검색 엔진 갱신
 * 6. 통계 업데이트
 */

class AutoIndexer {
  constructor(gogsClient, kb, searchEnhanced) {
    this.gogsClient = gogsClient;
    this.kb = kb;
    this.searchEnhanced = searchEnhanced;

    // 상태 관리
    this.state = {
      isIndexing: false,
      queue: [], // 대기 중인 저장소
      stats: {
        totalIndexed: 0,
        totalAdded: 0,
        totalUpdated: 0,
        lastIndexTime: null,
        nextScheduledRun: null
      }
    };

    // 설정
    this.config = {
      batchSize: 5, // 동시 처리 개수
      maxQueueSize: 100,
      debounceMs: 2000, // 중복 요청 방지
      scheduleInterval: 3600000 // 1시간마다 전체 동기화
    };

    this.lastEventTime = {};
  }

  /**
   * Webhook 이벤트 처리 (Gogs push/create 이벤트)
   */
  async handleWebhookEvent(event) {
    const { action, repository } = event;
    const repoId = repository.id;
    const repoName = repository.full_name;

    console.log(`📨 Webhook 이벤트: ${action} (${repoName})`);

    // 중복 요청 방지 (2초 내 같은 저장소 이벤트 무시)
    const now = Date.now();
    if (this.lastEventTime[repoId] && now - this.lastEventTime[repoId] < this.config.debounceMs) {
      console.log(`⏭️  중복 요청 무시 (${repoName})`);
      return;
    }
    this.lastEventTime[repoId] = now;

    // 이벤트별 처리
    if (action === 'push') {
      await this.handlePush(repository);
    } else if (action === 'create' || action === 'created') {
      await this.handleCreate(repository);
    } else if (action === 'delete' || action === 'deleted') {
      await this.handleDelete(repository);
    }
  }

  /**
   * Push 이벤트 처리 (코드 변경)
   */
  async handlePush(repository) {
    const repoName = repository.full_name;
    console.log(`📝 Push 감지: ${repoName}`);

    // 큐에 추가
    this.enqueueRepository({
      id: repository.id,
      name: repoName,
      url: repository.clone_url,
      action: 'update', // 기존 저장소 업데이트
      priority: 'high'
    });
  }

  /**
   * Create 이벤트 처리 (신규 저장소)
   */
  async handleCreate(repository) {
    const repoName = repository.full_name;
    console.log(`✨ 신규 저장소 감지: ${repoName}`);

    // 큐에 추가
    this.enqueueRepository({
      id: repository.id,
      name: repoName,
      url: repository.clone_url,
      action: 'add', // 신규 저장소
      priority: 'high'
    });
  }

  /**
   * Delete 이벤트 처리 (저장소 삭제)
   */
  async handleDelete(repository) {
    const repoName = repository.full_name;
    console.log(`🗑️  저장소 삭제: ${repoName}`);

    // DB에서 제거
    this.kb.removeRepository(repository.id);
    this.searchEnhanced.invalidateCache(repository.id);

    this.state.stats.totalIndexed++;
  }

  /**
   * 저장소를 큐에 추가
   */
  enqueueRepository(repo) {
    if (this.state.queue.length >= this.config.maxQueueSize) {
      console.warn(`⚠️  큐 가득 참 (${this.config.maxQueueSize}), 오래된 항목 제거`);
      this.state.queue.shift();
    }

    this.state.queue.push(repo);
    console.log(`📦 큐 추가: ${repo.name} (대기: ${this.state.queue.length})`);

    // 즉시 처리 시작 (아직 인덱싱 중이 아니면)
    if (!this.state.isIndexing) {
      this.processQueue();
    }
  }

  /**
   * 큐 처리 (병렬)
   */
  async processQueue() {
    if (this.state.isIndexing || this.state.queue.length === 0) {
      return;
    }

    this.state.isIndexing = true;
    console.log(`🔄 큐 처리 시작 (${this.state.queue.length}개)`);

    try {
      while (this.state.queue.length > 0) {
        // 배치 크기만큼 추출
        const batch = this.state.queue.splice(
          0,
          Math.min(this.config.batchSize, this.state.queue.length)
        );

        // 병렬 처리
        const results = await Promise.allSettled(
          batch.map(repo => this.indexRepository(repo))
        );

        // 결과 처리
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'fulfilled') {
            const { action, success } = results[i].value;
            if (action === 'add') {
              this.state.stats.totalAdded++;
            } else if (action === 'update') {
              this.state.stats.totalUpdated++;
            }
            this.state.stats.totalIndexed++;
          } else {
            console.error(`❌ 인덱싱 실패: ${batch[i].name}`, results[i].reason);
          }
        }

        // 배치 간 딜레이
        await new Promise(r => setTimeout(r, 100));
      }
    } finally {
      this.state.isIndexing = false;
      this.state.stats.lastIndexTime = new Date().toISOString();
      console.log(`✅ 큐 처리 완료`);
    }
  }

  /**
   * 단일 저장소 인덱싱
   */
  async indexRepository(repo) {
    const { name, id, action } = repo;

    console.log(`  📂 인덱싱: ${name}`);

    try {
      // 모의 분석 (실제로는 Git 클론 + 스캔)
      const analysis = this.analyzeRepository(repo);

      // DB에 저장
      if (action === 'add') {
        this.kb.addRepository({
          id,
          name,
          files: analysis.files,
          chunks: analysis.chunks,
          commits: analysis.commits
        });
      } else if (action === 'update') {
        this.kb.updateRepository(id, {
          files: analysis.files,
          chunks: analysis.chunks
        });
      }

      // 검색 엔진 캐시 갱신
      this.searchEnhanced.invalidateCache(id);

      console.log(`  ✅ ${name} 인덱싱 완료 (${analysis.chunks.length}개 청크)`);

      return { action, success: true, repo: name };
    } catch (error) {
      console.error(`  ❌ ${name} 인덱싱 실패:`, error.message);
      return { action, success: false, error: error.message };
    }
  }

  /**
   * 저장소 분석 (모의)
   */
  analyzeRepository(repo) {
    // 실제로는:
    // 1. Git 클론
    // 2. 파일 리스트 추출
    // 3. 코드 파싱
    // 4. 청크 생성
    // 5. 커밋 분석

    // 여기서는 모의 데이터
    return {
      files: [
        { path: 'src/main.js', lines: 245 },
        { path: 'src/utils.js', lines: 156 },
        { path: 'README.md', lines: 89 }
      ],
      chunks: [
        { content: 'function main() { ... }', line: 10 },
        { content: 'class Analyzer { ... }', line: 45 },
        { content: 'export default Analyzer', line: 78 }
      ],
      commits: [
        { hash: 'abc123', message: 'feat: add feature', date: new Date() },
        { hash: 'def456', message: 'fix: bug fix', date: new Date() }
      ]
    };
  }

  /**
   * 정기적 전체 동기화 (크론)
   */
  async scheduleFullSync() {
    console.log(`⏰ 정기 동기화 스케줄 설정 (${this.config.scheduleInterval / 1000 / 60}분마다)`);

    setInterval(async () => {
      await this.fullSync();
    }, this.config.scheduleInterval);
  }

  /**
   * 전체 동기화 (모든 저장소)
   */
  async fullSync() {
    console.log(`🔄 전체 동기화 시작...`);

    const startTime = Date.now();

    try {
      // Gogs에서 모든 저장소 조회
      const allRepos = await this.gogsClient.getAllRepositories();
      const currentRepos = this.kb.getRepositoryIds();

      // 신규 저장소 찾기
      const newRepos = allRepos.filter(
        r => !currentRepos.includes(r.id)
      );

      // 삭제된 저장소 찾기
      const deletedRepos = currentRepos.filter(
        id => !allRepos.some(r => r.id === id)
      );

      console.log(`  신규: ${newRepos.length}개, 삭제: ${deletedRepos.length}개`);

      // 신규 저장소 추가
      for (const repo of newRepos) {
        this.enqueueRepository({
          id: repo.id,
          name: repo.full_name,
          url: repo.clone_url,
          action: 'add',
          priority: 'low' // 정기 동기화는 낮은 우선도
        });
      }

      // 삭제된 저장소 제거
      for (const repoId of deletedRepos) {
        this.kb.removeRepository(repoId);
        this.searchEnhanced.invalidateCache(repoId);
      }

      // 큐 처리
      await this.processQueue();

      const duration = Date.now() - startTime;
      this.state.stats.nextScheduledRun = new Date(
        Date.now() + this.config.scheduleInterval
      ).toISOString();

      console.log(`✅ 전체 동기화 완료 (${duration}ms)`);
    } catch (error) {
      console.error(`❌ 전체 동기화 실패:`, error.message);
    }
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      isIndexing: this.state.isIndexing,
      queueSize: this.state.queue.length,
      stats: {
        ...this.state.stats,
        uptime: process.uptime()
      },
      config: this.config,
      nextActions: this.state.queue.slice(0, 3).map(r => ({
        name: r.name,
        action: r.action,
        priority: r.priority
      }))
    };
  }

  /**
   * 통계 리포트
   */
  generateReport() {
    const { totalIndexed, totalAdded, totalUpdated, lastIndexTime } = this.state.stats;

    return {
      title: '🤖 Auto-Indexer 에이전트 리포트',
      summary: {
        총처리: totalIndexed,
        신규추가: totalAdded,
        업데이트: totalUpdated,
        마지막갱신: lastIndexTime
      },
      queue: {
        대기중: this.state.queue.length,
        처리중: this.state.isIndexing
      },
      health: {
        상태: this.state.isIndexing ? '🟡 처리 중' : '🟢 정상',
        다음정기동기: this.state.stats.nextScheduledRun
      }
    };
  }
}

export default AutoIndexer;
