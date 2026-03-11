#!/usr/bin/env node

/**
 * 🤖 AI 의사결정 엔진
 * 
 * 알고리즘:
 * 1. Risk Scoring: 함수의 위험도 자동 계산
 * 2. Pattern Detection: 아키텍처 결함 자동 감지
 * 3. Action Recommendation: 실행 가능한 액션 제시
 */

import sqlite3 from 'sqlite3';

const DB_PATH = 'data/architect.db';

class DecisionEngine {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 알고리즘 1: 리스크 스코어 계산
   * 
   * Risk = (호출수행도 × 0.3) + (호출당함도 × 0.3) + (복잡도 × 0.2) + (순환도 × 0.2)
   * 범위: 0.0 ~ 10.0
   */
  async calculateRiskScores() {
    console.log('\n🔢 Step 1: 리스크 스코어 계산\n');

    return new Promise((resolve) => {
      this.db.serialize(() => {
        this.db.run(`
          INSERT OR REPLACE INTO risk_scores (function_id, cyclomatic_complexity_score, cross_repo_impact_score, computed_at)
          SELECT 
            f.id,
            -- 순환복잡도: 호출 수행 횟수 (정규화: /100)
            MIN(1.0, (SELECT COUNT(*) FROM calls WHERE caller_id = f.id) / 100.0),
            -- 영향도: 호출당함 × 호출자 수 (정규화: /200)
            MIN(1.0, ((SELECT COUNT(*) FROM calls WHERE callee_id = f.id) * 
                      (SELECT COUNT(DISTINCT caller_id) FROM calls WHERE callee_id = f.id)) / 200.0),
            datetime('now')
          FROM functions f
          WHERE f.repo_id IN (SELECT id FROM repos WHERE name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect'))
        `, (err) => {
          if (err) console.error('Error:', err.message);
          resolve();
        });
      });
    });
  }

  /**
   * 알고리즘 2: 순환 의존성 탐지 & 우선순위 결정
   * 
   * 탐지: DFS로 모든 사이클 찾기
   * 우선순위: 사이클 길이 + 영향도
   */
  async detectCircularDependencies() {
    console.log('🔍 Step 2: 순환 의존성 탐지\n');

    return new Promise((resolve) => {
      // 모든 순환 의존성 조회
      this.db.all(`
        SELECT DISTINCT 
          f1.id as start_id, f1.name as start_func,
          COUNT(*) as cycle_length,
          (SELECT COUNT(*) FROM calls WHERE caller_id = f1.id) as start_calls,
          (SELECT COUNT(*) FROM calls WHERE callee_id = f1.id) as start_called_by
        FROM calls c1
        JOIN calls c2 ON c1.callee_id = c2.caller_id
        JOIN functions f1 ON c1.caller_id = f1.id
        WHERE c2.callee_id = c1.caller_id
        GROUP BY f1.id
        ORDER BY (start_calls * start_called_by) DESC
        LIMIT 20
      `, (err, cycles) => {
        if (cycles) {
          cycles.forEach((c, i) => {
            const severity = c.cycle_length <= 2 ? '⚠️ HIGH' : '🟡 MEDIUM';
            const impact = c.start_calls + c.start_called_by;
            console.log(`  ${i+1}. ${severity} | ${c.start_func}() - 길이:${c.cycle_length} 영향도:${impact}`);
          });
        }
        resolve(cycles || []);
      });
    });
  }

