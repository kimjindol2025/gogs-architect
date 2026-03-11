/**
 * 서버 전체 인덱서 (Gogs 대신 로컬 서버 인덱싱)
 *
 * 역할:
 * - 로컬 파일시스템의 모든 코드 파일 수집
 * - 코드 파일을 청크로 분해
 * - 지식 베이스 구축
 */

import LocalScanner from './local-scanner.js';
import Parser from './parser.js';
import KnowledgeBase from './knowledge-base.js';

class ServerIndexer {
  constructor(options = {}) {
    this.scanner = new LocalScanner(options);
    this.parser = new Parser();
    this.kb = new KnowledgeBase(options);
  }

  /**
   * 파일을 청크로 분해
   */
  parseFile(file) {
    const content = this.scanner.readFile(file.fullPath);

    // 파일이 너무 크면 스킵
    if (content.includes('[파일이 너무 큼') || content.includes('[읽기 오류')) {
      return [];
    }

    const ext = file.extension;
    let chunks = [];

    // Parser 호출 시 올바른 메타데이터 전달
    const meta = {
      repo: 'server',
      file: file.path
    };

    if (['.md'].includes(ext)) {
      // Markdown 섹션 단위 파싱
      chunks = this.parser.parseMarkdown(file.path, content, meta);
    } else if (['.free', '.fl'].includes(ext)) {
      // FreeLang 함수 단위 파싱
      chunks = this.parser.parseFreeLang(file.path, content, meta);
    } else if (['.ts', '.tsx'].includes(ext)) {
      // TypeScript
      chunks = this.parser.parseJavaScript(file.path, content, meta);
    } else if (['.js', '.jsx'].includes(ext)) {
      // JavaScript
      chunks = this.parser.parseJavaScript(file.path, content, meta);
    } else if (['.py'].includes(ext)) {
      // Python
      chunks = this.parser.parsePython(file.path, content, meta);
    } else {
      // 기본: 간단한 함수/클래스 추출 (정규식)
      chunks = this.parseGenericCode(file.path, content, meta, ext);
    }

    // 파일 메타데이터 추가
    chunks.forEach(chunk => {
      chunk.meta = chunk.meta || {};
      chunk.meta.filePath = file.path;
      chunk.meta.fileSize = file.size;
      chunk.meta.lastModified = file.mtime;
      chunk.meta.extension = ext;
    });

    return chunks;
  }

  /**
   * 일반 코드 파싱 (함수/클래스 추출)
   */
  parseGenericCode(filePath, content, meta, ext) {
    const chunks = [];
    const lines = content.split('\n');

    // 기본 패턴: 함수/클래스 정의 감지
    const patterns = [
      /^(function|const|let|var)\s+(\w+)\s*[=({]/,  // JS
      /^def\s+(\w+)/,                                // Python
      /^(fn|pub fn|async fn)\s+(\w+)/,               // Rust/Free
      /^(class|struct|type|interface)\s+(\w+)/i      // 구조체/클래스
    ];

    let currentFunc = null;
    let funcStart = 0;
    let funcLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 함수/클래스 정의 감지
      let isDefinition = false;
      let name = '';

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          isDefinition = true;
          name = match[2] || match[1];
          break;
        }
      }

      if (isDefinition && name) {
        // 이전 함수 저장
        if (currentFunc && funcLines.length > 0) {
          chunks.push({
            id: `${meta.repo}/${filePath}:${funcStart}:${currentFunc}`,
            type: 'function',
            name: currentFunc,
            content: funcLines.join('\n'),
            meta: {
              ...meta,
              lineStart: funcStart + 1,
              lineEnd: i,
              language: this.getLanguageFromExt(ext)
            }
          });
        }

        currentFunc = name;
        funcStart = i;
        funcLines = [line];
      } else if (currentFunc) {
        funcLines.push(line);

        // 너무 길면 강제로 끝내기
        if (funcLines.length > 500) {
          chunks.push({
            id: `${meta.repo}/${filePath}:${funcStart}:${currentFunc}`,
            type: 'function',
            name: currentFunc,
            content: funcLines.join('\n'),
            meta: {
              ...meta,
              lineStart: funcStart + 1,
              lineEnd: i,
              language: this.getLanguageFromExt(ext)
            }
          });
          currentFunc = null;
          funcLines = [];
        }
      }
    }

    // 마지막 함수 저장
    if (currentFunc && funcLines.length > 0) {
      chunks.push({
        id: `${meta.repo}/${filePath}:${funcStart}:${currentFunc}`,
        type: 'function',
        name: currentFunc,
        content: funcLines.join('\n'),
        meta: {
          ...meta,
          lineStart: funcStart + 1,
          lineEnd: lines.length,
          language: this.getLanguageFromExt(ext)
        }
      });
    }

    // 함수를 찾지 못하면 전체 파일을 하나의 청크로
    if (chunks.length === 0 && content.length > 0) {
      chunks.push({
        id: `${meta.repo}/${filePath}:0:file`,
        type: 'file',
        name: filePath.split('/').pop(),
        content: content,
        meta: {
          ...meta,
          lineStart: 1,
          lineEnd: lines.length,
          language: this.getLanguageFromExt(ext)
        }
      });
    }

    return chunks;
  }

  /**
   * 확장자로 언어 결정
   */
  getLanguageFromExt(ext) {
    const langMap = {
      '.free': 'freelang',
      '.fl': 'freelang',
      '.py': 'python',
      '.ts': 'typescript',
      '.js': 'javascript',
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * 전체 서버 인덱싱
   */
  indexServer() {
    console.log('\n🔧 서버 인덱싱 시작\n');
    const startTime = Date.now();

    // 1. 파일 스캔
    console.log('📁 1단계: 파일 스캔...');
    const files = this.scanner.scanAll();
    const stats = this.scanner.getStatistics(files);

    console.log(`총 ${files.length}개 파일 (${stats.totalSizeMB}MB)`);
    console.log(`언어 분포:`);
    Object.entries(stats.byLanguage).forEach(([lang, count]) => {
      console.log(`  ${lang}: ${count}개`);
    });

    // 2. 파일 파싱 및 청크 생성
    console.log('\n📄 2단계: 파일 파싱...');
    let totalChunks = 0;
    const chunksByFile = {};

    files.forEach((file, idx) => {
      if (idx % 100 === 0) process.stdout.write('.');
      try {
        const chunks = this.parseFile(file);
        if (chunks.length > 0) {
          chunksByFile[file.path] = chunks;
          totalChunks += chunks.length;
        }
      } catch (e) {
        // 개별 파일 파싱 오류 무시
      }
    });

    console.log(`\n✓ ${totalChunks}개 청크 생성`);

    // 3. 지식 베이스 구축
    console.log('\n💾 3단계: 지식 베이스 구축...');
    const allChunks = Object.values(chunksByFile).flat();
    allChunks.forEach((chunk, idx) => {
      if (idx % 10000 === 0) process.stdout.write('.');
      this.kb.addChunk(chunk);
    });
    console.log('');

    // 4. 키워드 인덱싱
    this.kb.buildKeywordIndex();

    // 5. 저장
    console.log('\n💾 5단계: 저장...');
    this.kb.save();

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ 인덱싱 완료 (${(elapsed / 1000).toFixed(1)}초)`);
    console.log(`\n📊 최종 통계:`);
    console.log(`  파일: ${files.length}개`);
    console.log(`  청크: ${totalChunks}개`);
    console.log(`  저장소: ${stats.byLanguage}`);

    return {
      files,
      chunks: Object.values(chunksByFile).flat(),
      stats
    };
  }
}

export default ServerIndexer;
