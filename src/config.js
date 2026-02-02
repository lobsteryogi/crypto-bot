// Configuration for the crypto trading bot
export const config = {
  // Trading pair
  symbol: 'BTC/USDT',
  
  // Paper trading settings (simulated)
  paperTrading: {
    enabled: true,
    initialBalance: 10000, // USDT
    startPrice: null, // Will be fetched from market
  },
  
  // Trading settings
  trading: {
    tradeAmount: 100, // USDT per trade
    maxOpenTrades: 5,
    stopLossPercent: 2,
    takeProfitPercent: 3,
  },
  
  // Strategy settings
  strategy: {
    name: 'rsi_ma_crossover',
    version: 1,
    params: {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      maFastPeriod: 9,
      maSlowPeriod: 21,
    }
  },
  
  // Timeframe
  timeframe: '5m',
  
  // Paths
  paths: {
    trades: './data/trades.json',
    performance: './data/performance.json',
    strategyHistory: './data/strategy_history.json',
  }
};