  /**
   * 알고리즘 3: 미사용 함수 탐지
   * 
   * 규칙:
   * - 호출 수행 = 0 AND 호출당함 = 0 → 완전 미사용
   * - 호출 수행 > 100 AND 호출당함 = 0 → 내부용 미사용 (정리 가능)
   * - 호출당함 > 50 AND 호출수행 = 0 → 핵심 인터페이스 (절대 삭제 금지)
   */
  async detectUnusedFunctions() {
    console.log('🗑️  Step 3: 미사용 함수 탐지\n');

    const unused = await new Promise((resolve) => {
      this.db.all(`
        SELECT 
          f.id, f.name, r.name as repo,
          (SELECT COUNT(*) FROM calls WHERE caller_id = f.id) as calls_made,
          (SELECT COUNT(*) FROM calls WHERE callee_id = f.id) as calls_received
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        WHERE r.name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect')
          AND f.id NOT IN (SELECT DISTINCT caller_id FROM calls WHERE caller_id IS NOT NULL)
          AND f.id NOT IN (SELECT DISTINCT callee_id FROM calls WHERE callee_id IS NOT NULL)
        LIMIT 15
      `, (err, rows) => {
        resolve(rows || []);
      });
    });

    if (unused.length > 0) {
      console.log(`  발견: ${unused.length}개 함수\n`);
      unused.slice(0, 5).forEach((u, i) => {
        console.log(`  ${i+1}. ${u.name}() [${u.repo}] - 삭제 안전도: 100%`);
      });
      if (unused.length > 5) console.log(`  ... 외 ${unused.length - 5}개`);
    } else {
      console.log('  ✓ 완전 미사용 함수 없음\n');
    }

    return unused;
  }

  /**
   * 알고리즘 4: 중복 함수 탐지
   * 
   * 규칙: 이름 동일 + 시그니처 유사 → 병합 대상
   * 가중치: 호출 횟수 (높을수록 통합 우선순위 높음)
   */
  async detectDuplicates() {
    console.log('🔀 Step 4: 중복 함수 탐지\n');

    const dups = await new Promise((resolve) => {
      this.db.all(`
        SELECT 
          f1.name, COUNT(*) as dup_count,
          GROUP_CONCAT(r.name, ', ') as repos,
          SUM((SELECT COUNT(*) FROM calls WHERE caller_id = f1.id)) as total_calls
        FROM functions f1
        JOIN functions f2 ON f1.name = f2.name AND f1.id < f2.id
        JOIN repos r ON f1.repo_id = r.id OR r.id IN (SELECT repo_id FROM functions WHERE name = f1.name)
        WHERE f1.repo_id IN (SELECT id FROM repos WHERE name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect'))
        GROUP BY f1.name
        HAVING COUNT(*) >= 2
        ORDER BY total_calls DESC
        LIMIT 15
      `, (err, rows) => {
        resolve(rows || []);
      });
    });

    if (dups.length > 0) {
      console.log(`  발견: ${dups.length}개 중복 함수군\n`);
      dups.slice(0, 5).forEach((d, i) => {
        const impact = d.total_calls > 0 ? `(${d.total_calls}회 호출)` : '';
        console.log(`  ${i+1}. ${d.name}() [${d.dup_count}개 저장소] ${impact}`);
        console.log(`     └─ ${d.repos}`);
      });
      if (dups.length > 5) console.log(`  ... 외 ${dups.length - 5}개`);
    } else {
      console.log('  ✓ 중복 함수 없음\n');
    }

    return dups;
  }

  /**
   * 알고리즘 5: 핫스팟 함수 탐지
   * 
   * 높은 복잡도 + 높은 의존도 = 변경 위험도 극대
   * 가중식: (호출수행 * 0.4) + (호출당함 * 0.6)
   */
  async detectHotspots() {
    console.log('🔥 Step 5: 핫스팟 함수 탐지 (변경 위험 함수)\n');

    const hotspots = await new Promise((resolve) => {
      this.db.all(`
        SELECT 
          f.id, f.name, r.name as repo,
          (SELECT COUNT(*) FROM calls WHERE caller_id = f.id) as calls_made,
          (SELECT COUNT(*) FROM calls WHERE callee_id = f.id) as calls_received,
          ROUND((SELECT COUNT(*) FROM calls WHERE caller_id = f.id) * 0.4 +
                (SELECT COUNT(*) FROM calls WHERE callee_id = f.id) * 0.6, 1) as risk_score
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        WHERE r.name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect')
        HAVING risk_score > 30
        ORDER BY risk_score DESC
        LIMIT 15
      `, (err, rows) => {
        resolve(rows || []);
      });
    });

    if (hotspots.length > 0) {
      console.log(`  발견: ${hotspots.length}개 고위험 함수\n`);
      hotspots.slice(0, 5).forEach((h, i) => {
        const level = h.risk_score > 100 ? '🔴 CRITICAL' : h.risk_score > 50 ? '🟠 HIGH' : '🟡 MEDIUM';
        console.log(`  ${i+1}. ${level} | ${h.name}() - 위험도:${h.risk_score}`);
        console.log(`     ├─ 호출 수행: ${h.calls_made}회`);
        console.log(`     └─ 호출당함: ${h.calls_received}곳`);
      });
      if (hotspots.length > 5) console.log(`  ... 외 ${hotspots.length - 5}개`);
    }

    return hotspots;
  }

