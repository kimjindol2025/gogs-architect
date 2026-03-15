#!/usr/bin/env node

/**
 * FreeLang 파서
 * .free/.fl 함수 정의 추출
 * fn name(params) { ... }
 */

import fs from 'fs';

class FreeLangParser {
  constructor() {
    this.fnPattern = /^[\s]*(export\s+)?fn\s+(\w+)\s*\(([\^}]*?)\)\s*(?:\{|=)/gm;
  }

  extractFunctions(filePath) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const functions = [];
      this._extractFunctions(source, filePath, functions);
      return functions;
    } catch (err) {
      console.error(`파서 에러 (${filePath}): ${err.message}`);
      return [];
    }
  }

  _extractFunctions(source, filePath, functions) {
    let match;
    const pattern = /^[\s]*(export\s+)?fn\s+(\w+)\s*\(([\^}]*?)\)\s*(?=\{|=)/gm;

    while ((match = pattern.exec(source)) !== null) {
      const isExported = !!match[1];
      const name = match[2];
      const params = (match[3] || '').trim();
      const lineNumber = source.substring(0, match.index).split('\n').length;

      const bodyStart = source.indexOf(match[0]) + match[0].length;
      let bodyEnd = bodyStart;

      if (source[bodyStart] === '{') {
        let braceCount = 1;
        bodyEnd = bodyStart + 1;
        while (braceCount > 0 && bodyEnd < source.length) {
          if (source[bodyEnd] === '{') braceCount++;
          if (source[bodyEnd] === '}') braceCount--;
          bodyEnd++;
        }
      } else if (source[bodyStart] === '=') {
        bodyEnd = source.indexOf('\n', bodyStart);
        if (bodyEnd === -1) bodyEnd = source.length;
      }

      const body = source.substring(bodyStart, Math.min(bodyEnd, bodyStart + 200));

      functions.push({
        name,
        type: 'function',
        filePath,
        line_number: lineNumber,
        signature: `(${params})`,
        body_snippet: body,
        is_exported: isExported,
        is_async: false,
        language: 'freelang'
      });
    }
  }
}

if (process.argv[1].endsWith('parser-freelang.js')) {
  const parser = new FreeLangParser();
  const testFile = process.argv[2];
  if (!testFile) {
    console.error('사용법: node parser-freelang.js <file>');
    process.exit(1);
  }
  const functions = parser.extractFunctions(testFile);
  console.log(`\n✅ ${testFile}에서 ${functions.length}개 정의 추출\n`);
  functions.forEach(fn => {
    console.log(`  📍 ${fn.name} (line ${fn.line_number}, ${fn.type})`);
    if (fn.is_exported) console.log(`     ↳ exported`);
  });
}

export default FreeLangParser;
