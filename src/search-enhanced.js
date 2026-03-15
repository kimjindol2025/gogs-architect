/**
 * 검색 엔진 강화 (Search Enhanced)
 *
 * 기능:
 * - 패턴 매칭 (코드 검색)
 * - 사용처 추적 (file:line:context)
 * - 호출 그래프 (calls_these, called_by)
 * - 의존성 분석
 * - AI 최적화 제안
 */

class SearchEnhanced {
  constructor(kb, embedder, patternAnalyzer) {
    this.kb = kb;
    this.embedder = embedder;
    this.analyzer = patternAnalyzer;
    this.callGraph = new Map(); // 함수 호출 관계
    this.usages = new Map();    // 심볼 사용처
    this.buildIndex();
  }

  /**
   * 색인 구축 (모의 데이터 기반)
   */
  buildIndex() {
    // 모의 함수 호출 그래프
    this.callGraph.set('parseToken', {
      calls: ['validate', 'normalize'],
      calledBy: ['process', 'analyze']
    });
    this.callGraph.set('validate', {
      calls: ['checkRange'],
      calledBy: ['parseToken', 'parseStatement']
    });
    this.callGraph.set('checkRange', {
      calls: [],
      calledBy: ['validate']
    });

    // 모의 심볼 사용처
    this.usages.set('aaa', [
      { file: 'parser.js', line: 45, func: 'parseToken', code: 'const aaa = value;' },
      { file: 'core.py', line: 123, func: 'process', code: 'aaa = parse_token()' },
      { file: 'utils.js', line: 78, func: 'validate', code: 'if (aaa) { ... }' }
    ]);

    this.usages.set('useState', [
      { file: 'components/App.jsx', line: 12, func: 'App', code: 'const [count, setCount] = useState(0);' },
      { file: 'hooks/useCounter.js', line: 5, func: 'useCounter', code: 'const [value, setValue] = useState(init);' },
      { file: 'pages/Home.jsx', line: 34, func: 'Home', code: 'const [data] = useState(null);' }
    ]);

    this.usages.set('for (let i', [
      { file: 'vcompiler/utils.js', line: 156, func: 'loopExample', code: 'for (let i = 0; i < n; i++) { array[i] += 1; }' },
      { file: 'freelang-v2/main.fl', line: 201, func: 'iterate', code: 'for (let i in items) { print(i); }' },
      { file: 'mojo-learning/compiler.js', line: 89, func: 'processLoop', code: 'for (let i = start; i < end; i++) { result.push(i); }' }
    ]);
  }

  /**
   * 고급 검색 (사용처 + 호출 관계 + 제안)
   */
  searchAdvanced(query) {
    const startTime = Date.now();

    // 1. 정규화 및 패턴 추출
    const normalized = this.analyzer?.normalizePattern?.(query) || query;

    // 2. 사용처 검색
    const usages = this.findUsages(query);

    // 3. 호출 관계 분석
    const callRelations = this.analyzeCallRelations(usages);

    // 4. 의존성 분석
    const dependencies = this.analyzeDependencies(usages);

    // 5. AI 최적화 제안
    const suggestions = this.generateSuggestions(query, usages, callRelations);

    const duration = Date.now() - startTime;

    return {
      query,
      normalizedPattern: normalized,
      totalFound: usages.length,
      duration: `${duration}ms`,
      usages,
      callRelations,
      dependencies,
      suggestions,
      summary: this.generateSummary(query, usages)
    };
  }

  /**
   * 사용처 검색
   */
  findUsages(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    // 정확히 일치하는 심볼 검색
    if (this.usages.has(query)) {
      return this.usages.get(query);
    }

    // 부분 일치 검색
    for (const [symbol, locations] of this.usages.entries()) {
      if (symbol.includes(queryLower) || queryLower.includes(symbol.split(' ')[0])) {
        results.push(...locations);
      }
    }

    // 패턴 매칭 (코드 유사도)
    const patternResults = [];
    for (const [symbol, locations] of this.usages.entries()) {
      for (const loc of locations) {
        if (this.isPatternMatch(query, loc.code)) {
          patternResults.push(loc);
        }
      }
    }

    return results.length > 0 ? results : patternResults;
  }

  /**
   * 패턴 매칭 유사도
   */
  isPatternMatch(query, code) {
    const queryTokens = query.toLowerCase().split(/\s+/);
    const codeTokens = code.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const token of queryTokens) {
      if (codeTokens.some(ct => ct.includes(token))) {
        matches++;
      }
    }

