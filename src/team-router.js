/**
 * AI 팀 라우터 (오케스트레이터)
 *
 * 역할:
 * - 질문 분류기: 키워드 기반 에이전트 라우팅
 * - 전문 에이전트 파이프라인
 * - 결과 집계 및 최종 의견 합성
 */

import ArchitectPersona from './architect-persona.js';
import RAGEngine from './rag-engine.js';
import KnowledgeBase from './knowledge-base.js';

class TeamRouter {
  constructor(kb, embedder) {
    this.kb = kb;
    this.embedder = embedder;
    this.rag = new RAGEngine(kb, embedder);
    this.architectPersona = new ArchitectPersona(kb, this.rag);

    // 에이전트 역할 정의
    this.agents = {
      'compiler': {
        keywords: ['parser', 'ast', 'lexer', 'codegen', 'compile', '파서', '컴파일', '렉서'],
        focus: ['freelang-c', 'compiler-ts', 'pyfree'],
        systemPrompt: '넌 컴파일러 전문가다. 파서, AST, 코드생성에 집중해.'
      },
      'perf': {
        keywords: ['성능', 'optimize', 'performance', 'simd', 'io-uring', 'memory', 'cache', '메모리'],
        focus: ['http', 'freelang-c'],
        systemPrompt: '넌 성능 최적화 전문가다. 알고리즘, 메모리, 캐시에 집중해.'
      },
      'db': {
        keywords: ['database', 'sql', 'sqlite', 'mysql', 'postgres', 'query', '데이터베이스', '쿼리'],
        focus: ['freelang-database-driver', 'pyfree'],
        systemPrompt: '넌 데이터베이스 전문가다. 스키마, 인덱싱, 트랜잭션에 집중해.'
      },
      'debug': {
        keywords: ['bug', 'error', 'debug', 'fix', 'fail', 'crash', '버그', '에러', '디버그'],
        focus: ['pyfree', 'freelang-c'],
        systemPrompt: '넌 디버깅 전문가다. 근본원인 분석에 집중해.'
      },
      'docs': {
        keywords: ['documentation', 'readme', 'guide', 'tutorial', 'doc', '문서', '가이드'],
        focus: ['Pattern-Vector-DB', 'freelang-c'],
        systemPrompt: '넌 기술문서 작가다. 명확함과 완성도에 집중해.'
      },
      'arch': {
        keywords: ['architecture', 'design', 'adr', 'pattern', 'structure', '아키텍처', '설계', 'adr'],
        focus: ['pyfree', 'freelang-c', 'mojo-learning'],
        systemPrompt: '넌 수석 아키텍트다. 전체 시스템 설계에 집중해.'
      }
    };
  }

  /**
   * 질문 분류 (에이전트 라우팅)
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    const scores = {};

    // 각 에이전트별 점수 계산
    Object.entries(this.agents).forEach(([name, agent]) => {
      let score = 0;

      // 키워드 매칭
      agent.keywords.forEach(keyword => {
        if (lowerQuery.includes(keyword)) {
          score += 10;
        }
      });

      // 저장소 언급
      agent.focus.forEach(repo => {
        if (lowerQuery.includes(repo)) {
          score += 5;
        }
      });

      scores[name] = score;
    });

    // 최고 점수 에이전트 선택
    const topAgent = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      agent: topAgent[0],
      confidence: topAgent[1] / 100,
      allScores: scores
    };
  }

  /**
   * 단일 에이전트 분석
   */
  async analyzeWithAgent(agent, query) {
    console.log(`\n🤖 ${agent.toUpperCase()} 에이전트 분석 중...`);

    // 각 에이전트별 전문 RAG 검색
    const searchResults = this.rag.search(query, {
      topK: 3,
      filter: this.agents[agent].focus
    });

    const context = searchResults
      .map(r => `[${r.chunk.meta.repo}:${r.chunk.meta.file}:${r.chunk.meta.lineStart}]\n${r.chunk.content}`)
      .join('\n---\n');

    // 기본 아키텍트 페르소나로 분석
    const analysis = await this.architectPersona.analyzeQuery(query);

    return {
      agent: agent,
      context: context,
      findings: searchResults,
      analysis: analysis
    };
  }

  /**
   * 다중 에이전트 분석 (순차)
   */
  async analyzeWithMultipleAgents(query, topN = 2) {
    const classified = this.classifyQuery(query);

    console.log(`\n📋 질문 분류: ${classified.agent} (신뢰도: ${(classified.confidence * 100).toFixed(0)}%)`);
    console.log(`점수: `, classified.allScores);

    // 최상위 N개 에이전트 선택
    const topAgents = Object.entries(classified.allScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([name]) => name);

    // 각 에이전트 분석 실행
    const results = [];
    for (const agent of topAgents) {
      const result = await this.analyzeWithAgent(agent, query);
      results.push(result);
    }

    return {
      classified: classified,
      results: results
    };
  }

  /**
   * 최종 의견 합성 (수석 아키텍트가 결과 정렬)
   */
  synthesizeResults(multiResults) {
    let synthesis = '## 🏛️ 최종 종합 의견\n\n';

    multiResults.results.forEach((result, idx) => {
      synthesis += `### ${idx + 1}. ${result.agent.toUpperCase()} 관점\n`;
      synthesis += `신뢰도: ${(result.analysis.confidence * 100).toFixed(0)}%\n`;
      synthesis += `\n**주요 발견:**\n`;

      result.findings.slice(0, 2).forEach(f => {
        synthesis += `- ${f.chunk.name} (${f.chunk.meta.repo})\n`;
      });

      synthesis += '\n';
    });

    synthesis += '### 🎯 수석 아키텍트 권고\n';
    synthesis += '- 위 분석들을 종합할 때...\n';
    synthesis += '- 우선순위: ' + multiResults.results[0].agent.toUpperCase() + '\n';
    synthesis += '- 위험도: 낮음\n';

    return synthesis;
  }

  /**
   * 통합 라우팅 (질문 입력 → 최종 답변)
   */
  async routeQuery(query) {
    console.log(`\n🔄 AI 팀 라우터 시작\n`);

    try {
      // 1. 다중 에이전트 분석
      const multiResults = await this.analyzeWithMultipleAgents(query, 2);

      // 2. 결과 합성
      const synthesis = this.synthesizeResults(multiResults);

      console.log(synthesis);

      return {
        success: true,
        classification: multiResults.classified,
        results: multiResults.results,
        synthesis: synthesis
      };
    } catch (error) {
      console.error(`❌ 라우팅 실패: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default TeamRouter;
