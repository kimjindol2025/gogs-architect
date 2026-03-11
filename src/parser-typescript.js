#!/usr/bin/env node

/**
 * TypeScript/JavaScript AST 파서
 * TS Compiler API 기반 함수 추출
 */

import ts from 'typescript';
import fs from 'fs';
import path from 'path';

class TypeScriptParser {
  constructor() {
    this.compilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
      strict: false,
      skipLibCheck: true,
      esModuleInterop: true
    };
  }

  /**
   * 파일에서 함수 추출
   */
  extractFunctions(filePath) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true
      );

      const functions = [];
      this._visitNode(sourceFile, source, functions, filePath);
      return functions;
    } catch (err) {
      console.error(`파서 에러 (${filePath}): ${err.message}`);
      return [];
    }
  }

  _visitNode(node, source, functions, filePath) {
    if (ts.isFunctionDeclaration(node)) {
      const fn = this._extractFunctionInfo(node, source, filePath, 'function');
      if (fn) functions.push(fn);
    }

    if (ts.isVariableStatement(node)) {
      // const fn = () => {}
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
          const fn = this._extractArrowInfo(decl, source, filePath);
          if (fn) functions.push(fn);
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      // class 메서드
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) {
          const fn = this._extractMethodInfo(member, node, source, filePath);
          if (fn) functions.push(fn);
        }
      }
    }

    if (ts.isObjectLiteralExpression(node)) {
      // { method() {} }
      for (const prop of node.properties) {
        if (ts.isMethodSignature(prop) || ts.isPropertyAssignment(prop)) {
          if (prop.initializer && ts.isFunctionExpression(prop.initializer)) {
            const fn = this._extractObjectMethodInfo(prop, source, filePath);
            if (fn) functions.push(fn);
          }
        }
      }
    }

    ts.forEachChild(node, child =>
      this._visitNode(child, source, functions, filePath)
    );
  }

  _extractFunctionInfo(node, source, filePath, type) {
    const name = node.name?.text;
    if (!name) return null;

    const startPos = node.getStart();
    const endPos = node.getEnd();
    const lineNum = this._getLineNumber(source, startPos);
    const content = source.substring(startPos, endPos);

    return {
      name,
      type,
      filePath,
      line_number: lineNum,
      signature: this._extractSignature(node),
      body_snippet: content.substring(0, 200),
      is_exported: node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false,
      is_async: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
      is_default_export: node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false
    };
  }

  _extractArrowInfo(decl, source, filePath) {
    const name = decl.name?.text;
    if (!name) return null;

    const startPos = decl.getStart();
    const endPos = decl.getEnd();
    const lineNum = this._getLineNumber(source, startPos);
    const content = source.substring(startPos, endPos);

    return {
      name,
      type: 'arrow',
      filePath,
      line_number: lineNum,
      signature: this._extractArrowSignature(decl.initializer),
      body_snippet: content.substring(0, 200),
      is_exported: false,
      is_async: decl.initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
      is_default_export: false
    };
  }

  _extractMethodInfo(member, cls, source, filePath) {
    const name = member.name?.text;
    if (!name) return null;

    const startPos = member.getStart();
    const endPos = member.getEnd();
    const lineNum = this._getLineNumber(source, startPos);
    const content = source.substring(startPos, endPos);
    const className = cls.name?.text || 'unknown';

    return {
      name: `${className}.${name}`,
      type: 'method',
      filePath,
      line_number: lineNum,
      signature: this._extractSignature(member),
      body_snippet: content.substring(0, 200),
      is_exported: false,
      is_async: member.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
      is_default_export: false
    };
  }

  _extractObjectMethodInfo(prop, source, filePath) {
    const keyName = prop.name?.text || prop.name?.getValue?.() || 'unknown';
    if (!keyName) return null;

    const startPos = prop.getStart();
    const endPos = prop.getEnd();
    const lineNum = this._getLineNumber(source, startPos);
    const content = source.substring(startPos, endPos);

    return {
      name: `obj.${keyName}`,
      type: 'object_method',
      filePath,
      line_number: lineNum,
      signature: '()',
      body_snippet: content.substring(0, 200),
      is_exported: false,
      is_async: false,
      is_default_export: false
    };
  }

  _extractSignature(node) {
    const params = node.parameters || [];
    const paramNames = params.map(p => p.name?.text || '...').join(', ');
    return `(${paramNames})`;
  }

  _extractArrowSignature(arrow) {
    const params = arrow.parameters || [];
    const paramNames = params.map(p => p.name?.text || '...').join(', ');
    return `(${paramNames}) => ...`;
  }

  _getLineNumber(source, position) {
    let lineNum = 1;
    for (let i = 0; i < position; i++) {
      if (source[i] === '\n') lineNum++;
    }
    return lineNum;
  }
}

// CLI 테스트
if (process.argv[1].endsWith('parser-typescript.js')) {
  const parser = new TypeScriptParser();
  const testFile = process.argv[2];

  if (!testFile) {
    console.error('사용법: node parser-typescript.js <file>');
    process.exit(1);
  }

  const functions = parser.extractFunctions(testFile);
  console.log(`\n✅ ${testFile}에서 ${functions.length}개 함수 추출\n`);
  functions.forEach(fn => {
    console.log(`  📍 ${fn.name} (line ${fn.line_number}, ${fn.type})`);
    if (fn.is_exported) console.log(`     ↳ exported`);
    if (fn.is_async) console.log(`     ↳ async`);
  });
}

export default TypeScriptParser;
