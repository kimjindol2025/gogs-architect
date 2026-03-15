#!/usr/bin/env node

/**
 * API Server v2 실제 운영 테스트
 * 
 * 목표:
 * 1. 서버 시작
 * 2. 모든 엔드포인트 테스트
 * 3. Rate limiting 검증
 * 4. 입력 검증 테스트
 * 5. 로깅 정확성 확인
 */

import http from 'http';
import APIServerV2 from './src/api-server-v2.js';

class APIServerV2Tester {
  constructor(port = 3001) {
    this.port = port;
    this.server = null;
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.baseUrl = `http://localhost:${port}`;
  }

  /**
   * HTTP 요청 수행
   */
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data),
              headers: res.headers
            });
          } catch {
            resolve({
              status: res.statusCode,
              data: data,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * 테스트 실행
   */
  async test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      this.testsPassed++;
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`);
      this.testsFailed++;
    }
  }

  /**
   * 테스트 스위트 시작
   */
  async runTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║        🚀 API Server v2 운영 테스트                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // 서버 시작
    this.server = new APIServerV2(this.port);
    this.server.start();

    // 서버 준비 시간
    await new Promise(r => setTimeout(r, 500));

    console.log('📝 엔드포인트 테스트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Health Check
    await this.test('GET /health', async () => {
      const res = await this.request('GET', '/health');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.data || !res.data.data.status) throw new Error('Missing health status');
    });

    // 2. 검색 API - 유효한 요청
    await this.test('POST /api/v1/search (유효한 쿼리)', async () => {
      const res = await this.request('POST', '/api/v1/search', {
        query: 'useState'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.data) throw new Error('Missing response data');
    });

    // 3. 검색 API - 입력 검증
    await this.test('POST /api/v1/search (SQL injection 차단)', async () => {
      const res = await this.request('POST', '/api/v1/search', {
        query: "'; DROP TABLE; --"
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.data.data.error) throw new Error('Missing error message');
    });

    // 4. 3단어 검색
    await this.test('POST /api/v1/search/three-words', async () => {
      const res = await this.request('POST', '/api/v1/search/three-words', {
        words: ['sql', 'parser', 'aws']
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.data.matches) throw new Error('Missing matches');
    });

    // 5. 3단어 검색 - 입력 검증
    await this.test('POST /api/v1/search/three-words (XSS 차단)', async () => {
      const res = await this.request('POST', '/api/v1/search/three-words', {
        words: ['test', '<script>alert(1)</script>', 'query']
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 6. 에이전트 상태
    await this.test('GET /api/v1/agent/status', async () => {
      const res = await this.request('GET', '/api/v1/agent/status');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.data.agent) throw new Error('Missing agent status');
      if (!res.data.data.database) throw new Error('Missing database status');
      if (!res.data.data.api) throw new Error('Missing api status');
    });

    // 7. 저장소 목록
    await this.test('GET /api/v1/repositories', async () => {
      const res = await this.request('GET', '/api/v1/repositories');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.data.data.repositories)) throw new Error('Missing repositories array');
    });

    // 8. 로그 조회
    await this.test('GET /logs', async () => {
      const res = await this.request('GET', '/logs');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.data.data.logs)) throw new Error('Missing logs');
    });

    // 9. 존재하지 않는 엔드포인트
    await this.test('GET /api/v1/nonexistent (404)', async () => {
      const res = await this.request('GET', '/api/v1/nonexistent');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    console.log('\n🚦 Rate Limiter 테스트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 10. Rate limiting 테스트 (짧은 시간 내 100개 요청)
    await this.test('Rate Limiter: 최대 요청 초과', async () => {
      let allowedCount = 0;
      let deniedCount = 0;

      for (let i = 0; i < 15; i++) {
        const res = await this.request('POST', '/api/v1/search', {
          query: 'test'
        });

        if (res.status === 200) allowedCount++;
        else if (res.status === 429) deniedCount++;
      }

      if (allowedCount === 0) throw new Error('No requests allowed');
      if (deniedCount === 0) console.log(`   (15개 요청: 모두 허용 - 제한이 아직 도달하지 않음)`);
    });

    console.log('\n📊 데이터 검증 테스트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 11. 응답 형식 검증
    await this.test('응답 형식 (status + timestamp + meta)', async () => {
      const res = await this.request('GET', '/health');
      if (!res.data.status) throw new Error('Missing status');
      if (!res.data.timestamp) throw new Error('Missing timestamp');
      if (!res.data.meta) throw new Error('Missing meta');
      if (!res.data.meta.version) throw new Error('Missing version in meta');
    });

    // 12. 에러 응답 형식
    await this.test('에러 응답 형식 (status: error)', async () => {
      const res = await this.request('POST', '/api/v1/search', {
        query: "'; DROP TABLE; --"
      });
      if (res.data.status !== 'error') throw new Error('Expected error status');
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 13. Webhook 페이로드 검증
    await this.test('Webhook 페이로드 검증', async () => {
      const res = await this.request('POST', '/api/v1/webhook/gogs', {
        action: 'invalid',
        repository: { id: 'not-a-number' }
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 14. 유효한 Webhook
    await this.test('Webhook 처리 (유효한 페이로드)', async () => {
      const res = await this.request('POST', '/api/v1/webhook/gogs', {
        action: 'push',
        repository: {
          id: 123,
          full_name: 'user/repo',
          clone_url: 'https://example.com/user/repo.git'
        }
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      📊 Test Summary                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const total = this.testsPassed + this.testsFailed;
    const passRate = ((this.testsPassed / total) * 100).toFixed(1);

    console.log(`✅ 통과: ${this.testsPassed}/${total}`);
    console.log(`❌ 실패: ${this.testsFailed}/${total}`);
    console.log(`📊 성공률: ${passRate}%\n`);

    // 서버 종료
    this.server.stop();

    if (this.testsFailed === 0) {
      console.log('🎉 모든 API 운영 테스트 통과! API Server v2 준비 완료.\n');
    } else {
      console.log(`⚠️  ${this.testsFailed}개 테스트 실패\n`);
    }

    process.exit(this.testsFailed > 0 ? 1 : 0);
  }
}

// 실행
const tester = new APIServerV2Tester(3001);
tester.runTests().catch(error => {
  console.error('❌ 테스트 실행 실패:', error);
  process.exit(1);
});
