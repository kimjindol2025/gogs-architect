#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import Anthropic from '@anthropic-ai/sdk';

const DB_PATH = 'data/architect.db';

class AIAnalyzer {
  constructor() {
    this.db = null;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async analyzeCallGraph() {
    console.log('\n🔍 Call Graph 분석 중...\n');

    const problems = {
      circular: await this._findCircularDependencies(),
      unused: await this._findUnusedFunctions(),
      duplicates: await this._findDuplicateFunctions(),
      high_complexity: await this._findHighComplexity(),
      stats: await this._getCallGraphStats()
    };

    return problems;
  }

  async _findCircularDependencies() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT DISTINCT 
          f1.name as caller, f2.name as callee
        FROM calls c1
        JOIN calls c2 ON c1.callee_id = c2.caller_id
        JOIN functions f1 ON c1.caller_id = f1.id
        JOIN functions f2 ON c2.callee_id = f2.id
        WHERE c2.callee_id = c1.caller_id
        LIMIT 10
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findUnusedFunctions() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT f.name, r.name as repo, f.start_line
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        WHERE f.id NOT IN (SELECT DISTINCT callee_id FROM calls WHERE callee_id IS NOT NULL)
          AND f.id NOT IN (SELECT DISTINCT caller_id FROM calls)
        LIMIT 10
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findDuplicateFunctions() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT f1.name, r1.name as repo1, r2.name as repo2
        FROM functions f1
        JOIN functions f2 ON f1.name = f2.name AND f1.id < f2.id
        JOIN repos r1 ON f1.repo_id = r1.id
        JOIN repos r2 ON f2.repo_id = r2.id
        LIMIT 10
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findHighComplexity() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT f.name, r.name as repo, COUNT(*) as calls
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        JOIN calls c ON f.id = c.caller_id
        GROUP BY f.id
        HAVING COUNT(*) > 50
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _getCallGraphStats() {
    return new Promise((resolve) => {
      this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM functions) as total_functions,
          (SELECT COUNT(*) FROM calls) as total_calls,
          (SELECT COUNT(DISTINCT caller_id) FROM calls) as unique_callers,
          (SELECT COUNT(DISTINCT callee_id) FROM calls WHERE callee_id IS NOT NULL) as unique_callees
      `, (err, row) => resolve(row || {}));
    });
  }

  async generateInsights(problems) {
    console.log('🤖 Claude AI로 아키텍처 분석 중...\n');

    const prompt = `당신은 고급 소프트웨어 아키텍트입니다. 다음 코드 분석 결과를 보고 개선 방안을 제시하세요.

# 📊 Call Graph 분석 결과

## 통계
- 총 함수: ${problems.stats.total_functions}개
- 총 호출: ${problems.stats.total_calls}개
- 고유 호출자: ${problems.stats.unique_callers}개
- 고유 호출 대상: ${problems.stats.unique_callees}개

## 🔴 순환 의존성 (${problems.circular.length}개)
${problems.circular.slice(0, 3).map(c => `- ${c.caller}() ↔ ${c.callee}()`).join('\n')}

## 🟡 미사용 함수 (${problems.unused.length}개)
${problems.unused.slice(0, 3).map(u => `- ${u.name} (${u.repo}:${u.start_line})`).join('\n')}

## 🟠 중복 함수 (${problems.duplicates.length}개)
${problems.duplicates.slice(0, 3).map(d => `- ${d.name}: ${d.repo1} vs ${d.repo2}`).join('\n')}

## 🔥 높은 복잡도 함수 (${problems.high_complexity.length}개)
${problems.high_complexity.slice(0, 5).map(h => `- ${h.name}(): ${h.calls}개 호출 수행 (${h.repo})`).join('\n')}

# 💡 분석 요청

1. **핵심 아키텍처 문제**: 가장 심각한 3가지 문제를 식별하고 각각의 영향도를 설명
2. **리팩토링 로드맵**: 우선순위별 개선 계획 (1주/1개월/3개월)
3. **설계 원칙**: 향후 예방할 패턴과 개선안
4. **즉시 조치**: 지금 바로 할 수 있는 작업 (함수명, 라인 명시)

형식: 마크다운, 구체적, 실행 가능`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].type === 'text' ? message.content[0].text : 'AI 분석 실패';
    } catch (err) {
      console.error('❌ API 에러:', err.message);
      return `## API 에러

\`\`\`
${err.message}
\`\`\`

확인 사항:
- ANTHROPIC_API_KEY 환경변수 설정됨?
- API 키 유효함?`;
    }
  }

  async analyze() {
    try {
      await this.connect();

      const problems = await this.analyzeCallGraph();

      console.log('📍 발견된 문제:');
      console.log(`  ├─ 순환 의존성: ${problems.circular.length}개`);
      console.log(`  ├─ 미사용 함수: ${problems.unused.length}개`);
      console.log(`  ├─ 중복 함수: ${problems.duplicates.length}개`);
      console.log(`  └─ 높은 복잡도: ${problems.high_complexity.length}개\n`);

      const insights = await this.generateInsights(problems);

      console.log('='.repeat(70));
      console.log('🎯 AI 아키텍처 분석 결과');
      console.log('='.repeat(70) + '\n');
      console.log(insights);
      console.log('\n' + '='.repeat(70));

      await this.close();
    } catch (err) {
      console.error('❌ 분석 실패:', err.message);
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('✅ 분석 완료');
          resolve();
        });
      }
    });
  }
}

const analyzer = new AIAnalyzer();
analyzer.analyze().catch(console.error);
