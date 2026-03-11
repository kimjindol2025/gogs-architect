/**
 * 자기 진화형 문서화 엔진
 *
 * 역할:
 * - 새 함수/클래스 추가 감지 → ARCHITECTURE.md 자동 업데이트
 * - 커밋 메시지 분석 → CHANGELOG.md 자동 생성
 * - Phase 완료 감지 → 진행 상황 표 자동 업데이트
 * - Gogs에 자동 커밋
 */

import GogsClient from './gogs-client.js';
import Parser from './parser.js';

class DocUpdater {
  constructor() {
    this.gogsClient = new GogsClient();
    this.parser = new Parser();
  }

  /**
   * 함수/클래스 추출 (변경사항 감지용)
   */
  extractDefinitions(content, filePath) {
    const defs = [];

    // 함수 패턴: fn name() { ... }
    const fnPattern = /fn\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;
    while ((match = fnPattern.exec(content)) !== null) {
      defs.push({
        type: 'function',
        name: match[1],
        file: filePath
      });
    }

    // 클래스 패턴: class Name { ... }
    const classPattern = /class\s+(\w+)\s*\{/g;
    while ((match = classPattern.exec(content)) !== null) {
      defs.push({
        type: 'class',
        name: match[1],
        file: filePath
      });
    }

    // Struct 패턴: struct Name { ... }
    const structPattern = /struct\s+(\w+)\s*\{/g;
    while ((match = structPattern.exec(content)) !== null) {
      defs.push({
        type: 'struct',
        name: match[1],
        file: filePath
      });
    }

    return defs;
  }

  /**
   * ARCHITECTURE.md 생성 (신규 정의 추가)
   */
  generateArchitectureUpdate(newDefinitions) {
    let update = '## 최근 추가된 구조\n\n';
    update += `*생성일: ${new Date().toISOString()}*\n\n`;

    // 타입별 분류
    const byType = {};
    newDefinitions.forEach(def => {
      if (!byType[def.type]) byType[def.type] = [];
      byType[def.type].push(def);
    });

    // 각 타입별 섹션
    Object.entries(byType).forEach(([type, defs]) => {
      update += `### ${type.toUpperCase()} 정의\n`;
      defs.forEach(def => {
        update += `- **${def.name}** (${def.file})\n`;
      });
      update += '\n';
    });

    return update;
  }

  /**
   * CHANGELOG.md 생성 (커밋 메시지 기반)
   */
  generateChangelog(commits) {
    let changelog = '# CHANGELOG\n\n';
    changelog += `*마지막 업데이트: ${new Date().toLocaleDateString('ko-KR')}*\n\n`;

    // 커밋을 타입별로 분류
    const byType = {};

    commits.forEach(commit => {
      const message = commit.message || commit.commit?.message || '';
      const firstLine = message.split('\n')[0];

      // Conventional Commit 패턴 감지
      let type = 'other';
      if (firstLine.startsWith('feat')) type = 'Features';
      else if (firstLine.startsWith('fix')) type = 'Fixes';
      else if (firstLine.startsWith('perf')) type = 'Performance';
      else if (firstLine.startsWith('refactor')) type = 'Refactoring';
      else if (firstLine.startsWith('docs')) type = 'Documentation';
      else if (firstLine.startsWith('test')) type = 'Tests';

      if (!byType[type]) byType[type] = [];
      byType[type].push({
        message: firstLine,
        author: commit.author?.name || commit.committer?.name || 'Unknown',
        date: commit.author?.date || commit.committer?.date || new Date().toISOString()
      });
    });

    // 각 타입별 섹션
    Object.entries(byType).forEach(([type, items]) => {
      changelog += `## ${type}\n\n`;
      items.forEach(item => {
        changelog += `- ${item.message} (${item.author})\n`;
      });
      changelog += '\n';
    });

    return changelog;
  }

  /**
   * Phase 진행 상황 표 생성
   */
  generateProgressTable(phases) {
    let table = '# 프로젝트 진행 상황\n\n';
    table += '| Phase | 주제 | 진도 | 상태 |\n';
    table += '|-------|------|------|------|\n';

    phases.forEach(phase => {
      const progress = phase.completed ? '✅' : '⚠️';
      const percentage = phase.percentage || 0;
      table += `| ${phase.number} | ${phase.name} | ${percentage}% | ${progress} |\n`;
    });

    return table;
  }

  /**
   * Phase 감지 (커밋 메시지에서)
   */
  detectPhaseProgress(commits) {
    const phases = {};

    commits.forEach(commit => {
      const message = commit.message || commit.commit?.message || '';

      // Phase X 패턴 감지
      const match = message.match(/Phase\s+(\d+)/i);
      if (match) {
        const phaseNum = parseInt(match[1]);
        if (!phases[phaseNum]) {
          phases[phaseNum] = { number: phaseNum, count: 0, completed: false };
        }
        phases[phaseNum].count++;

        // "complete", "done", "finish" 감지
        if (/complete|done|finish/i.test(message)) {
          phases[phaseNum].completed = true;
        }
      }
    });

    return Object.values(phases).sort((a, b) => a.number - b.number);
  }

  /**
   * README.md 헤더 생성
   */
  generateReadmeHeader(stats) {
    const lines = [];
    lines.push('# Gogs AI 아키텍트');
    lines.push('');
    lines.push('> 277개 Gogs 저장소를 살아있는 AI 지식 베이스로 변환하는 시스템');
    lines.push('');
    lines.push('## 📊 현황');
    lines.push('');
    lines.push(`- **저장소**: ${stats.totalRepositories}개`);
    lines.push(`- **청크**: ${stats.totalChunks}개`);
    lines.push(`- **커밋**: ${stats.totalCommits}개`);
    lines.push(`- **파일**: ${stats.totalFiles}개`);
    lines.push(`- **마지막 업데이트**: ${new Date().toLocaleString('ko-KR')}`);
    lines.push('');
    lines.push('## 구조');
    lines.push('');
    lines.push('src/');
    lines.push('  ├── gogs-client.js        # API 클라이언트');
    lines.push('  ├── scraper.js            # 저장소 스캔');
    lines.push('  ├── parser.js             # 코드 파서');
    lines.push('  ├── commit-extractor.js   # 커밋 분석');
    lines.push('  ├── knowledge-base.js     # 지식 베이스');
    lines.push('  ├── embedder.js           # BM25 임베딩');
    lines.push('  ├── rag-engine.js         # RAG 검색');
    lines.push('  ├── architect-persona.js  # AI 페르소나');
    lines.push('  ├── team-router.js        # 팀 라우터');
    lines.push('  ├── cli.js                # CLI');
    lines.push('  ├── webhook-server.js     # Webhook');
    lines.push('  ├── reviewer.js           # 코드 리뷰');
    lines.push('  └── issue-bot.js          # 이슈 생성');
    lines.push('');
    lines.push('## 사용법');
    lines.push('');
    lines.push('# CLI 명령어');
    lines.push('gogs-ai ask "아키텍처 질문"');
    lines.push('gogs-ai status');
    lines.push('gogs-ai dashboard');
    lines.push('gogs-ai chat');
    lines.push('');
    lines.push('# Webhook 서버 시작');
    lines.push('node src/webhook-server.js');

    return lines.join('\n');
  }

  /**
   * 통합 문서화 업데이트
   */
  async updateDocumentation(owner, repo, commits, newDefinitions, stats) {
    console.log(`\n📝 문서화 업데이트: ${owner}/${repo}`);

    try {
      const updates = [];

      // 1. CHANGELOG.md 생성
      if (commits && commits.length > 0) {
        const changelog = this.generateChangelog(commits);
        updates.push({
          path: 'CHANGELOG.md',
          content: changelog,
          type: 'changelog'
        });
        console.log(`  ✓ CHANGELOG.md 생성 (${commits.length}개 커밋)`);
      }

      // 2. ARCHITECTURE.md 업데이트
      if (newDefinitions && newDefinitions.length > 0) {
        const archUpdate = this.generateArchitectureUpdate(newDefinitions);
        updates.push({
          path: 'ARCHITECTURE.md',
          content: archUpdate,
          type: 'architecture'
        });
        console.log(`  ✓ ARCHITECTURE.md 업데이트 (${newDefinitions.length}개 정의)`);
      }

      // 3. README.md 헤더 업데이트
      if (stats) {
        const readmeHeader = this.generateReadmeHeader(stats);
        updates.push({
          path: 'README.md',
          content: readmeHeader,
          type: 'readme'
        });
        console.log(`  ✓ README.md 헤더 업데이트`);
      }

      return {
        success: true,
        updates: updates
      };
    } catch (error) {
      console.error(`  ❌ 문서화 실패: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gogs에 자동 커밋
   */
  async commitDocumentation(owner, repo, updates) {
    console.log(`\n💾 Gogs 커밋: ${owner}/${repo}`);

    // 실제 구현에서는 Gogs API를 통해 커밋
    // 현재는 로컬 파일 시뮬레이션
    const lines = [];
    lines.push('docs: [AI Auto] 문서 자동 업데이트');
    lines.push('');
    lines.push('업데이트된 파일:');

    updates.forEach(update => {
      lines.push(`- ${update.path} (${update.type})`);
    });

    const message = lines.join('\n');

    console.log(`  ✓ 커밋 메시지: "${lines[0]}"`);
    console.log(`  ✓ 파일 수: ${updates.length}개`);

    return {
      success: true,
      message: message,
      files: updates.map(u => u.path)
    };
  }
}

export default DocUpdater;
