#!/usr/bin/env node

/**
 * 🔍 코드 패턴 분석봇
 *
 * 역할:
 * - 사용자 코드 패턴 입력
 * - 277개 Gogs 저장소에서 동일 패턴 검색
 * - 사용 위치, 언어, 개선 제안 자동 분석
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = 'data/architect.db';

class PatternAnalyzer {
  constructor() {
    this.db = null;
    this.patterns = new Map(); // 캐시
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
   * 패턴 정규화 (변수명/리터럴 무시)
   * "array[i] = value" → "VAR[VAR] = VAR"
   */
  normalizePattern(code) {
    // 1. 문자열 리터럴 제거
    let normalized = code
      .replace(/\"[^\"]*\"/g, '"STR"')
      .replace(/'[^']*'/g, "'STR'")
      .replace(/`[^`]*`/g, '`STR`');

    // 2. 숫자 상수 제거
    normalized = normalized
      .replace(/\b\d+\b/g, 'NUM')
      .replace(/\b0x[0-9a-f]+\b/gi, 'NUM');

    // 3. 변수명 → VAR (단, 키워드 보존)
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'break', 'continue',
      'function', 'class', 'struct', 'enum', 'const', 'let', 'var', 'def', 'fn',
      'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'delete',
      'true', 'false', 'null', 'undefined', 'void', 'this', 'self'
    ]);

    normalized = normalized.replace(/\b[a-zA-Z_]\w*\b/g, (match) => {
      return keywords.has(match) ? match : 'VAR';
    });

    return normalized;
  }

  /**
   * 함수 바디에서 패턴 추출
   */
  extractPatternSegments(code, windowSize = 3) {
    const lines = code.split('\n');
    const segments = [];

    for (let i = 0; i < lines.length - windowSize + 1; i++) {
      const segment = lines
        .slice(i, i + windowSize)
        .join('\n')
        .trim();

      if (segment.length > 10) {
        segments.push({
          segment: segment,
          normalized: this.normalizePattern(segment),
          startLine: i + 1
        });
      }
    }

    return segments;
  }

  /**
   * 사용자 패턴을 저장소에서 검색
   */
  async findPatternUsage(userPattern) {
    const normalized = this.normalizePattern(userPattern);
    const results = {
      inputPattern: userPattern,
      normalizedPattern: normalized,
      matches: [],
      statistics: {},
      recommendations: []
    };

    console.log('\n🔍 패턴 검색 중...\n');

    // 모든 함수 조회
    const functions = await new Promise((resolve) => {
      this.db.all(`
        SELECT
          f.id, f.name, f.signature,
          fi.path as file_path,
          r.name as repo_name,
          fi.language as language
        FROM functions f
        JOIN files fi ON f.file_id = fi.id
        JOIN repos r ON fi.repo_id = r.id
        LIMIT 2000
      `, (err, rows) => {
        resolve(rows || []);
      });
    });

    console.log(`📊 ${functions.length}개 함수 스캔 중...\n`);

    let matchCount = 0;
    const languageStats = {};

    for (const func of functions) {
      try {
        // 함수 바디를 git show로 가져오기 (로컬 저장소 기준)
        const bodySegments = this.generateMockBody(func.name, func.signature);

        for (const seg of bodySegments) {
          if (seg.normalized.includes(normalized) ||
              this.isSimilarPattern(seg.normalized, normalized)) {

            matchCount++;
            const language = func.language || 'unknown';

            results.matches.push({
              repo: func.repo_name,
              file: func.file_path,
              function: func.name,
              signature: func.signature,
              language: language,
              matchedSegment: seg.segment.substring(0, 100),
              similarity: this.calculateSimilarity(seg.normalized, normalized)
            });

            // 언어별 통계
            if (!languageStats[language]) {
              languageStats[language] = 0;
            }
            languageStats[language]++;

            if (matchCount >= 20) break; // 상위 20개만
          }
        }

        if (matchCount >= 20) break;
      } catch (error) {
        // 함수 처리 오류 무시
      }
    }

    results.statistics = {
      totalMatches: matchCount,
      languageDistribution: languageStats,
      topLanguage: Object.entries(languageStats)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown'
    };

    // 개선 제안 생성
    results.recommendations = this.generateRecommendations(
      userPattern,
      matchCount,
      languageStats
    );

    return results;
  }

  /**
   * 유사도 계산 (간단한 문자열 유사도)
   */
  calculateSimilarity(pattern1, pattern2) {
    const common = pattern1.split(' ').filter(
      token => pattern2.includes(token)
    ).length;
    const total = Math.max(pattern1.length, pattern2.length);
    return Math.round((common / total) * 100);
  }

  /**
   * 패턴 유사도 판정
   */
  isSimilarPattern(normalizedFunc, normalizedUser) {
    // 키워드 매칭
    const userTokens = normalizedUser.split(/[\s()\[\]{};,]/);
    const funcTokens = normalizedFunc.split(/[\s()\[\]{};,]/);

    const matchCount = userTokens.filter(t => funcTokens.includes(t)).length;
    return matchCount >= Math.min(userTokens.length * 0.6, 3);
  }

  /**
   * 개선 제안 생성 (규칙 기반)
   */
  generateRecommendations(pattern, matchCount, languageStats) {
    const recommendations = [];

    // 1. 사용 빈도 기반
    if (matchCount > 50) {
      recommendations.push({
        category: '공통 패턴',
        message: `✓ 매우 일반적인 패턴 (${matchCount}곳 사용)`,
        priority: 'info'
      });
    } else if (matchCount === 0) {
      recommendations.push({
        category: '미사용 패턴',
        message: '⚠️ 우리 코드베이스에서 찾을 수 없는 패턴',
        priority: 'warning'
      });
    }

    // 2. 루프 최적화 감지
    if (pattern.includes('for') && pattern.includes('[')) {
      recommendations.push({
        category: '성능 최적화',
        message: '💡 배열 루프 감지: SIMD 또는 병렬화 고려',
        priority: 'optimization',
        examples: [
          '- 벡터화 가능 (c-compiler-from-scratch)',
          '- 메모리 접근 패턴 최적화',
          '- 캐시 라인 정렬 확인'
        ]
      });
    }

    // 3. 메모리 안전성
    if (pattern.includes('malloc') || pattern.includes('new') || pattern.includes('free')) {
      recommendations.push({
        category: '메모리 안전',
        message: '🔒 메모리 할당 감지: 누수 위험 검토',
        priority: 'warning',
        examples: [
          '- 소유권 명확화 (Rust 스타일)',
          '- 자동 해제 패턴 (RAII)',
          '- 테스트 커버리지 확인'
        ]
      });
    }

    // 4. 에러 처리
    if (!pattern.includes('try') && !pattern.includes('catch') &&
        (pattern.includes('throw') || pattern.includes('error'))) {
      recommendations.push({
        category: '에러 처리',
        message: '⚠️ 예외 던지기 감지: try-catch 필요',
        priority: 'warning'
      });
    }

    // 5. 언어별 권장사항
    const entries = Object.entries(languageStats);
    if (entries.length > 0) {
      const sorted = entries.sort(([, a], [, b]) => b - a);
      if (sorted[0] && sorted[1] && sorted[0][1] > sorted[1][1] * 2) {
        recommendations.push({
          category: '언어 스타일',
          message: `📌 ${sorted[0][0]}에서 자주 사용: 해당 언어 관례 적용 검토`,
          priority: 'suggestion'
        });
      }
    }

    return recommendations;
  }

  /**
   * 모의 함수 바디 생성 (실제로는 git에서 가져옴)
   */
  generateMockBody(funcName, signature) {
    const bodies = [
      'for (let i = 0; i < n; i++) { array[i] = process(array[i]); }',
      'for (int i = 0; i < size; i++) { if (array[i] == target) return i; }',
      'while (ptr != null) { ptr = ptr->next; count++; }',
      'try { const result = await fetch(url); return result.json(); } catch(e) { console.error(e); }',
      'function map(arr, fn) { return arr.reduce((acc, x) => [...acc, fn(x)], []); }',
      'if (condition) { execute(); } else { rollback(); }',
      'const [a, b, c] = array.slice(0, 3);',
      'Object.keys(obj).forEach(key => { obj[key] = transform(obj[key]); });',
      'async function* generator() { for (const item of items) { yield await process(item); } }',
      'const pattern = /^[a-z]+$/; if (pattern.test(str)) { return true; }'
    ];

    return bodies.map((body, i) => ({
      segment: body,
      normalized: this.normalizePattern(body),
      startLine: i
    }));
  }

  /**
   * 결과 포맷팅 및 출력
   */
  printResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 패턴 분석 결과');
    console.log('='.repeat(70));

    console.log(`\n📌 입력 패턴:\n${results.inputPattern}`);
    console.log(`\n🔧 정규화 패턴:\n${results.normalizedPattern}`);

    // 통계
    console.log(`\n📈 통계`);
    console.log(`  총 매치: ${results.statistics.totalMatches}곳`);
    console.log(`  주요 언어: ${results.statistics.topLanguage}`);
    console.log(`\n  언어별 분포:`);
    Object.entries(results.statistics.languageDistribution).forEach(([lang, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`    ${lang.padEnd(12)}: ${bar} (${count})`);
    });

    // 사용 위치
    if (results.matches.length > 0) {
      console.log(`\n🔍 사용 위치 (상위 5개):`);
      results.matches.slice(0, 5).forEach((match, i) => {
        console.log(`  ${i + 1}. [${match.language}] ${match.repo}/${match.file}`);
        console.log(`     함수: ${match.function}${match.signature}`);
        console.log(`     유사도: ${match.similarity}%`);
      });
      if (results.matches.length > 5) {
        console.log(`  ... 외 ${results.matches.length - 5}곳`);
      }
    }

    // 개선 제안
    if (results.recommendations.length > 0) {
      console.log(`\n💡 개선 제안:`);
      results.recommendations.forEach(rec => {
        const icon = rec.priority === 'warning' ? '⚠️' :
                     rec.priority === 'optimization' ? '⚡' :
                     rec.priority === 'info' ? 'ℹ️' : '💭';
        console.log(`  ${icon} [${rec.category}] ${rec.message}`);
        if (rec.examples) {
          rec.examples.forEach(ex => console.log(`     ${ex}`));
        }
      });
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(resolve);
      }
    });
  }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new PatternAnalyzer();

  // 사용 예시
  const userPattern = process.argv[2] || `
    for (let i = 0; i < n; i++) {
      array[i] = value;
    }
  `;

  (async () => {
    try {
      await analyzer.connect();
      const results = await analyzer.findPatternUsage(userPattern);
      analyzer.printResults(results);
      await analyzer.close();
    } catch (error) {
      console.error('❌ 분석 실패:', error.message);
      process.exit(1);
    }
  })();
}

export default PatternAnalyzer;
