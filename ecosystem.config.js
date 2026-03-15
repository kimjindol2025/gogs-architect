/**
 * PM2 Ecosystem Configuration
 * 프로덕션 배포 설정
 */

module.exports = {
  apps: [
    {
      name: 'gogs-architect-api',
      script: './src/api-server-v3.js',
      instances: 'max', // CPU 코어 수만큼 프로세스 실행
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        LOG_LEVEL: 'debug'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // 자동 재시작
      watch: false, // 파일 변경 감시 (프로덕션에서는 false)
      ignore_watch: ['node_modules', 'logs', 'data'],
      max_restarts: 10,
      min_uptime: '10s',

      // 메모리 관리
      max_memory_restart: '512M',

      // Graceful shutdown
      kill_timeout: 5000, // 5초 후 강제 종료
      wait_ready: true,

      // 환경 변수
      instance_var: 'INSTANCE_ID'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['253.49.254.93'], // 253 서버
      port: 22,
      key: '/home/deploy/.ssh/id_rsa',
      ref: 'origin/master',
      repo: 'https://github.com/anthropics/gogs-architect.git',
      path: '/opt/gogs-architect',
      'post-deploy': 'npm install && npm run build && pm2 restart ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."',
      'ssh_options': [
        'StrictHostKeyChecking=no',
        'PasswordAuthentication=no'
      ]
    },
    staging: {
      user: 'deploy',
      host: ['staging.example.com'],
      port: 22,
      ref: 'origin/develop',
      repo: 'https://github.com/anthropics/gogs-architect.git',
      path: '/opt/gogs-architect-staging',
      'post-deploy': 'npm install && pm2 restart ecosystem.config.js --env staging'
    }
  },

  // 모니터링 설정
  monitoring: {
    enabled: true,
    memory_limit: 512,
    cpu_limit: 90
  }
};
