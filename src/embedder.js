/**
 * BM25 기반 임베딩 엔진 (로컬, npm zero-dependency)
 *
 * 역할:
 * - 코드 토큰화 (camelCase, snake_case 분해)
 * - TF-IDF 가중치 계산
 * - 희소 벡터 생성
 */

class Embedder {
  constructor(kb) {
    this.kb = kb;
    this.documents = []; // 청크 배열
    this.vocabulary = new Map(); // 토큰 → ID
    this.idf = new Map(); // 토큰 → IDF 스코어
    this.vectors = new Map(); // chunkId → 희소 벡터

    this.build();
  }

  /**
   * 토큰화 (코드 특화)
   */
  tokenize(text) {
    const tokens = [];

    // camelCase 분해
    let words = text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .split(/[\s\-_:\/\\.()[\]{},"';+*=<>!&|?#@$%^~`]+/);

    // 불용어 제거
    const stopwords = new Set([
      'the', 'a', 'an', 'is', 'are', 'be', 'to', 'of', 'in', 'for', 'and', 'or',
      'if', 'else', 'return', 'function', 'class', 'def', 'import', 'export',
      'this', 'self', 'that', 'which', 'what', 'where', 'when', 'why',
      '함수', '클래스', '변수', '정의', '반환'
    ]);

    words.forEach(w => {
      const lower = w.toLowerCase();
      if (lower.length > 2 && !stopwords.has(lower)) {
        tokens.push(lower);
      }
    });

    return tokens;
  }

  /**
   * 임베딩 구축
   */
  build() {
    this.documents = this.kb.data.chunks;

    // 어휘 구축 및 문서 빈도 계산
    const docFreq = new Map();

    this.documents.forEach(doc => {
      const tokens = this.tokenize(doc.content + ' ' + doc.name);
      const uniqueTokens = new Set(tokens);

      uniqueTokens.forEach(token => {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      });
    });

    // IDF 계산
    const N = this.documents.length;
    docFreq.forEach((freq, token) => {
      const idf = Math.log(N / (1 + freq));
      this.idf.set(token, idf);
    });

    // 벡터 생성
    this.documents.forEach(doc => {
      const vector = this.createVector(doc);
      this.vectors.set(doc.id, vector);
    });
  }

  /**
   * 청크 벡터 생성
   */
  createVector(doc) {
    const tokens = this.tokenize(doc.content + ' ' + doc.name);
    const tf = new Map();

    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });

    const vector = {};
    tf.forEach((count, token) => {
      const tokenId = this.vocabulary.get(token);
      const idf = this.idf.get(token) || 0;
      vector[tokenId] = count * idf;
    });

    return vector;
  }

  /**
   * 쿼리 임베딩
   */
  embed(query) {
    const tokens = this.tokenize(query);
    const tf = new Map();

    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });

    const vector = {};
    tf.forEach((count, token) => {
      if (this.vocabulary.has(token)) {
        const tokenId = this.vocabulary.get(token);
        const idf = this.idf.get(token) || 0;
        vector[tokenId] = count * idf;
      }
    });

    return vector;
  }

  /**
   * 코사인 유사도 계산
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    // vec1 노름
    Object.values(vec1).forEach(v => {
      norm1 += v * v;
    });

    // vec2 노름
    Object.values(vec2).forEach(v => {
      norm2 += v * v;
    });

    // 내적
    Object.keys(vec1).forEach(idx => {
      if (vec2[idx]) {
        dotProduct += vec1[idx] * vec2[idx];
      }
    });

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 유사도 검색
   */
  search(query, topK = 5) {
    const queryVec = this.embed(query);
    const results = [];

    this.documents.forEach(doc => {
      const docVec = this.vectors.get(doc.id);
      const score = this.cosineSimilarity(queryVec, docVec);

      if (score > 0) {
        results.push({
          id: doc.id,
          score: score,
          chunk: doc
        });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 통계
   */
  getStatistics() {
    return {
      vocabularySize: this.vocabulary.size,
      documentCount: this.documents.length,
      vectorCount: this.vectors.size,
      averageTokensPerDocument: this.documents.length > 0 ?
        this.documents.reduce((sum, d) => sum + this.tokenize(d.content).length, 0) / this.documents.length : 0
    };
  }
}

export default Embedder;
