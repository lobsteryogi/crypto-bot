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
