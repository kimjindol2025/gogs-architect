/**
 * 277개 Gogs 저장소에 Webhook 자동 등록
 * 
 * 사용법:
 *   export GOGS_TOKEN=...
 *   node src/register-webhooks.js
 */

import GogsClient from './gogs-client.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:9999/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';
const BATCH_SIZE = 5; // 동시 요청 수

class WebhookRegistrar {
  constructor() {
    this.client = new GogsClient();
    this.results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  /**
   * 저장소 목록 조회 (페이지 처리)
   */
  async getRepositories() {
    console.log('📋 Gogs 저장소 조회 중...\n');
    try {
      let allRepos = [];
      let page = 1;

      while (true) {
        const repos = await this.client.getUserRepos(page, 50);

        if (!repos || repos.length === 0) break;

        allRepos = allRepos.concat(repos);
        console.log(`  페이지 ${page}: ${repos.length}개 조회`);

        if (repos.length < 50) break;
        page++;
      }

      console.log(`\n✓ 총 ${allRepos.length}개 저장소 발견\n`);
      return allRepos;
    } catch (error) {
      console.error(`❌ 저장소 조회 실패: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * 단일 저장소에 Webhook 등록
   */
  async registerWebhook(owner, repo) {
    try {
      // 기존 Webhook 확인
      const hooks = await this.client.getWebhooks(owner, repo);
      const existing = hooks.data?.find(h => h.config.url === WEBHOOK_URL);
      
      if (existing) {
        console.log(`  ⏭️  ${repo} - 이미 등록됨 (ID: ${existing.id})`);
        this.results.skipped++;
        return true;
      }

      // Webhook 등록
      const result = await this.client.createWebhook(owner, repo, WEBHOOK_URL, {
        secret: WEBHOOK_SECRET,
        events: ['push'],
        active: true
      });

      if (result.status === 201) {
        console.log(`  ✅ ${repo} - 등록 완료 (ID: ${result.data.id})`);
        this.results.success++;
        return true;
      } else {
        console.log(`  ❌ ${repo} - HTTP ${result.status}`);
        this.results.failed++;
        this.results.errors.push(`${repo}: HTTP ${result.status}`);
        return false;
      }
    } catch (error) {
      console.log(`  ❌ ${repo} - ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`${repo}: ${error.message}`);
      return false;
    }
  }

  /**
   * 배치 처리 (동시 요청 제한)
   */
  async registerBatch(repos) {
    console.log(`🔗 Webhook 등록 중 (배치 크기: ${BATCH_SIZE})...\n`);
    
    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(repos.length / BATCH_SIZE);
      
      console.log(`[배치 ${batchNum}/${totalBatches}]`);
      
      const promises = batch.map(repo =>
        this.registerWebhook('kim', repo.name)
      );
      
      await Promise.all(promises);
      
      // 배치 간 대기
      if (i + BATCH_SIZE < repos.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * 최종 보고
   */
  printSummary() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Webhook 등록 결과');
    console.log('═'.repeat(50));
    console.log(`✅ 성공: ${this.results.success}`);
    console.log(`❌ 실패: ${this.results.failed}`);
    console.log(`⏭️  건너뜀: ${this.results.skipped}`);
    console.log(`합계: ${this.results.success + this.results.failed + this.results.skipped}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n⚠️  오류 목록:');
      this.results.errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err}`);
      });
      if (this.results.errors.length > 5) {
        console.log(`   ... 외 ${this.results.errors.length - 5}개`);
      }
    }
    
    console.log('\n🔗 Webhook URL:', WEBHOOK_URL);
    console.log('📍 Secret: ' + WEBHOOK_SECRET.substring(0, 10) + '***');
  }

  /**
   * 실행
   */
  async run() {
    const repos = await this.getRepositories();
    await this.registerBatch(repos);
    this.printSummary();
  }
}

// 실행
const registrar = new WebhookRegistrar();
registrar.run().catch(error => {
  console.error('❌ 치명적 오류:', error.message);
  process.exit(1);
});
