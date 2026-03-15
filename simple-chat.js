#!/usr/bin/env node

/**
 * 간단한 FreeLang 학습 + Q&A 대화
 */

import fs from 'fs';
import path from 'path';
import KnowledgeBase from '/tmp/gogs-architect/src/knowledge-base.js';

const FREELANG_FOLDERS = [
  '/tmp/freelang-v6',
  '/tmp/Proof_ai/freelang-sql',
  '/tmp/aws/packages/freelang-aws'
];

function readFilesRecursive(dirPath) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...readFilesRecursive(fullPath));
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (['.ts', '.js', '.fl', '.md'].includes(ext) && stat.size < 100000) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({
              path: fullPath,
              relative: path.relative(dirPath, fullPath),
              content: content,
              folder: path.basename(dirPath)
            });
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  
  return files;
}

function searchContent(query, files) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  for (const file of files) {
    if (file.content.toLowerCase().includes(queryLower)) {
      // 해당 라인 추출
      const lines = file.content.split('\n');
      let found = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower) && !found) {
          const context = lines.slice(Math.max(0, i-2), Math.min(lines.length, i+3)).join('\n');
          results.push({
            file: file.relative,
            folder: file.folder,
            lineNum: i + 1,
            snippet: context.substring(0, 300)
          });
          found = true;
        }
      }
    }
  }
  
  return results;
}

function main() {
  console.log('\n🤖 FreeLang 학습 + 대화\n');
  console.log('═'.repeat(60));
  
  // 모든 파일 수집
  let allFiles = [];
  for (const folder of FREELANG_FOLDERS) {
    console.log(`📁 ${path.basename(folder)} 스캔...`);
    const files = readFilesRecursive(folder);
    allFiles.push(...files);
    console.log(`  ✓ ${files.length}개 파일 추가`);
  }
  
  console.log(`\n✅ 총 ${allFiles.length}개 파일 로드됨\n`);
  console.log('═'.repeat(60));
  
  // 질문들
  const conversations = [
    {
      question: 'FreeLang의 주요 특징',
      keywords: ['language', 'feature', 'design', 'specification']
    },
    {
      question: 'SQL과의 통합',
      keywords: ['sql', 'database', 'query']
    },
    {
      question: 'AWS 클라우드 기능',
      keywords: ['aws', 'cloud', 'service', 'cloudwatch']
    },
    {
      question: 'FreeLang의 컴파일 과정',
      keywords: ['compile', 'parser', 'compiler', 'ast']
    }
  ];
  
  // 대화 실행
  for (const conv of conversations) {
    console.log(`\n💬 ${conv.question}`);
    console.log('─'.repeat(60));
    
    let foundAny = false;
    
    for (const keyword of conv.keywords) {
      const results = searchContent(keyword, allFiles);
      
      if (results.length > 0 && !foundAny) {
        foundAny = true;
        
        for (const result of results.slice(0, 2)) {
          console.log(`\n📄 ${result.folder} / ${result.file}:${result.lineNum}`);
          console.log(`\n${result.snippet.substring(0, 200)}...`);
          console.log('─'.repeat(60));
        }
      }
    }
    
    if (!foundAny) {
      console.log('⚠️ 관련 정보를 찾을 수 없습니다.');
    }
  }
  
  console.log('\n✅ 대화 완료!\n');
}

main();
