# Crypto Bot Feature Backlog

> **📅 Next Task:** Backlog updated — Drawdown protection completed!
> 
> **🕐 Last Updated:** 14:21

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
- [ ] Alert on extreme sentiment shifts
- [x] Show Fear & Greed Index on dashboard
- [ ] Show SOL-specific sentiment (Twitter/X mentions)

## 🧠 Self-Learning
- [x] Auto-adjust RSI thresholds based on win rate
- [ ] Learn best trading hours
- [ ] Learn best leverage for current volatility
- [ ] Pattern recognition from losing trades
- [ ] Weekly strategy evolution report
- [ ] Sync paper trades to self-learning skill for analysis

## ✅ Completed
- [x] Basic RSI + MA strategy
- [x] 10x leverage support
- [x] Paper trading engine
- [x] PM2 process management
- [x] Hourly optimization cron
- [x] Morning report cron
- [x] Total Equity calculation fix
- [x] Self-learning skill integration
