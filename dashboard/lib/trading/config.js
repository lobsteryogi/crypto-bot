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
  
  // Trading settings - YOLO MODE 🎰
  trading: {
    tradeAmount: 150, // USDT per trade (before leverage) - เพิ่มจาก 100
    leverage: 20, // 20x leverage - YOLO! 🚀
    maxOpenTrades: 15, // Total max positions (global) - เพิ่มจาก 10
    maxOpenTradesPerSymbol: 5, // Max positions per symbol - เพิ่มจาก 3
    stopLossPercent: 2.5, // Wider SL ให้มีที่หายใจ
    takeProfitPercent: 3.5, // Wider TP เก็บกำไรเยอะขึ้น
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

    // Leverage Adjustment based on Volatility - DISABLED for YOLO mode
    leverageAdjustment: {
      enabled: false, // ปิดไว้ ให้ใช้ leverage ตายตัว 20x
      minLeverage: 15,      // ต่ำสุด 15x
      maxLeverage: 25,      // สูงสุด 25x
      highVolThreshold: 2.0, // ต้อง vol สูงมากๆ ถึงจะลด
      lowVolThreshold: 0.5,  // vol ต่ำมากๆ ถึงจะเพิ่ม
    },
    
    // Drawdown protection - DISABLED for YOLO mode 
    drawdownProtection: {
      enabled: false, // ปิด! Let it ride 🎲
      maxDrawdownPercent: 10, // เพิ่มเป็น 10%
      pauseDurationMinutes: 30, // ลดเวลา pause
      resetOnNewPeak: true, // Reset drawdown tracking when balance hits new high
    },
    
    // Time-based trading filter - DISABLED for YOLO mode
    timeFilter: {
      enabled: false, // เทรดทุกเวลา!
      blockedHours: [], // ไม่ block ชม.ไหน
      avoidWeekends: false, // optional
    },

    // Hour Optimization - DISABLED for YOLO mode
    hourOptimization: {
      enabled: false, // เก็บ data ทุกชั่วโมง
      minTradesPerHour: 3,
      blockThreshold: 20, // ลด threshold ลง
      optimizeEvery: 10,   // Check ทุก 10 trades
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
      // 1m entry params - YOLO RSI (กว้างขึ้น เทรดบ่อยขึ้น)
      rsiPeriod: 14,
      rsiOversold: 40, // เพิ่มจาก 35 (ไม่ต้องรอ oversold มาก)
      rsiOverbought: 60, // ลดจาก 65 (ไม่ต้องรอ overbought มาก)
      // Require all 3 timeframes to align for entry
      requireAllTimeframes: false, // ปิด! ให้เทรดบ่อยขึ้น
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
  
  // Paths - relative to dashboard root
  paths: {
    trades: '../data/trades.json',
    performance: '../data/performance.json',
    strategyHistory: '../data/strategy_history.json',
  }
};
