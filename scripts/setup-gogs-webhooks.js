#!/usr/bin/env node

/**
 * GOGS 저장소 웹훅 자동 설정
 * 사용: node scripts/setup-gogs-webhooks.js
 */

import GogsApiClient from '../src/gogs-api-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 환경 변수 로드
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env 파일이 없습니다');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  content.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && !key.startsWith('#')) {
      env[key.trim()] = value?.trim().replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

async function main() {
  console.log('\n🔧 GOGS Architect - 웹훅 자동 설정\n');

  const env = loadEnv();

  const gogsUrl = env.GOGS_BASE_URL;
  const apiToken = env.GOGS_API_TOKEN;
  const username = env.GOGS_USERNAME;
  const webhookUrl = env.GOGS_WEBHOOK_URL;

  // 필수 설정 검증
  if (!gogsUrl || !apiToken || !username || !webhookUrl) {
    console.error('❌ 필수 환경 변수가 설정되지 않았습니다:');
    if (!gogsUrl) console.error('  - GOGS_BASE_URL');
    if (!apiToken) console.error('  - GOGS_API_TOKEN');
    if (!username) console.error('  - GOGS_USERNAME');
    if (!webhookUrl) console.error('  - GOGS_WEBHOOK_URL');
    process.exit(1);
  }

  console.log(`📍 GOGS 서버: ${gogsUrl}`);
  console.log(`👤 사용자명: ${username}`);
  console.log(`🔗 웹훅 URL: ${webhookUrl}\n`);

  const client = new GogsApiClient(gogsUrl, apiToken);

  try {
    // 1. 사용자 정보 확인
    console.log('단계 1️⃣  사용자 정보 확인 중...');
    const userResult = await client.getCurrentUser();

    if (!userResult.success) {
      console.error(`❌ API 토큰 검증 실패: ${userResult.error}`);
      process.exit(1);
    }

    console.log(`✅ 인증 성공: ${userResult.user.login}`);

    // 2. 저장소 목록 조회
    console.log('\n단계 2️⃣  저장소 목록 조회 중...');
    const repoResult = await client.listRepositories(username);

    if (!repoResult.success) {
      console.error(`❌ 저장소 조회 실패: ${repoResult.error}`);
      process.exit(1);
    }

    const repos = repoResult.repositories;
    console.log(`✅ 총 ${repos.length}개의 저장소를 찾았습니다\n`);

    if (repos.length === 0) {
      console.warn('⚠️  저장소가 없습니다');
      process.exit(0);
    }

    // 3. 각 저장소에 웹훅 등록
    console.log('단계 3️⃣  웹훅 등록 진행 중...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const repo of repos) {
      process.stdout.write(`  📦 ${repo.full_name}... `);

      // 기존 웹훅 확인
      const hooksResult = await client.listWebhooks(username, repo.name);

      if (!hooksResult.success) {
        console.log(`⚠️  웹훅 확인 실패`);
        errorCount++;
        continue;
      }

      // 같은 URL의 웹훅이 이미 있는지 확인
      const exists = hooksResult.webhooks?.some(hook =>
        hook.config?.url === webhookUrl
      );

      if (exists) {
        console.log(`⏭️  이미 등록됨`);
        skipCount++;
        continue;
      }

      // 웹훅 등록
      const createResult = await client.createWebhook(username, repo.name, {
        url: webhookUrl,
        events: ['push', 'create', 'delete']
      });

      if (createResult.success) {
        console.log(`✅ 등록됨`);
        successCount++;
      } else {
        console.log(`❌ 실패: ${createResult.error}`);
        errorCount++;
      }

      // API 레이트 리밋 고려
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4. 최종 요약
    console.log('\n' + '='.repeat(50));
    console.log('📊 웹훅 설정 완료\n');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`⏭️  이미 등록됨: ${skipCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log('='.repeat(50) + '\n');

    if (successCount > 0) {
      console.log('🎉 웹훅 설정이 완료되었습니다!');
      console.log(`이제 GOGS 저장소의 push, create, delete 이벤트가`);
      console.log(`자동으로 ${webhookUrl}로 전송됩니다.\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ 오류: ${error.message}`);
    process.exit(1);
  }
}

main();
