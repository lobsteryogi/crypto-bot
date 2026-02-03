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
    
    // Volatility-based TP/SL Adjustment
    volatilityAdjustment: {
      enabled: true,
      atrPeriod: 14,
      avgAtrPeriod: 100, // Period to calculate "average" volatility (baseline)
      minSlPercent: 0.5,
      maxSlPercent: 3.0,
      minTpPercent: 1.0,
      maxTpPercent: 5.0,
    },
    
    // Drawdown protection - pause trading after X% loss
    drawdownProtection: {
      enabled: true,
      maxDrawdownPercent: 3, // Stop trading if down 3% from peak
      pauseDurationMinutes: 60, // Pause for 1 hour
      resetOnNewPeak: true, // Reset drawdown tracking when balance hits new high
    },
  },
  
  // Strategy settings - multi-timeframe analysis
  strategy: {
    name: 'multi_timeframe',  // Changed from rsi_ma_crossover
    version: 3,
    params: {
      // 15m trend params
      trendFastPeriod: 20,
      trendSlowPeriod: 50,
      // 5m momentum params
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      // 1m entry params
      rsiPeriod: 14,
      rsiOversold: 35,
      rsiOverbought: 65,
      // Require all 3 timeframes to align for entry
      requireAllTimeframes: true,
    }
  },
  
  // Available strategies reference:
  // - rsi_ma_crossover: RSI + MA crossover (original)
  // - simple_rsi: RSI only
  // - macd: MACD crossover
  // - bollinger_bands: Bollinger band touches
  // - multi_indicator: RSI + MACD + BB confluence
  // - multi_timeframe: 15m trend + 5m momentum + 1m entry (NEW)
  
  // Timeframe - used by single-TF strategies (multi_timeframe uses 1m/5m/15m)
  timeframe: '1m',
  
  // Paths
  paths: {
    trades: './data/trades.json',
    performance: './data/performance.json',
    strategyHistory: './data/strategy_history.json',
  }
};
