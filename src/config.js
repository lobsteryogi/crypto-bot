// Configuration for the crypto trading bot
export const config = {
  // Trading pair
  symbol: 'SOL/USDT',
  symbols: ['SOL/USDT', 'ETH/USDT', 'AVAX/USDT'],
  
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
    maxOpenTrades: 10, // Total max positions (global)
    maxOpenTradesPerSymbol: 3, // Max positions per symbol
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
    
    // Martingale / Anti-Martingale Sizing
    martingale: {
      mode: 'anti-martingale', // 'martingale' | 'anti-martingale' | 'off'
      multiplier: 1.5,
      maxMultiplier: 3.0,
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

    // Leverage Adjustment based on Volatility
    leverageAdjustment: {
      minLeverage: 3,       // Minimum leverage in high volatility
      maxLeverage: 20,      // Maximum leverage in low volatility
      highVolThreshold: 1.5, // Volatility multiplier for "high" (reduce leverage)
      lowVolThreshold: 0.8,  // Volatility multiplier for "low" (can increase leverage)
    },
    
    // Drawdown protection - pause trading after X% loss
    drawdownProtection: {
      enabled: true,
      maxDrawdownPercent: 3, // Stop trading if down 3% from peak
      pauseDurationMinutes: 60, // Pause for 1 hour
      resetOnNewPeak: true, // Reset drawdown tracking when balance hits new high
    },
    
    // Time-based trading filter (avoid low volume hours)
    timeFilter: {
      enabled: true,
      blockedHours: [21, 22, 23, 0], // UTC hours to avoid (21:00-01:00)
      avoidWeekends: false, // optional
    },

    // Hour Optimization
    hourOptimization: {
      enabled: true,
      minTradesPerHour: 3,
      blockThreshold: 40, // Block hours with <40% win rate
      optimizeEvery: 5,   // Check every 5 trades
    },

    // BTC Correlation Filter
    btcCorrelation: {
      enabled: true,
      strictMode: false, // if true, only trade when BTC aligns perfectly
    },

    // RSI Optimization
    rsiOptimization: {
      enabled: true,
      minTrades: 15, // Reduced for faster feedback during dev
      optimizeEvery: 5, // Re-optimize frequently for testing
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
