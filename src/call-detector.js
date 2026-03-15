#!/usr/bin/env node

/**
 * Call Graph 탐지기
 * call_type: direct | dynamic | external | unresolved
 */

import fs from 'fs';
import path from 'path';

class CallDetector {
  constructor() {
    this.directCallPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    this.methodCallPattern = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    
    this.dynamicPatterns = {
      eval: /\beval\s*\(/g,
      setTimeout: /\bsetTimeout\s*\(/g,
      setInterval: /\bsetInterval\s*\(/g,
      dynamicImport: /\bimport\s*\(/g,
      getattr: /\bgetattr\s*\(/g,
      setattr: /\bsetattr\s*\(/g,
      reflect: /\bReflect\.(get|apply|construct)\s*\(/g
    };

    this.keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
      'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
      'function', 'const', 'let', 'var', 'class', 'extends',
      'import', 'export', 'await', 'async', 'yield',
      'try', 'catch', 'finally', 'throw', 'break', 'continue',
      'this', 'super', 'null', 'undefined', 'true', 'false',
      'print', 'console', 'require', 'module', 'process'
    ]);
  }

  extractCalls(filePath, language = 'typescript') {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const calls = [];

      if (language === 'python') {
        this._extractPythonCalls(source, filePath, calls);
      } else {
        this._extractDirectCalls(source, filePath, calls);
        this._extractMethodCalls(source, filePath, calls);
      }

      this._detectDynamicCalls(source, filePath, calls);
      return calls;
    } catch (err) {
      return [];
    }
  }

  _extractDirectCalls(source, filePath, calls) {
    let match;
    while ((match = this.directCallPattern.exec(source)) !== null) {
      const callName = match[1];
      if (this.keywords.has(callName)) continue;

      const lineNumber = source.substring(0, match.index).split('\n').length;
      calls.push({
        call_type: 'direct',
        callee_name: callName,
        line_number: lineNumber,
        file_path: filePath
      });
    }
  }

  _extractMethodCalls(source, filePath, calls) {
    let match;
    while ((match = this.methodCallPattern.exec(source)) !== null) {
      const methodName = match[1];
      const lineNumber = source.substring(0, match.index).split('\n').length;
      calls.push({
        call_type: 'direct',
        callee_name: methodName,
        line_number: lineNumber,
        file_path: filePath
      });
    }
  }

  _extractPythonCalls(source, filePath, calls) {
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const matches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
      for (const match of matches) {
        const funcName = match[1];
        if (this.keywords.has(funcName)) continue;
        calls.push({
          call_type: 'direct',
          callee_name: funcName,
          line_number: i + 1,
          file_path: filePath
        });
      }

      const methodMatches = line.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
      for (const match of methodMatches) {
        const methodName = match[1];
        calls.push({
          call_type: 'direct',
          callee_name: methodName,
          line_number: i + 1,
          file_path: filePath
        });
      }
    }
  }

  _detectDynamicCalls(source, filePath, calls) {
    for (const [pattern, regex] of Object.entries(this.dynamicPatterns)) {
      let match;
      const regex_copy = new RegExp(regex);
      while ((match = regex_copy.exec(source)) !== null) {
        const lineNumber = source.substring(0, match.index).split('\n').length;
        calls.push({
          call_type: 'dynamic',
          callee_name: pattern,
          line_number: lineNumber,
          file_path: filePath
        });
      }
    }
  }
}

if (process.argv[1].endsWith('call-detector.js')) {
  const detector = new CallDetector();
  const testFile = process.argv[2];
  if (!testFile) {
    console.error('사용법: node call-detector.js <file>');
    process.exit(1);
  }
  const lang = testFile.endsWith('.py') ? 'python' : 'typescript';
  const calls = detector.extractCalls(testFile, lang);
  console.log(`\n✅ ${calls.length}개 호출 추출\n`);
  const byType = {};
  calls.forEach(c => {
    byType[c.call_type] = (byType[c.call_type] || 0) + 1;
  });
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}개`);
  });
}

export default CallDetector;
