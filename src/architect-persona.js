/**
 * 수석 아키텍트 페르소나
 *
 * 역할:
 * - Gogs 저장소의 지식을 기반으로 지능형 분석
 * - ADR 검증
 * - 컨텍스트 기반 응답 생성
 */

class ArchitectPersona {
  constructor(kb, ragEngine) {
    this.kb = kb;
    this.ragEngine = ragEngine;
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 시스템 프롬프트 구축
   */
  buildSystemPrompt() {
    const stats = this.kb.getStatistics();
    const repos = this.kb.getRepositories();
    const adrs = this.kb.getADRs();

    let prompt = `당신은 ${repos.length}개 Gogs 저장소의 수석 아키텍트입니다.

## 기본 원칙

1. **증거 기반**: 모든 답변을 "repo/file:line" 형식으로 근거를 제시
2. **ADR 준수**: 다음 ADR을 항상 고려
`;

    adrs.slice(0, 5).forEach(adr => {
      prompt += `   - ${adr.sha.substring(0, 7)}: ${adr.message.substring(0, 50)}\n`;
    });

    prompt += `
3. **컨텍스트 인식**: 이전 대화 기록을 고려

## 통계

- 저장소: ${stats.totalRepositories}개
- 청크: ${stats.totalChunks}개
- 커밋: ${stats.totalCommits}개
- 언어: ${stats.languages.join(', ')}

## 응답 형식

\`\`\`
[출처] repo/file:line
[분석] 기술적 분석 내용
[권고] 권장 사항
[위험] 있으면 명시 (없으면 "위험 없음")
\`\`\``;

    return prompt;
  }

  /**
   * 쿼리 분석 및 컨텍스트 구축
   */
  async analyzeQuery(query) {
    // 1. RAG 검색으로 관련 청크 찾기
    const relevantChunks = this.ragEngine.search(query, 5);

    // 2. 저장소 분류
    const repos = new Set(relevantChunks.map(r => r.chunk.meta.repo));

    // 3. 언어 분석
    const languages = new Set(relevantChunks.map(r => r.chunk.meta.language));

    // 4. 키워드 추출
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    return {
      query: query,
      relevantChunks: relevantChunks,
      repositories: Array.from(repos),
      languages: Array.from(languages),
      keywords: keywords,
      context: this.buildContext(relevantChunks)
    };
  }

  /**
   * 컨텍스트 구축 (Claude에 전달할 정보)
   */
  buildContext(chunks) {
    let context = '## 관련 코드\n\n';

    chunks.forEach((result, idx) => {
      const chunk = result.chunk;
      context += `### [${idx + 1}] ${chunk.name}\n`;
      context += `**출처**: ${chunk.meta.repo}/${chunk.meta.file}:${chunk.meta.lineStart}\n`;
      context += `**타입**: ${chunk.type}\n`;
      context += `**내용**:\n\`\`\`${chunk.meta.language || 'text'}\n`;
      context += `${chunk.content.substring(0, 500)}\n`;
      if (chunk.content.length > 500) {
        context += `... (총 ${chunk.content.length} 자)\n`;
      }
      context += `\`\`\`\n\n`;
    });

    return context;
  }

  /**
   * ADR 검증
   */
  validateADR(code, adrList = null) {
    const adrToCheck = adrList || this.kb.getADRs();
    const violations = [];

    // ADR-001: npm zero-dependency 확인
    if (code.includes('require(') && code.includes('node_modules')) {
      violations.push({
        adr: 'ADR-001',
        message: 'npm 외부 의존성 감지',
        severity: 'high'
      });
    }

    // ADR-002: Phase 일관성 확인
    const phaseMatch = code.match(/Phase\s*(\d+)/i);
    if (phaseMatch) {
      const phase = parseInt(phaseMatch[1]);
      if (phase > 20) {
        violations.push({
          adr: 'ADR-002',
          message: `Phase 범위 초과: ${phase} > 20`,
          severity: 'medium'
        });
      }
    }

    return {
      hasViolations: violations.length > 0,
      violations: violations
    };
  }

  /**
   * 분석 보고서 생성
   */
  generateReport(analysis) {
    let report = `# 아키텍트 분석 보고서\n\n`;
    report += `## 쿼리\n\`${analysis.query}\`\n\n`;

    report += `## 관련 저장소\n`;
    analysis.repositories.forEach(r => {
      report += `- ${r}\n`;
    });

    report += `\n## 관련 언어\n`;
    analysis.languages.forEach(l => {
      report += `- ${l}\n`;
    });

    report += `\n## 찾은 청크\n`;
    analysis.relevantChunks.forEach((result, idx) => {
      const chunk = result.chunk;
      report += `${idx + 1}. **${chunk.name}** (점수: ${result.finalScore.toFixed(3)})\n`;
      report += `   - 위치: ${chunk.meta.repo}/${chunk.meta.file}:${chunk.meta.lineStart}\n`;
      report += `   - 타입: ${chunk.type}\n`;
    });

    return report;
  }

  /**
   * 설계 제안 생성
   */
  generateDesignSuggestion(phase) {
    const suggestions = {
      1: '데이터 파이프라인 설계: Gogs 저장소 스캔 → 파일 수집 → 메타데이터 인덱싱',
      2: '지능형 분석: 임베딩 → RAG 검색 → 페르소나 기반 응답',
      3: 'CLI 인터페이스: "gogs-ai ask", "gogs-ai review" 명령어',
      4: '자율화: AI 팀 라우터, 자동 문서화, 선제적 제안',
      5: '자기 호스팅: PyFree로 Node.js 의존성 제거'
    };

    return suggestions[phase] || '다음 단계를 계획하세요';
  }
}

export default ArchitectPersona;
