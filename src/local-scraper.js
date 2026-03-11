/**
 * 로컬 디렉토리 스캔 (API 없음)
 *
 * 역할:
 * - /home/kimjin/Desktop/kim/ 재귀 스캔
 * - Git 저장소 탐지
 * - 프로젝트 목록 생성
 *
 * 특징:
 * - API 권한 불필요
 * - 매우 빠름 (로컬 I/O)
 * - 277개 저장소 모두 커버 가능
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class LocalScraper {
  constructor(options = {}) {
    this.rootDir = options.rootDir || '/home/kimjin/Desktop/kim';
    this.maxDepth = options.maxDepth || 3;
    this.projects = [];
  }

  /**
   * 디렉토리 재귀 스캔 → Git 저장소 찾기
   */
  scan() {
    console.log(`📁 로컬 스캔 시작: ${this.rootDir}\n`);
    this.projects = [];
    this._scanDir(this.rootDir, 0);

    console.log(`\n✓ 총 ${this.projects.length}개 프로젝트 발견\n`);
    return this.projects;
  }

  _scanDir(dir, depth) {
    if (depth > this.maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // .git 폴더 발견 = Git 저장소
        if (entry.name === '.git' && entry.isDirectory()) {
          const projectPath = dir;
          const projectName = path.basename(projectPath);

          try {
            const info = this._getProjectInfo(projectPath);
            this.projects.push({
              name: projectName,
              path: projectPath,
              ...info
            });
            console.log(`  ✓ ${projectName}`);
          } catch (err) {
            console.log(`  ⚠ ${projectName}: ${err.message}`);
          }
          continue;
        }

        // 디렉토리면 재귀
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subPath = path.join(dir, entry.name);
          this._scanDir(subPath, depth + 1);
        }
      }
    } catch (err) {
      // 권한 없음 등의 에러는 무시
    }
  }

  /**
   * Git 저장소에서 정보 추출
   */
  _getProjectInfo(projectPath) {
    const info = {
      lastCommit: null,
      branch: 'unknown',
      isDirty: false,
      commitCount: 0
    };

    try {
      // 최근 커밋 시간
      const lastCommitTime = execSync(
        'git log -1 --format=%ai',
        { cwd: projectPath, encoding: 'utf-8' }
      ).trim();
      info.lastCommit = lastCommitTime;

      // 현재 브랜치
      const branch = execSync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: projectPath, encoding: 'utf-8' }
      ).trim();
      info.branch = branch;

      // 커밋 개수
      const count = execSync(
        'git rev-list --count HEAD',
        { cwd: projectPath, encoding: 'utf-8' }
      ).trim();
      info.commitCount = parseInt(count, 10);

      // 변경사항 있는지 확인
      const status = execSync(
        'git status --porcelain',
        { cwd: projectPath, encoding: 'utf-8' }
      ).trim();
      info.isDirty = status.length > 0;
    } catch (err) {
      // git 명령 실패는 무시
    }

    return info;
  }

  /**
   * 특정 프로젝트의 커밋 추출
   */
  getCommits(projectPath, limit = 50) {
    try {
      const format = '%h|%ae|%s|%ai|%B';
      const cmd = `git log -${limit} --pretty=format:"${format}%n---COMMIT_END---"`;
      const output = execSync(cmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      const commits = [];
      const commitBlocks = output.split('---COMMIT_END---').filter(b => b.trim());

      for (const block of commitBlocks) {
        const lines = block.trim().split('\n');
        if (lines.length === 0) continue;

        const [hash, email, subject, date, ...bodyLines] = lines;
        if (!hash) continue;

        commits.push({
          hash,
          email,
          subject,
          date,
          body: bodyLines.join('\n').trim()
        });
      }

      return commits;
    } catch (err) {
      return [];
    }
  }

  /**
   * 변경된 파일 목록
   */
  getChangedFiles(projectPath) {
    try {
      const cmd = 'git diff --name-only HEAD~1..HEAD';
      const output = execSync(cmd, {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      return output ? output.split('\n') : [];
    } catch (err) {
      return [];
    }
  }
}

// CLI 실행
if (process.argv[1].endsWith('local-scraper.js')) {
  const scraper = new LocalScraper();
  const projects = scraper.scan();

  // 상세 정보 출력
  console.log('\n📊 프로젝트 상세:');
  console.log('═'.repeat(60));

  for (const project of projects.slice(0, 5)) {
    console.log(`\n📦 ${project.name}`);
    console.log(`   경로: ${project.path}`);
    console.log(`   브랜치: ${project.branch}`);
    console.log(`   커밋: ${project.commitCount}개`);
    console.log(`   마지막: ${project.lastCommit}`);
    if (project.isDirty) {
      console.log(`   상태: 변경사항 있음 ⚠️`);
    }
  }

  if (projects.length > 5) {
    console.log(`\n... (그 외 ${projects.length - 5}개)`);
  }
}

export default LocalScraper;
