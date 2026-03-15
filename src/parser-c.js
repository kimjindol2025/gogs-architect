#!/usr/bin/env node

/**
 * C 파서 (라인 스캔 기반)
 * 함수 정의: return_type name(params) {
 */

import fs from 'fs';

class CParser {
  constructor() {
    this.cKeywords = new Set([
      'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
      'return', 'break', 'continue', 'goto', 'sizeof', 'typedef',
      'struct', 'union', 'enum', 'const', 'volatile', 'static', 'extern',
      'auto', 'register', 'inline', 'restrict', '__restrict'
    ]);
  }

  extractFunctions(filePath) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const lines = source.split('\n');
      const functions = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 빈 줄이나 주석 무시
        if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

        // 함수 정의 패턴 찾기
        // return_type funcname(params) {
        // 하지만 if, for, while 같은 제어문은 제외
        const match = line.match(/^(static\s+|inline\s+|const\s+)*([\w\s\*]+?)\s+([a-zA-Z_]\w*)\s*\(\s*([^)]*)\)\s*\{/);

        if (!match) continue;

        const funcName = match[3];

        // 키워드 제외
        if (this.cKeywords.has(funcName)) continue;

        // 함수 이름이 소문자나 snake_case인지 확인 (휴리스틱)
        if (/^[A-Z]/.test(funcName) && !funcName.includes('_')) continue;

        const returnType = (match[2] || '').trim();
        const params = (match[4] || '').trim();
        const isStatic = line.includes('static');

        functions.push({
          name: funcName,
          type: 'function',
          filePath,
          line_number: i + 1,
          signature: `(${params})`,
          return_type: returnType,
          body_snippet: lines.slice(i + 1, Math.min(i + 3, lines.length)).join('\n').substring(0, 100),
          is_static: isStatic,
          is_exported: !isStatic
        });
      }

      return functions;
    } catch (err) {
      console.error(`파서 에러 (${filePath}): ${err.message}`);
      return [];
    }
  }
}

if (process.argv[1].endsWith('parser-c.js')) {
  const parser = new CParser();
  const testFile = process.argv[2];
  if (!testFile) {
    console.error('사용법: node parser-c.js <file>');
    process.exit(1);
  }
  const functions = parser.extractFunctions(testFile);
  console.log(`\n✅ ${testFile}에서 ${functions.length}개 함수 추출\n`);
  functions.forEach(fn => {
    console.log(`  📍 ${fn.name} (line ${fn.line_number})`);
  });
}

export default CParser;
