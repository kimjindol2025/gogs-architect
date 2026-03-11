/**
 * 다중언어 코드 파서 (간단한 버전)
 * - Markdown: 섹션 단위로 청크 분해
 * - Free/FL: 함수/클래스 추출
 * - TypeScript/JavaScript: 정규식으로 함수 추출
 * - Python: def/class 추출
 */

class Parser {
  constructor() {
    this.chunkId = 0;
  }

  getFileType(filepath) {
    const ext = filepath.split('.').pop().toLowerCase();
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['free', 'fl'].includes(ext)) return 'free';
    if (['ts', 'tsx'].includes(ext)) return 'typescript';
    if (['js', 'jsx'].includes(ext)) return 'javascript';
    if (['py'].includes(ext)) return 'python';
    return 'unknown';
  }

  parseFile(filepath, content, meta = {}) {
    const fileType = this.getFileType(filepath);

    if (fileType === 'markdown') {
      return this.parseMarkdown(filepath, content, meta);
    } else if (['free', 'fl'].includes(fileType)) {
      return this.parseFreeLang(filepath, content, meta);
    } else if (['typescript', 'javascript'].includes(fileType)) {
      return this.parseJavaScript(filepath, content, meta);
    } else if (fileType === 'python') {
      return this.parsePython(filepath, content, meta);
    }
    return [];
  }

  parseMarkdown(filepath, content, meta) {
    const chunks = [];
    const lines = content.split('\n');
    let currentSection = null;
    let sectionContent = [];
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+(.+)$/);

      if (match) {
        if (currentSection && sectionContent.length > 0) {
          chunks.push({
            id: `${meta.repo}/md/${filepath}:${sectionStart}:${currentSection}`,
            type: 'section',
            name: currentSection,
            content: sectionContent.join('\n'),
            meta: { repo: meta.repo, file: filepath, lineStart: sectionStart + 1, lineEnd: i, language: 'markdown' }
          });
        }
        currentSection = match[2];
        sectionContent = [line];
        sectionStart = i;
      } else {
        sectionContent.push(line);
      }
    }

    if (currentSection && sectionContent.length > 0) {
      chunks.push({
        id: `${meta.repo}/md/${filepath}:${sectionStart}:${currentSection}`,
        type: 'section',
        name: currentSection,
        content: sectionContent.join('\n'),
        meta: { repo: meta.repo, file: filepath, lineStart: sectionStart + 1, lineEnd: lines.length, language: 'markdown' }
      });
    }

    return chunks;
  }

  parseFreeLang(filepath, content, meta) {
    const chunks = [];
    const lines = content.split('\n');
    let inFunc = false;
    let name = '';
    let start = 0;
    let indent = 0;
    let funcLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('def ')) {
        if (inFunc && name) {
          chunks.push(this.createChunk('function', filepath, meta, start, i - 1, name, funcLines));
        }
        const m = trimmed.match(/def\s+(\w+)/);
        name = m ? m[1] : 'unknown';
        start = i;
        indent = line.match(/^\s*/)[0].length;
        funcLines = [line];
        inFunc = true;
      } else if (inFunc) {
        const lineIndent = line.match(/^\s*/)[0].length;
        if (trimmed && lineIndent <= indent && !trimmed.startsWith('#')) {
          chunks.push(this.createChunk('function', filepath, meta, start, i - 1, name, funcLines));
          inFunc = false;
        } else {
          funcLines.push(line);
        }
      }
    }

    if (inFunc && name) {
      chunks.push(this.createChunk('function', filepath, meta, start, lines.length - 1, name, funcLines));
    }

    return chunks;
  }

  parseJavaScript(filepath, content, meta) {
    const chunks = [];
    const lines = content.split('\n');
    const regex = /^\s*(async\s+)?function\s+(\w+)\s*\(|^\s*const\s+(\w+)\s*=\s*(async\s*)?\(/gm;

    let match;
    const matches = [];
    while ((match = regex.exec(content)) !== null) {
      matches.push({ name: match[2] || match[3], idx: match.index });
    }

    matches.forEach((m, idx) => {
      const lineStart = content.substring(0, m.idx).split('\n').length - 1;
      const lineEnd = idx + 1 < matches.length ?
        content.substring(0, matches[idx + 1].idx).split('\n').length - 1 :
        lines.length - 1;

      const funcContent = lines.slice(lineStart, lineEnd + 1).join('\n');
      if (funcContent) {
        chunks.push({
          id: `${meta.repo}/js/${filepath}:${lineStart}:${m.name}`,
          type: 'function',
          name: m.name,
          content: funcContent,
          meta: { repo: meta.repo, file: filepath, lineStart: lineStart + 1, lineEnd: lineEnd + 1, language: 'javascript' }
        });
      }
    });

    return chunks;
  }

  parsePython(filepath, content, meta) {
    const chunks = [];
    const lines = content.split('\n');
    let inDef = false;
    let name = '';
    let start = 0;
    let indent = 0;
    let defLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const curIndent = line.match(/^\s*/)[0].length;

      if (trimmed.startsWith('def ')) {
        if (inDef && name) {
          chunks.push(this.createChunk('function', filepath, meta, start, i - 1, name, defLines));
        }
        const m = trimmed.match(/def\s+(\w+)/);
        name = m ? m[1] : 'unknown';
        start = i;
        indent = curIndent;
        defLines = [line];
        inDef = true;
      } else if (inDef) {
        if (trimmed && curIndent <= indent && !trimmed.startsWith('#')) {
          chunks.push(this.createChunk('function', filepath, meta, start, i - 1, name, defLines));
          inDef = false;
        } else {
          defLines.push(line);
        }
      }
    }

    if (inDef && name) {
      chunks.push(this.createChunk('function', filepath, meta, start, lines.length - 1, name, defLines));
    }

    return chunks;
  }

  createChunk(type, filepath, meta, lineStart, lineEnd, name, contentLines) {
    return {
      id: `${meta.repo}/${type}/${filepath}:${lineStart}:${name}`,
      type: type,
      name: name,
      content: contentLines.join('\n'),
      meta: { repo: meta.repo, file: filepath, lineStart: lineStart + 1, lineEnd: lineEnd + 1, language: this.getFileType(filepath) }
    };
  }
}

export default Parser;
