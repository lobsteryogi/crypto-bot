#!/bin/bash
# Example: Quick config management scripts

# View current risk settings
echo "=== Current Risk Settings ==="
node src/config-cli.js get trading.leverage
node src/config-cli.js get trading.stopLossPercent
node src/config-cli.js get trading.takeProfitPercent
node src/config-cli.js get trading.maxOpenTrades
echo ""

# Conservative mode
echo "=== Switch to Conservative Mode ==="
echo "Setting: Leverage 10x, SL 1.5%, TP 2.5%, Max 5 positions"
node src/config-cli.js set trading.leverage 10
node src/config-cli.js set trading.stopLossPercent 1.5
node src/config-cli.js set trading.takeProfitPercent 2.5
node src/config-cli.js set trading.maxOpenTrades 5
echo "✅ Conservative mode activated"
echo ""

# Aggressive mode (YOLO)
# echo "=== Switch to Aggressive Mode (YOLO) ==="
# echo "Setting: Leverage 25x, SL 3.5%, TP 5.0%, Max 20 positions"
# node src/config-cli.js set trading.leverage 25
# node src/config-cli.js set trading.stopLossPercent 3.5
# node src/config-cli.js set trading.takeProfitPercent 5.0
# node src/config-cli.js set trading.maxOpenTrades 20
# echo "✅ YOLO mode activated 🚀"
# echo ""

# View changes
echo "=== Recent Changes ==="
node src/config-cli.js history "" 10
