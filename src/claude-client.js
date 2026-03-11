/**
 * Claude API 클라이언트
 *
 * 역할:
 * - Claude와 대화
 * - 슬라이딩 윈도우 메모리 관리
 * - 토큰 계산 및 최적화
 */

import https from 'https';

class ClaudeClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = options.model || 'claude-haiku-4-5-20251001';
    this.maxTokens = options.maxTokens || 2000;
    this.conversationHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 10;

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY 환경변수 필수');
    }
  }

  /**
   * 메시지 전송 (스트리밍 지원)
   */
  async chat(userMessage, systemPrompt = '') {
    // 히스토리에 사용자 메시지 추가
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // 슬라이딩 윈도우 적용
    const messages = this.getContextWindow();

    return new Promise((resolve, reject) => {
      const requestBody = {
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages
      };

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 60000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`API 오류 ${res.statusCode}: ${data}`));
            return;
          }

          try {
            const response = JSON.parse(data);
            const assistantMessage = response.content[0].text;

            // 히스토리에 어시스턴트 응답 추가
            this.conversationHistory.push({
              role: 'assistant',
              content: assistantMessage
            });

            resolve({
              message: assistantMessage,
              usage: response.usage,
              model: response.model
            });
          } catch (e) {
            reject(new Error(`응답 파싱 실패: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('요청 시간 초과'));
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }

  /**
   * 컨텍스트 윈도우 (최근 N개 턴)
   */
  getContextWindow() {
    const start = Math.max(0, this.conversationHistory.length - this.maxHistoryLength);
    return this.conversationHistory.slice(start);
  }

  /**
   * 토큰 수 추정 (간단한 버전)
   */
  estimateTokens(text) {
    // 영어: 약 4글자 = 1토큰
    // 한글: 약 2글자 = 1토큰
    const englishChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const koreanChars = (text.match(/[가-힣]/g) || []).length;

    return Math.ceil(englishChars / 4 + koreanChars / 2);
  }

  /**
   * 메모리 조정 (토큰 초과 시)
   */
  trimMemory() {
    if (this.conversationHistory.length > this.maxHistoryLength * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * 대화 초기화
   */
  reset() {
    this.conversationHistory = [];
  }

  /**
   * 대화 히스토리 반환
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * 대화 저장 (JSON)
   */
  saveSession(filepath) {
    const fs = require('fs');
    const data = {
      savedAt: new Date().toISOString(),
      model: this.model,
      history: this.conversationHistory
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * 대화 로드
   */
  loadSession(filepath) {
    const fs = require('fs');
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      this.conversationHistory = data.history || [];
    } catch (e) {
      console.warn(`세션 로드 실패: ${e.message}`);
    }
  }
}

export default ClaudeClient;