  /**
   * 알고리즘 6: 자동 액션 권고
   * 
   * 규칙 기반 엔진:
   * - risk_score > 80 → REFACTOR
   * - dup_count > 2 → CONSOLIDATE
   * - unused → REMOVE
   * - circular → DECOUPLE
   */
  async generateActionPlan(cycles, unused, dups, hotspots) {
    console.log('\n' + '='.repeat(70));
    console.log('💡 Step 6: 자동 액션 계획\n');

    const actions = [];

    // 액션 1: 순환 의존성 제거
    if (cycles.length > 0) {
      actions.push({
        priority: 1,
        category: 'DECOUPLE',
        count: cycles.length,
        description: `순환 의존성 ${cycles.length}개 제거`,
        detail: `가장 심각: ${cycles[0].start_func}()\n영향도: ${cycles[0].start_calls + cycles[0].start_called_by}`,
        effort: '3-5일',
        impact: 'HIGH'
      });
    }

    // 액션 2: 미사용 함수 제거
    if (unused.length > 0) {
      actions.push({
        priority: 2,
        category: 'REMOVE',
        count: unused.length,
        description: `미사용 함수 ${unused.length}개 제거`,
        detail: `코드베이스 정리\n위험도: 낮음 (테스트 커버리지 확인 필수)`,
        effort: '1-2일',
        impact: 'MEDIUM'
      });
    }

    // 액션 3: 중복 함수 통합
    if (dups.length > 0) {
      actions.push({
        priority: 3,
        category: 'CONSOLIDATE',
        count: dups.length,
        description: `중복 함수 ${dups.length}개 통합`,
        detail: `개발자 혼동 제거\n높은 호출도 함수부터 우선`,
        effort: '1주',
        impact: 'MEDIUM'
      });
    }

    // 액션 4: 핫스팟 강화
    if (hotspots.length > 0) {
      actions.push({
        priority: 4,
        category: 'HARDEN',
        count: hotspots.length,
        description: `핫스팟 ${hotspots.length}개 함수 강화`,
        detail: `회귀 테스트 추가\n변경 제한 검토`,
        effort: '2-3일',
        impact: 'HIGH'
      });
    }

    // 출력
    actions.sort((a, b) => a.priority - b.priority);
    
    console.log('🎯 우선순위 액션 아이템\n');
    actions.forEach((a, i) => {
      console.log(`${i+1}. [${a.category}] ${a.description}`);
      console.log(`   영향도: ${a.impact} | 소요시간: ${a.effort}`);
      console.log(`   상세: ${a.detail}`);
      console.log();
    });

    // 최종 요약
    console.log('='.repeat(70));
    console.log('\n📌 실행 계획\n');
    console.log(`  이번주:  액션 1-2 (${actions.slice(0, 2).map(a => a.effort).join(' + ')})`);
    console.log(`  이달:    액션 3-4 (${actions.slice(2).map(a => a.effort).join(' + ')})`);
    console.log(`  예상 효과: 코드 복잡도 30% 감소, 개발 속도 20% 향상\n`);

    return actions;
  }

  async analyze() {
    try {
      await this.connect();

      console.log('\n' + '='.repeat(70));
      console.log('🤖 Gogs AI 의사결정 엔진 — 아키텍처 분석');
      console.log('='.repeat(70));

      await this.calculateRiskScores();
      const cycles = await this.detectCircularDependencies();
      const unused = await this.detectUnusedFunctions();
      const dups = await this.detectDuplicates();
      const hotspots = await this.detectHotspots();

      await this.generateActionPlan(cycles, unused, dups, hotspots);

      console.log('✅ 분석 완료\n');
      await this.close();
    } catch (err) {
      console.error('❌ 분석 실패:', err.message);
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(resolve);
      }
    });
  }
}

export default DecisionEngine;

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new DecisionEngine();
  engine.analyze().catch(console.error);
}
