/**
 * RAG 검색 엔진 (하이브리드)
 *
 * 역할:
 * - FTS 키워드 검색 (리콜 높음)
 * - BM25 유사도 검색 (정밀도 높음)
 * - 결과 재순위 (frequency, recency, ADR 관련도)
 */

class RAGEngine {
  constructor(kb, embedder) {
    this.kb = kb;
    this.embedder = embedder;
  }

  /**
   * 하이브리드 검색
   */
  search(query, options = {}) {
    const topK = options.topK || 5;
    const weights = {
      keyword: options.keywordWeight || 0.4,
      semantic: options.semanticWeight || 0.6
    };

    // 1. 키워드 검색
    const keywordResults = this.searchKeyword(query);

    // 2. 의미 검색
    const semanticResults = this.embedder.search(query, topK * 2);

    // 3. 결과 병합 및 재순위
    const combined = this.mergeResults(
      keywordResults,
      semanticResults,
      weights
    );

    // 4. 최종 재순위
    return this.rerank(combined, query).slice(0, topK);
  }

  /**
   * 키워드 검색 (FTS)
   */
  searchKeyword(query) {
    const keywords = query.toLowerCase().split(/\s+/);
    const results = [];
    const seen = new Set();

    keywords.forEach(kw => {
      // 정확히 일치
      const exact = this.kb.searchByKeyword(kw);
      exact.forEach(chunk => {
        if (!seen.has(chunk.id)) {
          results.push({ chunk, type: 'keyword', score: 1.0 });
          seen.add(chunk.id);
        }
      });

      // 부분 일치
      const partial = this.kb.search(kw);
      partial.forEach(chunk => {
        if (!seen.has(chunk.id)) {
          results.push({ chunk, type: 'keyword', score: 0.7 });
          seen.add(chunk.id);
        }
      });
    });

    return results;
  }

  /**
   * 결과 병합
   */
  mergeResults(keywordResults, semanticResults, weights) {
    const merged = new Map();

    // 키워드 결과
    keywordResults.forEach(result => {
      const score = result.score * weights.keyword;
      if (!merged.has(result.chunk.id)) {
        merged.set(result.chunk.id, {
          chunk: result.chunk,
          score: 0,
          keywordScore: 0,
          semanticScore: 0
        });
      }
      const entry = merged.get(result.chunk.id);
      entry.keywordScore = Math.max(entry.keywordScore, score);
    });

    // 의미 검색 결과
    semanticResults.forEach(result => {
      const score = result.score * weights.semantic;
      if (!merged.has(result.chunk.id)) {
        merged.set(result.chunk.id, {
          chunk: result.chunk,
          score: 0,
          keywordScore: 0,
          semanticScore: 0
        });
      }
      const entry = merged.get(result.chunk.id);
      entry.semanticScore = Math.max(entry.semanticScore, score);
    });

    // 종합 점수
    merged.forEach(entry => {
      entry.score = entry.keywordScore + entry.semanticScore;
    });

    return Array.from(merged.values());
  }

  /**
   * 결과 재순위
   */
  rerank(results, query) {
    const queryKeywords = new Set(query.toLowerCase().split(/\s+/));

    return results
      .map(result => {
        let bonus = 0;

        // 최근성 보너스
        const now = new Date();
        const updated = new Date(result.chunk.meta.lastScanned || now);
        const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);
        bonus += Math.max(0, 0.1 * (1 - daysSinceUpdate / 30));

        // 이름 일치 보너스
        if (result.chunk.name) {
          queryKeywords.forEach(kw => {
            if (result.chunk.name.toLowerCase().includes(kw)) {
              bonus += 0.2;
            }
          });
        }

        // ADR 관련도 보너스
        if (result.chunk.meta.repo) {
          const adrCount = this.kb.data.adr.length;
          if (adrCount > 0) {
            bonus += 0.05;
          }
        }

        return {
          ...result,
          finalScore: result.score + bonus
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * 쿼리 확장 (관련 용어 자동 추가)
   */
  expandQuery(query) {
    // 간단한 동의어 매핑
    const synonyms = {
      'bug': ['issue', 'error', 'fix'],
      'feature': ['add', 'implement', 'new'],
      'optimize': ['performance', 'perf', 'speed'],
      'refactor': ['restructure', 'improve', 'clean'],
      '버그': ['이슈', '에러', '수정'],
      '기능': ['추가', '구현', '새로운'],
      '최적화': ['성능', '속도', '개선']
    };

    let expanded = [query];
    const keywords = query.toLowerCase().split(/\s+/);

    keywords.forEach(kw => {
      if (synonyms[kw]) {
        expanded = expanded.concat(synonyms[kw]);
      }
    });

    return expanded;
  }

  /**
   * 검색 결과 포맷팅 (출력용)
   */
  formatResults(results) {
    return results.map(r => ({
      id: r.chunk.id,
      name: r.chunk.name,
      type: r.chunk.type,
      repo: r.chunk.meta.repo,
      file: r.chunk.meta.file,
      line: `${r.chunk.meta.lineStart}-${r.chunk.meta.lineEnd}`,
      score: r.finalScore.toFixed(3),
      preview: r.chunk.content.substring(0, 200).replace(/\n/g, ' ')
    }));
  }
}

export default RAGEngine;
