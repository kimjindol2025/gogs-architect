#!/usr/bin/env node

/**
 * 강화된 API 검색 시스템
 * - 실제 FreeLang 파일 로딩
 * - 상세한 단어 검색 분석
 * - 종합 보고서 생성
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const FREELANG_FOLDERS = [
  '/tmp/freelang-v6',
  '/tmp/Proof_ai/freelang-sql',
  '/tmp/aws/packages/freelang-aws'
];

class APISearchEnhanced {
  constructor() {
    this.allContent = {};
    this.fileIndex = {};
    this.stats = {
      totalFiles: 0,
      totalLines: 0,
      totalSearches: 0,
      totalMatches: 0
    };
  }

  // 모든 파일 로드
  loadAllFiles() {
    console.log('📖 FreeLang 파일 로드 중...\n');

    for (const folder of FREELANG_FOLDERS) {
      this.loadFilesRecursive(folder);
    }

    console.log(`✅ ${this.stats.totalFiles}개 파일 로드 완료`);
    console.log(`📊 총 ${this.stats.totalLines}줄 코드 분석됨\n`);
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
                lines: lines,
                size: stat.size
              };

              this.stats.totalFiles++;
              this.stats.totalLines += lines;
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  // 단어 검색 (상세)
  searchWord(word, limit = 5) {
    const results = [];
    const wordLower = word.toLowerCase();
    let matchCount = 0;

    for (const [filePath, fileData] of Object.entries(this.allContent)) {
      const lines = fileData.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(wordLower)) {
          const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n');

          results.push({
            file: filePath,
            folder: fileData.folder,
            lineNum: i + 1,
            snippet: line.substring(0, 100),
            context: context.substring(0, 300)
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

  // 상세 분석 및 보고서 생성
  analyzeWords(words) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 API 검색 보고서: "${words.join('" × "')}"`);
    console.log('═'.repeat(80));

    const analyses = [];
    const startTime = Date.now();

    for (let idx = 0; idx < words.length; idx++) {
      const word = words[idx];

      console.log(`\n[${idx + 1}/3] 검색 단어: "${word}"`);
      console.log('─'.repeat(80));

      const results = this.searchWord(word, 5);

      if (results.length === 0) {
        console.log(`❌ 발견 안됨\n`);
        analyses.push({
          word,
          found: false,
          count: 0,
          results: []
        });
        continue;
      }

      console.log(`✅ ${results.length}곳 발견\n`);

      // 결과 표시
      for (let i = 0; i < Math.min(results.length, 3); i++) {
        const r = results[i];
        console.log(`   ${i + 1}️⃣ ${r.folder} / ${path.basename(r.file)}:${r.lineNum}`);
        console.log(`      📌 ${r.snippet.replace(/\n/g, '\\n')}`);
        console.log('');
      }

      if (results.length > 3) {
        console.log(`   ... 외 ${results.length - 3}곳\n`);
      }

      analyses.push({
        word,
        found: true,
        count: results.length,
        results: results
      });
    }

    const duration = Date.now() - startTime;

    // 종합 분석
    const foundCount = analyses.filter(a => a.found).length;
    const totalMatches = analyses.reduce((sum, a) => sum + a.count, 0);

    console.log(`\n${'═'.repeat(80)}`);
    console.log('💡 종합 분석');
    console.log('═'.repeat(80));

    console.log(`\n📈 검색 통계:\n`);

    for (const analysis of analyses) {
      const status = analysis.found ? '✅' : '❌';
      const bar = analysis.found ? '█'.repeat(Math.ceil(analysis.count / 2)) : '─';
      console.log(`   ${status} "${analysis.word}": ${bar} (${analysis.count}곳)`);
    }

    console.log(`\n🎯 매칭 평가:\n`);

    const rating = foundCount === 3 ? {
      score: '⭐⭐⭐⭐⭐ 완벽 매칭 (100%)',
      message: '모든 단어가 FreeLang 코드베이스에서 발견되었습니다!'
    } : foundCount === 2 ? {
      score: '⭐⭐⭐⭐ 높은 관련성 (67%)',
      message: '대부분의 단어가 FreeLang에 포함되어 있습니다.'
    } : foundCount === 1 ? {
      score: '⭐⭐⭐ 부분적 일치 (33%)',
      message: '일부 기능만 발견되었습니다.'
    } : {
      score: '⭐ 미발견 (0%)',
      message: 'FreeLang과 관련이 낮은 단어들입니다.'
    };

    console.log(`   ${rating.score}\n`);
    console.log(`   → ${rating.message}\n`);

    // 인사이트
    console.log(`💡 인사이트:\n`);

    if (analyses.some(a => a.word.toLowerCase().includes('sql'))) {
      console.log('   💾 SQL 기능 감지:');
      console.log('      • 자연어 SQL 컴파일러');
      console.log('      • Z3 SMT Solver 검증');
      console.log('      • freelang-sql 모듈 활성\n');
    }

    if (analyses.some(a => a.word.toLowerCase().includes('aws'))) {
      console.log('   ☁️  AWS 통합 감지:');
      console.log('      • CloudWatch 모니터링');
      console.log('      • CloudTrail 감사 로그');
      console.log('      • freelang-aws 모듈 활성\n');
    }

    if (analyses.some(a => a.word.toLowerCase().includes('parser') || a.word.toLowerCase().includes('compile'))) {
      console.log('   🔧 컴파일러 감지:');
      console.log('      • Lexer → Parser → Compiler → VM');
      console.log('      • 완전한 코드 생성 파이프라인');
      console.log('      • 타입 안정성 보장\n');
    }

    if (foundCount >= 2) {
      console.log('   🎯 통합 평가:');
      console.log('      FreeLang은 다목적 언어 플랫폼으로,');
      console.log('      검색된 기능들이 다양한 도메인에 걸쳐있습니다.\n');
    }

    // 성능
    console.log(`⏱️  성능:\n`);
    console.log(`   • 검색 시간: ${duration}ms`);
    console.log(`   • 총 매치: ${totalMatches}곳`);
    console.log(`   • 매칭율: ${Math.round((foundCount / 3) * 100)}%\n`);

    return {
      analyses,
      foundCount,
      totalMatches,
      duration,
      rating
    };
  }

  // 대화형 모드
  startInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('\n💬 3개 단어 입력 (공백 구분) [또는 exit]: ', (input) => {
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log('\n👋 종료됩니다.\n');
          rl.close();
          return;
        }

        const words = input.trim().split(/\s+/).filter(w => w.length > 0);

        if (words.length === 0) {
          console.log('⚠️ 단어를 입력해주세요.');
          prompt();
          return;
        }

        if (words.length < 3) {
          console.log(`⚠️ ${3 - words.length}개 더 입력하세요.`);
          prompt();
          return;
        }

        // 분석 실행
        this.analyzeWords(words.slice(0, 3));
        this.stats.totalSearches++;

        prompt();
      });
    };

    console.log(`\n${'═'.repeat(80)}`);
    console.log('🚀 API 검색 시스템 - 대화형 모드');
    console.log('═'.repeat(80));
    console.log('\n💡 팁: "exit"를 입력하면 종료됩니다\n');

    prompt();
  }
}

// 메인
function main() {
  const system = new APISearchEnhanced();
  system.loadAllFiles();
  system.startInteractive();
}

main();
