#!/usr/bin/env node

/**
 * 로컬 FreeLang 폴더 3개 학습 + 대화 시도
 */

import fs from 'fs';
import path from 'path';
import KnowledgeBase from '/tmp/gogs-architect/src/knowledge-base.js';
import Embedder from '/tmp/gogs-architect/src/embedder.js';
import RAGEngine from '/tmp/gogs-architect/src/rag-engine.js';
import ArchitectPersona from '/tmp/gogs-architect/src/architect-persona.js';

// 3개 FreeLang 폴더
const FREELANG_FOLDERS = [
  {
    path: '/tmp/freelang-v6',
    name: 'FreeLang v6 (Core)'
  },
  {
    path: '/tmp/Proof_ai/freelang-sql',
    name: 'FreeLang SQL (Database)'
  },
  {
    path: '/tmp/aws/packages/freelang-aws',
    name: 'FreeLang AWS (Cloud)'
  }
];

function readFilesRecursive(dirPath, maxDepth = 3, currentDepth = 0) {
  const files = [];
  
  if (currentDepth >= maxDepth) return files;
  
  try {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      if (entry === 'node_modules') continue;
      
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...readFilesRecursive(fullPath, maxDepth, currentDepth + 1));
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (['.ts', '.js', '.fl', '.md', '.json'].includes(ext)) {
          const size = stat.size;
          if (size > 0 && size < 100000) { // 100KB 이하만
            files.push(fullPath);
          }
        }
      }
    }
  } catch (e) {
    // 폴더 읽기 실패 무시
  }
  
  return files;
}

async function learnFolder(folderInfo, kb, index = 0) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📚 학습 #${index + 1}: ${folderInfo.name}`);
  console.log(`📁 경로: ${folderInfo.path}`);
  console.log('═'.repeat(60));
  
  const files = readFilesRecursive(folderInfo.path);
  console.log(`📄 발견: ${files.length}개 파일\n`);
  
  let totalLines = 0;
  let processedCount = 0;
  
  for (const filePath of files.slice(0, 10)) { // 최대 10개
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const relativePath = path.relative(folderInfo.path, filePath);
      
      // KB에 추가
      kb.addChunk({
        id: `freelang-${index}-${processedCount}`,
        name: relativePath,
        content: content.substring(0, 5000), // 처음 5000자만
        meta: {
          repo: folderInfo.name,
          file: relativePath,
          lineStart: 1,
          lineEnd: lines,
          language: path.extname(filePath).slice(1)
        }
      });
      
      totalLines += lines;
      processedCount++;
      console.log(`  ✓ ${relativePath} (+${lines}줄)`);
    } catch (e) {
      console.log(`  ✗ 읽기 실패: ${path.basename(filePath)}`);
    }
  }
  
  console.log(`\n✅ 학습 완료: ${processedCount}개 파일, ${totalLines}줄`);
  return processedCount;
}

async function main() {
  console.log('\n🤖 FreeLang 로컬 폴더 학습 + 대화\n');
  
  try {
    // 초기화
    const kb = new KnowledgeBase();
    const embedder = new Embedder(kb);
    const rag = new RAGEngine(kb, embedder);
    const persona = new ArchitectPersona(kb, rag);
    
    console.log('📖 KnowledgeBase 초기화 완료\n');
    
    // 3개 폴더 학습
    let totalChunks = 0;
    for (let i = 0; i < FREELANG_FOLDERS.length; i++) {
      const count = await learnFolder(FREELANG_FOLDERS[i], kb, i);
      totalChunks += count;
    }
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 학습 요약: ${totalChunks}개 청크 추가됨`);
    console.log('═'.repeat(60));
    
    // 대화 시도
    const questions = [
      'FreeLang이 뭐야? 주요 특징을 설명해줄래',
      'FreeLang에서 가장 자주 사용되는 패턴이 뭐야?',
      'FreeLang의 장점과 한계는?',
      'AWS 패키지는 어떤 기능을 제공해?'
    ];
    
    console.log('\n💬 대화 시작\n');
    
    for (const question of questions) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`👤 질문: ${question}`);
      console.log('─'.repeat(60));
      
      try {
        const analysis = await persona.analyzeQuery(question);
        const report = persona.generateReport(analysis);
        console.log(report);
      } catch (e) {
        console.log(`⚠️ 분석 실패: ${e.message}`);
      }
    }
    
    console.log(`\n✅ 모든 대화 완료!\n`);
    
  } catch (error) {
    console.error(`\n❌ 오류: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
