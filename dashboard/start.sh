#!/bin/bash
# Startup script for crypto-dashboard with auto trading start

cd /root/.openclaw/workspace/crypto-bot/dashboard

# Start Next.js server
/root/.bun/bin/bun run start &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
sleep 5

# Auto-start trading loop
echo "Starting trading loop..."
curl -s -X POST http://localhost:3456/api/trading/start

# Keep the script running (so pm2 doesn't restart)
wait $SERVER_PID
