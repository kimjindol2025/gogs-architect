/**
 * 로컬 파일시스템 스캔 (Gogs 대신 로컬 서버 전체 스캔)
 *
 * 역할:
 * - /home/kimjin/Desktop/kim/ 전체 재귀 탐색
 * - 코드 파일 수집 (.free, .fl, .py, .ts, .js, .c, .h, .md 등)
 * - 파일 메타데이터 수집 (수정 시간, 크기 등)
 * - 커밋 대신 파일 시간 추적
 */

import fs from 'fs';
import path from 'path';

class LocalScanner {
  constructor(options = {}) {
    this.rootPath = options.rootPath || '/home/kimjin/Desktop/kim';
    this.extensions = options.extensions || [
      '.free', '.fl', '.mojo', '.py', '.ts', '.js',
      '.c', '.h', '.cpp', '.cc', '.go', '.rs',
      '.md', '.txt', '.json', '.yaml', '.yml'
    ];
    this.excludeDirs = new Set([
      'node_modules', '.git', 'dist', 'build', '.next',
      '__pycache__', '.pytest_cache', '.venv', 'venv',
      'target', '.cargo',
      // 대용량 프로젝트 제외
      '08_Archive_Backup', 'FREELANG_Projects',
      '02_Infrastructure', '04_In_Progress_Projects'
    ]);
    // 스캔할 최대 파일 수 (메모리 절약)
    this.maxFiles = options.maxFiles || 50000;
  }

  /**
   * 파일 확장자 확인
   */
  shouldIncludeFile(filePath) {
    return this.extensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * 디렉토리 제외 확인
   */
  shouldExcludeDir(dirName) {
    return this.excludeDirs.has(dirName);
  }

  /**
   * 재귀적으로 파일 탐색
   */
  scanDirectory(dirPath, results = []) {
    // 최대 파일 수 도달 시 스캔 중지
    if (results.length >= this.maxFiles) {
      return results;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      entries.forEach(entry => {
        // 중지 조건 확인
        if (results.length >= this.maxFiles) {
          return;
        }

        const fullPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            if (!this.shouldExcludeDir(entry.name)) {
              this.scanDirectory(fullPath, results);
            }
          } else if (entry.isFile() && this.shouldIncludeFile(entry.name)) {
            const stat = fs.statSync(fullPath);
            const relativePath = path.relative(this.rootPath, fullPath);

            results.push({
              path: relativePath,
              fullPath: fullPath,
              name: entry.name,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              extension: path.extname(entry.name)
            });
          }
        } catch (e) {
          // 개별 파일 처리 오류 무시
        }
      });
    } catch (e) {
      // 디렉토리 스캔 오류 무시
    }

    return results;
  }

  /**
   * 전체 서버 스캔
   */
  scanAll() {
    console.log(`\n📁 서버 스캔 시작: ${this.rootPath}\n`);
    const startTime = Date.now();

    const files = this.scanDirectory(this.rootPath);

    const elapsed = Date.now() - startTime;
    console.log(`✓ 완료: ${files.length}개 파일 (${(elapsed / 1000).toFixed(1)}초)\n`);

    return files;
  }

  /**
   * 파일 내용 읽기 (크기 제한)
   */
  readFile(filePath, maxSize = 1000000) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > maxSize) {
        return `[파일이 너무 큼: ${(stat.size / 1024 / 1024).toFixed(1)}MB]`;
      }
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      return `[읽기 오류: ${e.message}]`;
    }
  }

  /**
   * 파일 타입별 분류
   */
  groupByExtension(files) {
    const groups = {};

    files.forEach(file => {
      const ext = file.extension || 'unknown';
      if (!groups[ext]) {
        groups[ext] = [];
      }
      groups[ext].push(file);
    });

    return groups;
  }

  /**
   * 통계
   */
  getStatistics(files) {
    const groups = this.groupByExtension(files);
    const languages = {
      '.free': 'freelang',
      '.fl': 'freelang',
      '.py': 'python',
      '.ts': 'typescript',
      '.js': 'javascript',
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };

    const languageCount = {};
    Object.entries(groups).forEach(([ext, items]) => {
      const lang = languages[ext] || 'other';
      languageCount[lang] = (languageCount[lang] || 0) + items.length;
    });

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      totalFiles: files.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
      byExtension: Object.entries(groups).map(([ext, items]) => ({
        extension: ext,
        count: items.length,
        size: items.reduce((sum, f) => sum + f.size, 0)
      })),
      byLanguage: languageCount
    };
  }
}

export default LocalScanner;
