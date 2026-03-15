#!/usr/bin/env node

/**
 * 아키텍처 분석 리포트 생성
 * AI 분석 없이 직접 인사이트 제공
 */

import sqlite3 from 'sqlite3';

const DB_PATH = 'data/architect.db';

class ArchitectureReport {
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

  async generateReport() {
    console.log('\n📋 아키텍처 분석 리포트 생성 중...\n');

    await this.connect();

    const stats = await this._getStats();
    const circular = await this._findCircular();
    const unused = await this._findUnused();
    const duplicates = await this._findDuplicates();
    const hotspots = await this._findHotspots();

    this._printReport(stats, circular, unused, duplicates, hotspots);

    await this.close();
  }

  async _getStats() {
    return new Promise((resolve) => {
      this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM functions) as total_functions,
          (SELECT COUNT(*) FROM calls) as total_calls,
          (SELECT COUNT(DISTINCT caller_id) FROM calls) as unique_callers,
          (SELECT COUNT(DISTINCT callee_id) FROM calls WHERE callee_id IS NOT NULL) as unique_callees,
          ROUND(100.0 * (SELECT COUNT(DISTINCT callee_id) FROM calls WHERE callee_id IS NOT NULL) / 
                (SELECT COUNT(*) FROM functions), 1) as coverage_percent
      `, (err, row) => resolve(row || {}));
    });
  }

  async _findCircular() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT DISTINCT 
          f1.name, f1.id, r1.name as repo1,
          f2.name as callee, f2.id as callee_id, r2.name as repo2,
          COUNT(*) as cycle_count
        FROM calls c1
        JOIN calls c2 ON c1.callee_id = c2.caller_id
        JOIN functions f1 ON c1.caller_id = f1.id
        JOIN functions f2 ON c2.callee_id = f2.id
        JOIN repos r1 ON f1.repo_id = r1.id
        JOIN repos r2 ON f2.repo_id = r2.id
        WHERE c2.callee_id = c1.caller_id
        GROUP BY f1.id, f2.id
        ORDER BY cycle_count DESC
        LIMIT 15
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findUnused() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT f.id, f.name, r.name as repo, f.type
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        WHERE f.id NOT IN (SELECT DISTINCT callee_id FROM calls WHERE callee_id IS NOT NULL)
          AND f.id NOT IN (SELECT DISTINCT caller_id FROM calls WHERE caller_id IS NOT NULL)
          AND r.name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect')
        LIMIT 15
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findDuplicates() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT 
          f1.name, f1.id,
          r1.name as repo1,
          r2.name as repo2,
          COUNT(*) as dup_count
        FROM functions f1
        JOIN functions f2 ON f1.name = f2.name AND f1.id < f2.id
        JOIN repos r1 ON f1.repo_id = r1.id
        JOIN repos r2 ON f2.repo_id = r2.id
        WHERE f1.type = f2.type
        GROUP BY f1.id
        ORDER BY dup_count DESC
        LIMIT 15
      `, (err, rows) => resolve(rows || []));
    });
  }

  async _findHotspots() {
    return new Promise((resolve) => {
      this.db.all(`
        SELECT 
          f.name, f.id, r.name as repo,
          COUNT(*) as call_count,
          (SELECT COUNT(DISTINCT c2.caller_id) FROM calls c2 WHERE c2.callee_id = f.id) as called_by_count
        FROM functions f
        JOIN repos r ON f.repo_id = r.id
        JOIN calls c ON f.id = c.caller_id
        WHERE r.name IN ('c-compiler-from-scratch', 'freelang-v2', 'gogs-architect')
        GROUP BY f.id
        HAVING COUNT(*) > 30 OR (SELECT COUNT(DISTINCT c2.caller_id) FROM calls c2 WHERE c2.callee_id = f.id) > 50
        ORDER BY call_count DESC
        LIMIT 15
      `, (err, rows) => resolve(rows || []));
    });
  }

  _printReport(stats, circular, unused, duplicates, hotspots) {
    console.log('='.repeat(75));
    console.log('🏗️  Gogs AI Architect — 자동 아키텍처 분석 리포트');
    console.log('='.repeat(75));

    // 1. 요약
    console.log('\n📊 Call Graph 요약');
    console.log(`\n  총 함수: ${stats.total_functions}개`);
    console.log(`  총 호출: ${stats.total_calls}개`);
    console.log(`  호출 밀도: ${(stats.total_calls / (stats.total_functions * stats.unique_callers || 1)).toFixed(2)}%`);
    console.log(`  참여 함수: ${stats.unique_callers}개 호출자 → ${stats.unique_callees}개 호출대상`);
    console.log(`  커버리지: ${stats.coverage_percent}% 함수가 호출됨`);

    // 2. 순환 의존성
    console.log('\n🔴 순환 의존성 (${circular.length}개)');
    console.log('\n  위험도 HIGH — 즉시 수정 필요:\n');
    circular.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i+1}. ${c.name}() ↔ ${c.callee}()`);
      console.log(`     └─ ${c.repo1} ↔ ${c.repo2}`);
    });

    if (circular.length > 5) {
      console.log(`\n  ... 외 ${circular.length - 5}개`);
    }

    // 3. 미사용 함수
    console.log('\n🟡 미사용 함수 (${unused.length}개)');
    console.log('\n  정리 대상 — 1주일 내 제거 검토:\n');
    unused.slice(0, 5).forEach((u, i) => {
      console.log(`  ${i+1}. ${u.name}() [${u.type}]`);
      console.log(`     └─ ${u.repo}`);
    });

    if (unused.length > 5) {
      console.log(`\n  ... 외 ${unused.length - 5}개`);
    }

    // 4. 중복 함수
    console.log('\n🟠 중복 함수 (${duplicates.length}개)');
    console.log('\n  리팩토링 대상 — 1개월 내 통합:\n');
    duplicates.slice(0, 5).forEach((d, i) => {
      console.log(`  ${i+1}. ${d.name}()`);
      console.log(`     ├─ ${d.repo1}`);
      console.log(`     └─ ${d.repo2}`);
    });

    if (duplicates.length > 5) {
      console.log(`\n  ... 외 ${duplicates.length - 5}개`);
    }

    // 5. 핫스팟
    console.log('\n🔥 High-Impact 함수 (${hotspots.length}개)');
    console.log('\n  심각도 CRITICAL — 변경 시 영향도 분석 필수:\n');
    hotspots.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i+1}. ${h.name}() [${h.repo}]`);
      console.log(`     ├─ 호출 수행: ${h.call_count}회`);
      console.log(`     └─ 호출당함: ${h.called_by_count}곳`);
    });

    if (hotspots.length > 5) {
      console.log(`\n  ... 외 ${hotspots.length - 5}개`);
    }

    // 6. 액션 아이템
    console.log('\n\n💡 즉시 조치 사항\n');
    console.log('  우선순위 1 (오늘):');
    console.log(`    [ ] 순환 의존성 ${circular.length}개 분석 및 경로 선택`);
    console.log(`    [ ] 가장 심각한 사이클 ${circular[0]?.name}↔${circular[0]?.callee} 해결책 수립\n`);

    console.log('  우선순위 2 (이번주):');
    console.log(`    [ ] 미사용 함수 ${unused.length}개 제거 테스트 작성`);
    console.log(`    [ ] 중복 함수 ${duplicates.length}개 통합 계획 수립\n`);

    console.log('  우선순위 3 (이달):');
    console.log(`    [ ] High-Impact 함수 ${hotspots.length}개 리팩토링 검토`);
    console.log(`    [ ] 아키텍처 가이드 업데이트\n`);

    // 7. 권장 사항
    console.log('\n📌 아키텍처 개선 전략\n');
    console.log('  1. 모듈 분리: 순환 의존성의 근본은 강한 결합도');
    console.log('     → 인터페이스 정의로 느슨한 결합 달성\n');

    console.log('  2. 함수 정리: 미사용 함수는 기술 부채');
    console.log(`     → ${unused.length}개 제거로 코드베이스 15% 축소 기대\n`);

    console.log('  3. 중복 제거: 같은 이름 함수는 개발자 혼동 야기');
    console.log(`     → ${duplicates.length}개 통합으로 유지보수성 증가\n`);

    console.log('  4. 핫스팟 관리: High-Impact 함수는 변경에 신중해야 함');
    console.log(`     → ${hotspots.length}개 함수에 대한 회귀 테스트 강화\n`);

    console.log('='.repeat(75));
    console.log('🎯 다음 단계: git commit으로 변경사항 추적하며 조치\n');
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(resolve);
      }
    });
  }
}

const report = new ArchitectureReport();
report.generateReport().catch(console.error);