    return matches / queryTokens.length > 0.5;
  }

  /**
   * 호출 관계 분석
   */
  analyzeCallRelations(usages) {
    const relations = {};
    const functions = new Set(usages.map(u => u.func));

    for (const func of functions) {
      const graphEntry = this.callGraph.get(func);
      if (graphEntry) {
        relations[func] = graphEntry;
      }
    }

    return relations;
  }

  /**
   * 의존성 분석
   */
  analyzeDependencies(usages) {
    const deps = {
      files: new Set(),
      functions: new Set(),
      languages: new Set()
    };

    usages.forEach(u => {
      deps.files.add(u.file);
      deps.functions.add(u.func);

      const ext = u.file.split('.').pop();
      const langMap = {
        'js': 'JavaScript',
        'jsx': 'React',
        'py': 'Python',
        'fl': 'FreeLang',
        'ts': 'TypeScript'
      };
      deps.languages.add(langMap[ext] || ext);
    });

    return {
      fileCount: deps.files.size,
      files: Array.from(deps.files),
      functionCount: deps.functions.size,
      functions: Array.from(deps.functions),
      languages: Array.from(deps.languages)
    };
  }

  /**
   * AI 최적화 제안 생성
   */
  generateSuggestions(query, usages, callRelations) {
    const suggestions = [];

    // 제안 1: 사용 패턴
    if (usages.length > 0) {
      const pattern = usages[0].code;
      if (pattern.includes('const') && pattern.includes('=')) {
        suggestions.push({
          type: 'pattern',
          severity: 'low',
          message: `${usages.length}곳에서 변수 선언으로 사용됨. 모두 const로 일관성 유지됨.`,
          recommendation: '✅ 좋은 패턴입니다.'
        });
      }
    }

    // 제안 2: 호출 깊이
    const maxDepth = this.getMaxCallDepth(callRelations);
    if (maxDepth > 3) {
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        message: `호출 깊이: ${maxDepth}단계 (권장: ≤ 3단계)`,
        recommendation: '함수 단순화를 고려하세요.'
      });
    }

    // 제안 3: 사용 빈도
    if (usages.length < 2) {
      suggestions.push({
        type: 'usage',
        severity: 'low',
        message: `사용 빈도: ${usages.length}곳 (드묾)`,
        recommendation: '필요하면 제거하거나 확장하세요.'
      });
    } else {
      suggestions.push({
        type: 'usage',
        severity: 'info',
        message: `사용 빈도: ${usages.length}곳 (적절함)`,
        recommendation: '현재 설계가 좋습니다.'
      });
    }

    return suggestions;
  }

  /**
   * 호출 최대 깊이
   */
  getMaxCallDepth(callRelations, func = null, visited = new Set(), depth = 0) {
    if (!func) {
      let maxDepth = 0;
      for (const f in callRelations) {
        const d = this.getMaxCallDepth(callRelations, f, new Set(), 0);
        maxDepth = Math.max(maxDepth, d);
      }
      return maxDepth;
    }

    if (visited.has(func)) return depth;
    visited.add(func);

    const entry = callRelations[func];
    if (!entry || !entry.calls || entry.calls.length === 0) {
      return depth;
    }

    let maxDepth = depth;
    for (const called of entry.calls) {
      const callRels = {};
      for (const [k, v] of Object.entries(callRelations)) {
        if (k !== func) callRels[k] = v;
      }
      const d = this.getMaxCallDepth(callRels, called, new Set(visited), depth + 1);
      maxDepth = Math.max(maxDepth, d);
    }

    return maxDepth;
  }

  /**
   * 요약 생성
   */
  generateSummary(query, usages) {
    if (usages.length === 0) {
      return `❌ '${query}'를 찾을 수 없습니다.`;
    }

    const files = new Set(usages.map(u => u.file));
    const funcs = new Set(usages.map(u => u.func));

    return `✅ '${query}' → ${usages.length}곳 발견 (${files.size}개 파일, ${funcs.size}개 함수)`;
  }

  /**
   * 포맷팅된 결과 출력
   */
  formatResult(result) {
    let output = '';

    output += '\n' + '='.repeat(70) + '\n';
    output += `🔍 검색 결과: "${result.query}"\n`;
    output += '='.repeat(70) + '\n';

    output += `\n📊 통계\n`;
    output += `  총 발견: ${result.totalFound}곳\n`;
    output += `  검색 시간: ${result.duration}\n`;
    output += `  파일: ${result.dependencies.fileCount}개\n`;
    output += `  함수: ${result.dependencies.functionCount}개\n`;
    output += `  언어: ${result.dependencies.languages.join(', ')}\n`;

    output += `\n📂 사용처\n`;
    result.usages.slice(0, 5).forEach((u, i) => {
      output += `  ${i + 1}. [${u.file}:${u.line}]\n`;
      output += `     함수: ${u.func}()\n`;
      output += `     코드: ${u.code}\n`;
    });
    if (result.usages.length > 5) {
      output += `  ... 외 ${result.usages.length - 5}곳\n`;
    }

    if (Object.keys(result.callRelations).length > 0) {
      output += `\n🔗 호출 관계\n`;
      for (const [func, rel] of Object.entries(result.callRelations)) {
        output += `  ${func}:\n`;
        output += `    호출: ${rel.calls.join(', ') || '없음'}\n`;
        output += `    호출자: ${rel.calledBy.join(', ') || '없음'}\n`;
      }
    }

    output += `\n💡 최적화 제안\n`;
    result.suggestions.forEach((s, i) => {
      const icon = s.severity === 'high' ? '🔴' : s.severity === 'medium' ? '🟡' : '🟢';
      output += `  ${i + 1}. ${icon} [${s.type.toUpperCase()}] ${s.message}\n`;
      output += `     → ${s.recommendation}\n`;
    });

    output += `\n📝 요약\n  ${result.summary}\n`;
    output += '='.repeat(70) + '\n';

    return output;
  }
}

export default SearchEnhanced;
