// Configuration for the crypto trading bot
export const config = {
  // Trading pair
  symbol: 'SOL/USDT',
  
  // Paper trading settings (simulated)
  paperTrading: {
    enabled: true,
    initialBalance: 10000, // USDT
    startPrice: null, // Will be fetched from market
  },
  
  // Trading settings
  trading: {
    tradeAmount: 100, // USDT per trade (before leverage)
    leverage: 10, // 10x leverage
    maxOpenTrades: 10, // More positions
    stopLossPercent: 1.5, // Tighter SL with leverage
    takeProfitPercent: 2, // Tighter TP with leverage
    trailingStop: {
      enabled: true,
      activationPercent: 1.0, // Activate trailing stop when profit >= 1%
      trailingPercent: 0.5, // Trail 0.5% below highest price
    },
    // Dynamic position sizing based on win rate
    positionSizing: {
      minMultiplier: 0.25,    // Min 25% of base size when losing
      maxMultiplier: 2.0,     // Max 200% of base size when winning
      baseWinRate: 50,        // Win rate for 1x multiplier
      minTrades: 10,          // Minimum trades before adjusting
      winRateWeight: 0.7,     // How much win rate affects sizing
      streakWeight: 0.3,      // How much recent performance affects sizing
    },
  },
  
  // Strategy settings - more aggressive for frequent trades
  strategy: {
    name: 'rsi_ma_crossover',
    version: 2,
    params: {
      rsiPeriod: 14,
      rsiOversold: 40, // Less strict (was 30)
      rsiOverbought: 60, // Less strict (was 70)
      maFastPeriod: 5, // Faster MA (was 9)
      maSlowPeriod: 13, // Faster MA (was 21)
    }
  },
  
  // Timeframe - shorter for more signals
  timeframe: '1m', // Changed from 5m to 1m
  
  // Paths
  paths: {
    trades: './data/trades.json',
    performance: './data/performance.json',
    strategyHistory: './data/strategy_history.json',
  }
};
