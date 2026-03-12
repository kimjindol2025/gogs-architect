#!/usr/bin/env node

/**
 * API 검색 시스템 데모
 * 5개의 테스트 케이스를 자동 실행하고 보고서 생성
 */

import fs from 'fs';
import path from 'path';

const FREELANG_FOLDERS = [
  '/tmp/freelang-v6',
  '/tmp/Proof_ai/freelang-sql',
  '/tmp/aws/packages/freelang-aws'
];

class APISearchDemo {
  constructor() {
    this.allContent = {};
    this.stats = {
      totalFiles: 0,
      totalLines: 0,
      totalSearches: 0
    };
  }

  loadAllFiles() {
    console.log('📖 FreeLang 파일 로드 중...\n');
    const startTime = Date.now();

    for (const folder of FREELANG_FOLDERS) {
      this.loadFilesRecursive(folder);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ 로드 완료: ${this.stats.totalFiles}개 파일, ${this.stats.totalLines}줄 (${duration}ms)\n`);
  }

  loadFilesRecursive(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this.loadFilesRecursive(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(entry);
          if (['.ts', '.js', '.fl', '.md'].includes(ext) && stat.size < 100000) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const relPath = path.relative('/tmp', fullPath);
              const lines = content.split('\n').length;

              this.allContent[relPath] = {
                content: content,
                folder: path.basename(dirPath),
                lines: lines
              };

              this.stats.totalFiles++;
              this.stats.totalLines += lines;
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  searchWord(word, limit = 3) {
    const results = [];
    const wordLower = word.toLowerCase();
    let matchCount = 0;

    for (const [filePath, fileData] of Object.entries(this.allContent)) {
      const lines = fileData.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(wordLower)) {
          const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n');

          results.push({
            file: filePath,
            folder: fileData.folder,
            lineNum: i + 1,
            snippet: lines[i].substring(0, 120),
            context: context.substring(0, 280)
          });

          matchCount++;

          if (matchCount >= limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  analyzeAndReport(words) {
    console.log(`\n${'═'.repeat(85)}`);
    console.log(`📊 검색 보고서: ${words.join(' × ')}`);
    console.log('═'.repeat(85));

    const analyses = [];

    for (let idx = 0; idx < words.length; idx++) {
      const word = words[idx];
      const results = this.searchWord(word, 3);

      console.log(`\n[${idx + 1}/3] "${word}"`);
      console.log('─'.repeat(85));

      if (results.length === 0) {
        console.log('   ❌ 발견 없음');
        analyses.push({ word, found: false, count: 0 });
      } else {
        console.log(`   ✅ ${results.length}곳 발견\n`);

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          console.log(`   ${i + 1}. ${r.folder} / ${path.basename(r.file)}:${r.lineNum}`);
          console.log(`      ➜ ${r.snippet.substring(0, 100)}`);
        }

        analyses.push({ word, found: true, count: results.length });
      }
    }

    // 종합 평가
    const foundCount = analyses.filter(a => a.found).length;
    const totalMatches = analyses.reduce((sum, a) => sum + a.count, 0);

    console.log(`\n${'═'.repeat(85)}`);
    console.log('💡 종합 분석');
    console.log('═'.repeat(85));

    // 점수
    const ratingMap = {
      3: { stars: '⭐⭐⭐⭐⭐', text: '완벽 매칭', percent: 100 },
      2: { stars: '⭐⭐⭐⭐', text: '높은 관련성', percent: 67 },
      1: { stars: '⭐⭐⭐', text: '부분적 일치', percent: 33 },
      0: { stars: '⭐', text: '미발견', percent: 0 }
    };

    const rating = ratingMap[foundCount] || ratingMap[0];

    console.log(`\n📈 매칭 결과:`);
    for (const analysis of analyses) {
      const icon = analysis.found ? '✅' : '❌';
      const bar = analysis.found ? '█'.repeat(Math.ceil(analysis.count / 2)) : '';
      console.log(`   ${icon} "${analysis.word}" ${bar} (${analysis.count}곳)`);
    }

    console.log(`\n🎯 평가: ${rating.stars}`);
    console.log(`   → ${rating.text} (${rating.percent}%)`);

    // 인사이트
    const insights = [];

    if (analyses.some(a => a.word.toLowerCase().includes('sql'))) {
      insights.push('💾 SQL 기능: 자연어 컴파일러 + Z3 검증');
    }
    if (analyses.some(a => a.word.toLowerCase().includes('aws'))) {
      insights.push('☁️  AWS 통합: CloudWatch, CloudTrail');
    }
    if (analyses.some(a => a.word.toLowerCase().includes('parser') || a.word.toLowerCase().includes('compile'))) {
      insights.push('🔧 컴파일러: Lexer→Parser→Compiler→VM');
    }
    if (analyses.some(a => a.word.toLowerCase().includes('function') || a.word.toLowerCase().includes('type'))) {
      insights.push('📝 타입 시스템: 안정성 및 검증 기능');
    }

    if (insights.length > 0) {
      console.log(`\n💡 인사이트:`);
      insights.forEach(i => console.log(`   • ${i}`));
    }

    return { foundCount, totalMatches, rating };
  }

  runDemo() {
    const testCases = [
      ['sql', 'parser', 'aws'],
      ['compiler', 'type', 'validate'],
      ['lexer', 'import', 'module'],
      ['cloudwatch', 'z3', 'interpolation'],
      ['function', 'array', 'object']
    ];

    console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  🚀 Gogs AI Architect - API 검색 시스템 데모                                  ║');
    console.log('║  5개 테스트 케이스 자동 실행 및 보고서 생성                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    this.loadAllFiles();

    const results = [];
    const overallStart = Date.now();

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = this.analyzeAndReport(testCase);
      results.push({
        caseNum: i + 1,
        words: testCase,
        ...result
      });

      if (i < testCases.length - 1) {
        console.log('\n');
      }
    }

    const totalDuration = Date.now() - overallStart;

    // 최종 보고서
    console.log(`\n${'═'.repeat(85)}`);
    console.log('📋 최종 보고서');
    console.log('═'.repeat(85));

    console.log(`\n🧪 테스트 실행:`);
    console.log(`   • 총 테스트: ${testCases.length}개`);
    console.log(`   • 전체 검색 시간: ${totalDuration}ms`);

    console.log(`\n📊 통계:`);
    const perfectMatches = results.filter(r => r.foundCount === 3).length;
    const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0);

    console.log(`   • 완벽 매칭: ${perfectMatches}/${testCases.length}`);
    console.log(`   • 총 매치: ${totalMatches}곳`);
    console.log(`   • 평균: ${Math.round(totalMatches / testCases.length)}곳/테스트`);

    console.log(`\n🏆 테스트 결과:`);
    for (const result of results) {
      const check = result.foundCount === 3 ? '✅' : result.foundCount >= 2 ? '⚠️' : '❌';
      console.log(`   ${check} Test ${result.caseNum}: ${result.words.join(', ')} → ${result.foundCount}/3 (${result.rating.text})`);
    }

    console.log(`\n${'═'.repeat(85)}`);
    console.log('✅ 모든 테스트 완료!\n');
  }
}

const demo = new APISearchDemo();
demo.runDemo();
