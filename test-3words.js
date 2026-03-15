#!/usr/bin/env node

/**
 * 사전 정의된 3단어 세트로 대화 체크
 */

import fs from 'fs';
import path from 'path';

const FREELANG_FOLDERS = [
  '/tmp/freelang-v6',
  '/tmp/Proof_ai/freelang-sql',
  '/tmp/aws/packages/freelang-aws'
];

let allContent = {};

function loadAllFiles() {
  for (const folder of FREELANG_FOLDERS) {
    loadFilesRecursive(folder);
  }
}

function loadFilesRecursive(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        loadFilesRecursive(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (['.ts', '.js', '.fl', '.md'].includes(ext) && stat.size < 100000) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const relPath = path.relative('/tmp', fullPath);
            allContent[relPath] = {
              content: content,
              folder: path.basename(dirPath)
            };
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

function searchWord(word, limit = 3) {
  const results = [];
  const wordLower = word.toLowerCase();
  
  for (const [filePath, fileData] of Object.entries(allContent)) {
    const lines = fileData.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(wordLower)) {
        const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n');
        
        results.push({
          file: filePath,
          folder: fileData.folder,
          lineNum: i + 1,
          context: context.substring(0, 250)
        });
        
        if (results.length >= limit) {
          return results;
        }
      }
    }
  }
  
  return results;
}

function analyzeAndRespond(words) {
  console.log(`\n${'═'.repeat(75)}`);
  console.log(`🔍 3단어 검색 + AI 대화 체크: "${words.join('" × "')}""`);
  console.log('═'.repeat(75));
  
  const analyses = [];
  
  for (let idx = 0; idx < words.length; idx++) {
    const word = words[idx];
    console.log(`\n[${idx + 1}/3] 단어: "${word}"`);
    console.log('─'.repeat(75));
    
    const results = searchWord(word, 2);
    
    if (results.length === 0) {
      console.log(`⚠️ 발견 안됨`);
      analyses.push({ word, found: false, count: 0 });
    } else {
      console.log(`✅ ${results.length}곳 발견\n`);
      
      for (const result of results) {
        console.log(`   📄 ${result.folder} / ${path.basename(result.file)}:${result.lineNum}`);
        console.log(`      ${result.context.replace(/\n/g, '\n      ').substring(0, 180)}...\n`);
      }
      
      analyses.push({
        word: word,
        found: true,
        count: results.length
      });
    }
  }
  
  // AI 응답
  const foundCount = analyses.filter(a => a.found).length;
  
  console.log(`\n${'═'.repeat(75)}`);
  console.log('💬 AI 분석 결과');
  console.log('═'.repeat(75));
  
  console.log(`\n📊 검색 결과: ${foundCount}/3 단어 발견\n`);
  
  for (const analysis of analyses) {
    const status = analysis.found ? '✅' : '❌';
    console.log(`   ${status} "${analysis.word}" ${analysis.found ? `(${analysis.count}곳)` : '(미발견)'}`);
  }
  
  console.log(`\n🎯 종합 평가:`);
  
  if (foundCount === 3) {
    console.log('\n   ⭐⭐⭐⭐⭐ 완벽 매칭!');
    console.log('   모든 단어가 FreeLang 코드베이스에서 발견되었습니다.');
    console.log('   제시하신 주제들이 FreeLang 핵심 기능과 완전히 일치합니다.\n');
  } else if (foundCount === 2) {
    console.log('\n   ⭐⭐⭐⭐ 높은 관련성');
    console.log('   대부분의 단어가 FreeLang에서 지원하는 기능입니다.\n');
  } else if (foundCount === 1) {
    console.log('\n   ⭐⭐⭐ 부분적 일치');
    console.log('   일부 기능만 발견되었습니다.\n');
  } else {
    console.log('\n   ⭐ 미발견');
    console.log('   FreeLang 코드베이스와 관련이 낮은 단어들입니다.');
    console.log('   다른 단어로 재검색을 권장합니다.\n');
  }
  
  // 상세 인사이트
  if (analyses.some(a => a.word.toLowerCase().includes('sql'))) {
    console.log('   💾 SQL 기능: 자연어 SQL 컴파일, Z3 검증 시스템 (freelang-sql 모듈)');
  }
  if (analyses.some(a => a.word.toLowerCase().includes('aws'))) {
    console.log('   ☁️  AWS 통합: CloudWatch, CloudTrail, AWS SDK (freelang-aws 모듈)');
  }
  if (analyses.some(a => a.word.toLowerCase().includes('compiler') || a.word.toLowerCase().includes('parse'))) {
    console.log('   🔧 컴파일러: Lexer → Parser → Compiler → VM 파이프라인 (v6 코어)');
  }
}

// 테스트 세트
const TEST_SETS = [
  ['sql', 'parser', 'aws'],
  ['compiler', 'type', 'validate'],
  ['lexer', 'import', 'module'],
  ['cloudwatch', 'z3', 'interpolation'],
  ['function', 'array', 'object']
];

function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 FreeLang 3단어 검색 + AI 대화 체크                                  ║');
  console.log('║  사전 정의된 5개 테스트 세트 실행                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('📖 FreeLang 파일 로드 중...');
  loadAllFiles();
  console.log(`✅ ${Object.keys(allContent).length}개 파일 로드 완료\n`);
  
  // 모든 테스트 실행
  for (let i = 0; i < TEST_SETS.length; i++) {
    analyzeAndRespond(TEST_SETS[i]);
    if (i < TEST_SETS.length - 1) {
      console.log('\n');
    }
  }
  
  console.log(`\n${'═'.repeat(75)}`);
  console.log('✅ 모든 테스트 완료!\n');
}

main();
