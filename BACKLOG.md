# Crypto Bot Feature Backlog

> **📅 Next Task:** Monitor SHORT block impact & gather LONG-only data
> 
> **🕐 Last Updated:** 19:47 (3 Feb 2026)

## 🔧 Backend (Trading Logic)
- [x] Add more indicators: MACD, Bollinger Bands
- [x] Trailing stop loss
- [x] Dynamic position sizing based on win rate
- [x] Multi-timeframe analysis (1m + 5m + 15m) ✅ Implemented v3!
- [x] Add SHORT positions (not just LONG)
- [x] Volatility-based TP/SL adjustment
- [x] **Drawdown protection (pause trading after X% loss)** ✅ 3% max, 60min pause
- [x] Time-based trading (avoid low volume hours)
- [x] Correlation with BTC (trade SOL based on BTC momentum)
- [x] Add more trading pairs (ETH, AVAX, etc.)
- [x] Implement martingale/anti-martingale sizing
- [x] **Dynamic leverage based on volatility** ✅ High vol → 5x, Normal → 10x, Low → 15x

## 🖥️ Frontend (Dashboard)
- [x] Alert bar showing changelog (recent bot updates/changes)
- [x] Backlog section showing pending/completed items
- [x] Real-time price chart with indicators
- [x] **Refactor chart to use TradingView lightweight-charts**
- [x] Trade history table with filters
- [x] Win rate by hour of day chart
- [x] Win rate by day of week chart
- [x] Profit/Loss curve over time
- [x] Current strategy parameters display
- [x] Manual trade execution buttons
- [x] Alert/notification settings
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive improvements
- [ ] Position size calculator widget
- [ ] Keyboard shortcuts (B=buy, S=sell, Esc=close modal)

## 📊 Sentiment Analysis
- [x] Crypto sentiment analysis for traded coins (news, social, Fear & Greed Index)
- [x] Integrate sentiment score into trading decisions
- [x] **Alert on extreme sentiment shifts** ✅ Monitor + pause on HIGH severity (3 Feb 2026)
- [x] Show Fear & Greed Index on dashboard
- [ ] Show SOL-specific sentiment (Twitter/X mentions)

## 🧠 Self-Learning
- [x] Auto-adjust RSI thresholds based on win rate
- [x] Learn best trading hours ✅ Hour optimizer implemented!
- [x] **Sync paper trades to self-learning skill for analysis** ✅ Auto-sync on optimization
- [x] **Auto-generate and update learned rules in MEMORY.md** ✅ update-rules.js
- [x] **Learn best leverage for current volatility** ✅ Dynamic leverage: high vol → 5x
- [x] **Pattern recognition from losing trades (deeper analysis)** ✅ Hard block: SHORT in sideways (3 Feb 2026)
- [ ] Weekly strategy evolution report

## ✅ Completed
- [x] Basic RSI + MA strategy
- [x] 10x leverage support
- [x] Paper trading engine
- [x] PM2 process management
- [x] Hourly optimization cron
- [x] Morning report cron
- [x] Total Equity calculation fix
- [x] Self-learning skill integration
