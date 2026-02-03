module.exports = {
  apps: [{
    name: 'crypto-dashboard',
    cwd: '/root/.openclaw/workspace/crypto-bot/dashboard',
    script: '/root/.bun/bin/bun',
    args: 'run start',
    env: {
      NODE_ENV: 'production',
      PORT: 3456
    },
    // Auto-start trading after server is ready
    post_start: 'sleep 5 && curl -s -X POST http://localhost:3456/api/trading/start'
  }]
};
