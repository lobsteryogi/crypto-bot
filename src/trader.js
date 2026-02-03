// Main trading bot - fetches data, runs strategy, executes trades
import ccxt from 'ccxt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { Strategies } from './strategies.js';
import { PaperTrader } from './paper-trader.js';
import { getSentiment } from './sentiment.js';
import { PositionSizer } from './position-sizer.js';
import { MartingaleSizer } from './martingale-sizer.js';
import { Indicators } from './indicators.js';
import { VolatilityAdjuster } from './volatility-adjuster.js';
import { isTradeableHour, isWeekend } from './time-filter.js';
import { getBtcMomentum, shouldTradeBasedOnBtc } from './btc-correlation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');

// Initialize exchange (Binance public API - no auth needed for price data)
const exchange = new ccxt.binance({ enableRateLimit: true });

// Initialize paper trader
const trader = new PaperTrader(config.paperTrading.initialBalance, config.rsiOptimization);

// Initialize Martingale Sizer and sync state
const martingaleSizer = new MartingaleSizer(config.martingale);
martingaleSizer.setStreak(trader.getMartingaleStreak());

// Helper to handle trade results
function processClosedTrade(trade) {
  if (!trade) return;
  const win = trade.profit > 0;
  const newStreak = martingaleSizer.recordResult(win);
  trader.setMartingaleStreak(newStreak);
}

// Log function
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = path.join(logsDir, `trading_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Fetch OHLCV candles for single timeframe
async function fetchCandles(symbol, timeframe, limit = 200) {
  try {
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return ohlcv.map(c => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));
  } catch (error) {
    log(`Error fetching candles for ${symbol}: ${error.message}`, 'error');
    return null;
  }
}

// Fetch candles for multiple timeframes (for multi-timeframe analysis)
async function fetchMultiTimeframeCandles(symbol, timeframes = ['1m', '5m', '15m'], limits = { '1m': 200, '5m': 60, '15m': 60 }) {
  const results = {};
  
  for (const tf of timeframes) {
    const limit = limits[tf] || 200;
    const candles = await fetchCandles(symbol, tf, limit);
    if (!candles) {
      log(`Failed to fetch ${tf} candles for ${symbol}`, 'warn');
      return null;
    }
    results[tf] = candles;
  }
  
  return results;
}

// Run one trading cycle for a specific symbol
async function runTradingCycle(symbol) {
  // Use symbol specific logging prefix if possible, or just include in message
  const logPrefix = `[${symbol}]`;
  
  log(`${logPrefix} 🔄 Starting analysis...`);
  
  // 1. Fetch candles (single or multi-timeframe based on strategy)
  const isMultiTF = Strategies.isMultiTimeframe(config.strategy.name);
  let candles;
  let multiCandles;
  let currentPrice;
  
  if (isMultiTF) {
    // Multi-timeframe strategy: fetch 1m, 5m, 15m
    multiCandles = await fetchMultiTimeframeCandles(symbol);
    if (!multiCandles) {
      log(`${logPrefix} Failed to fetch multi-timeframe data`, 'warn');
      return;
    }
    candles = multiCandles['1m']; // Use 1m for price and position management
    currentPrice = candles[candles.length - 1].close;
  } else {
    // Single timeframe strategy
    candles = await fetchCandles(symbol, config.timeframe);
    if (!candles || candles.length < 30) {
      log(`${logPrefix} Not enough candle data`, 'warn');
      return;
    }
    currentPrice = candles[candles.length - 1].close;
  }
  
  log(`${logPrefix} 📊 Current Price: ${currentPrice.toFixed(2)} USDT`);

  // 1.2 Fetch BTC Momentum (Global metric, but we log it per symbol context)
  let btcMomentum = 'neutral';
  if (config.trading.btcCorrelation && config.trading.btcCorrelation.enabled) {
    btcMomentum = await getBtcMomentum(exchange);
    // log(`${logPrefix} 🔗 BTC Momentum: ${btcMomentum}`); // Reduce noise, maybe log only if blocking
  }
  
  // 1.5. Calculate Volatility Adjustment
  let currentSlPercent = config.trading.stopLossPercent;
  let currentTpPercent = config.trading.takeProfitPercent;
  let volatilityInfo = null;

  if (config.trading.volatilityAdjustment?.enabled && candles && candles.length > 0) {
    const vaConfig = config.trading.volatilityAdjustment;
    // Calculate ATR
    const atrSeries = Indicators.atr(candles, vaConfig.atrPeriod);
    
    if (atrSeries.length > 0) {
      const currentATR = atrSeries[atrSeries.length - 1];
      
      if (currentATR !== null && !isNaN(currentATR)) {
        // Calculate Average ATR (Baseline)
        const avgPeriod = vaConfig.avgAtrPeriod || 100;
        const history = atrSeries.slice(-avgPeriod).filter(v => v !== null); 
        const averageATR = history.reduce((sum, val) => sum + val, 0) / history.length;

        // Calculate Multiplier
        const multiplier = VolatilityAdjuster.calculateMultiplier(currentATR, averageATR);
        
        // Adjust TP/SL
        currentSlPercent = VolatilityAdjuster.adjustedStopLoss(
          config.trading.stopLossPercent,
          multiplier,
          vaConfig.minSlPercent,
          vaConfig.maxSlPercent
        );
        
        currentTpPercent = VolatilityAdjuster.adjustedTakeProfit(
          config.trading.takeProfitPercent,
          multiplier,
          vaConfig.minTpPercent,
          vaConfig.maxTpPercent
        );

        volatilityInfo = {
          currentATR: currentATR.toFixed(4),
          averageATR: averageATR.toFixed(4),
          multiplier: multiplier.toFixed(2)
        };

        log(`${logPrefix} 📉 Volatility: ATR=${currentATR.toFixed(4)} (Multiplier: ${multiplier.toFixed(2)}x) → SL=${currentSlPercent.toFixed(2)}%, TP=${currentTpPercent.toFixed(2)}%`);
      }
    }
  }

  // 2. Check stop loss / take profit / trailing stop for open positions of this symbol
  // Note: checkPositions updated to accept symbol
  const closedTrades = trader.checkPositions(
    symbol,
    currentPrice,
    currentSlPercent,
    currentTpPercent,
    config.trading.trailingStop
  );
  if (closedTrades.length > 0) {
    log(`${logPrefix} 📦 Closed ${closedTrades.length} position(s) via SL/TP/Trailing`);
    // Process results for Martingale
    for (const trade of closedTrades) {
      processClosedTrade(trade);
    }
  }
  
  // 2.5. Check drawdown protection (Global check, but pauses everything)
  const drawdownStatus = trader.checkDrawdownProtection(config.trading.drawdownProtection);
  if (drawdownStatus.triggered) {
    log(`🚨 DRAWDOWN PROTECTION: Trading paused for ${drawdownStatus.pauseDurationMinutes} minutes`);
    return; // Stop processing
  } else if (drawdownStatus.paused) {
    log(`⏸️ Trading paused (${drawdownStatus.remainingMinutes} minutes remaining)`);
    return; // Stop processing
  }
  
  // 2.6. Get current stats for position sizing
  const stats = trader.getStats();
  
  // 3. Get strategy signal
  const strategy = Strategies.getStrategy(config.strategy.name);
  let signal;

  // Apply RSI Optimization if available
  let strategyParams = { ...config.strategy.params };
  if (trader.getOptimizedParams) {
      const optimizedParams = trader.getOptimizedParams();
      if (optimizedParams) {
          if (optimizedParams.oversold) strategyParams.rsiOversold = optimizedParams.oversold;
          if (optimizedParams.overbought) strategyParams.rsiOverbought = optimizedParams.overbought;
      }
  }
  
  if (isMultiTF) {
    signal = strategy(multiCandles, strategyParams);
  } else {
    signal = strategy(candles, strategyParams);
  }
  
  log(`${logPrefix} 📈 Signal: ${signal.signal.toUpperCase()} - ${signal.reason}`);
  
  // 3.5. Apply sentiment analysis adjustment
  let sentiment = null;
  try {
    sentiment = await getSentiment(symbol);
    // Only log if significant or changed
    // log(`${logPrefix} 🧠 Sentiment: ${sentiment.classification} (${sentiment.score})`);
    
    const originalSignal = signal.signal;
    signal = Strategies.applySentimentAdjustment(signal, sentiment);
    
    if (signal.signal !== originalSignal) {
      log(`${logPrefix} ⚠️ Signal changed from ${originalSignal.toUpperCase()} to ${signal.signal.toUpperCase()} due to sentiment`);
    }
  } catch (sentimentError) {
    // Silent fail or debug log
  }

  // Check Time Filter
  const now = new Date();
  const isAllowedTime = isTradeableHour(now, config.trading);
  const isAllowedDay = !isWeekend(now, config.trading);
  const isTimeRestricted = !isAllowedTime || !isAllowedDay;

  if (isTimeRestricted) {
    log(`${logPrefix} ⏰ Trading restricted (low volume hour)`);
  }

  // Check BTC Correlation
  const btcCheck = shouldTradeBasedOnBtc(btcMomentum, signal.signal);
  if (!btcCheck.allowed && (signal.signal === 'buy' || signal.signal === 'short')) {
     log(`${logPrefix} ⛔ BTC Correlation Block: ${btcCheck.reason}`);
  }
  const isBtcAllowed = btcCheck.allowed;
  
  // 4. Execute signal
  const leverage = config.trading.leverage || 1;
  const indicators = signal.indicators || {};
  
  // Filter positions for this symbol
  const symbolPositions = trader.positions.filter(p => p.symbol === symbol);
  const openPositionsCount = symbolPositions.length;
  const maxPositions = config.trading.maxOpenTradesPerSymbol || 1;

  // Handle signal direction changes (reversals)
  if (signal.signal === 'buy') {
    const shortPositions = symbolPositions.filter(p => p.type === 'short');
    if (shortPositions.length > 0) {
      log(`${logPrefix} 🔄 Switching direction: Closing ${shortPositions.length} SHORT position(s)`);
      for (const p of shortPositions) {
        const result = trader.sell(p.id, currentPrice, `Switch to LONG: ${signal.reason}`, indicators);
        if (result.success) processClosedTrade(result.trade);
      }
    }
  }
  
  if (signal.signal === 'short') {
    const longPositions = symbolPositions.filter(p => !p.type || p.type === 'long');
    if (longPositions.length > 0) {
      log(`${logPrefix} 🔄 Switching direction: Closing ${longPositions.length} LONG position(s)`);
      for (const p of longPositions) {
        const result = trader.sell(p.id, currentPrice, `Switch to SHORT: ${signal.reason}`, indicators);
        if (result.success) processClosedTrade(result.trade);
      }
    }
  }

  // Execute Entry
  if (!isTimeRestricted && isBtcAllowed && signal.signal === 'buy' && openPositionsCount < maxPositions) {
    // Calculate dynamic position size based on win rate
    const sizing = PositionSizer.getPositionSize(config.trading.tradeAmount, stats, config.trading.positionSizing);
    
    // Apply Martingale Sizing
    const mResult = martingaleSizer.getPositionSize(sizing.amount);
    const finalAmount = mResult.size;
    const mStreak = mResult.streak;
    const mMult = mResult.multiplier;
    
    // Log: "📈 Anti-Martingale: 2 win streak → 2.25x size"
    if (config.martingale.mode !== 'off' && mStreak > 0) {
       const modeLabel = config.martingale.mode === 'anti-martingale' ? 'Anti-Martingale' : 'Martingale';
       const resultType = config.martingale.mode === 'anti-martingale' ? 'win' : 'loss';
       log(`📈 ${modeLabel}: ${mStreak} ${resultType} streak → ${mMult.toFixed(2)}x size`);
    }

    log(`${logPrefix} 📏 Sizing: ${sizing.multiplier}x (WinRate) * ${mMult.toFixed(2)}x (Martingale) = ${(sizing.multiplier * mMult).toFixed(2)}x Total`);
    
    const effectiveAmount = (finalAmount * leverage) / currentPrice;
    trader.buy(symbol, currentPrice, effectiveAmount, signal.reason, leverage);
  } 
  else if (!isTimeRestricted && isBtcAllowed && signal.signal === 'short' && openPositionsCount < maxPositions) {
    const sizing = PositionSizer.getPositionSize(config.trading.tradeAmount, stats, config.trading.positionSizing);
    
    // Apply Martingale Sizing
    const mResult = martingaleSizer.getPositionSize(sizing.amount);
    const finalAmount = mResult.size;
    const mStreak = mResult.streak;
    const mMult = mResult.multiplier;

    // Log: "📈 Anti-Martingale: 2 win streak → 2.25x size"
    if (config.martingale.mode !== 'off' && mStreak > 0) {
       const modeLabel = config.martingale.mode === 'anti-martingale' ? 'Anti-Martingale' : 'Martingale';
       const resultType = config.martingale.mode === 'anti-martingale' ? 'win' : 'loss';
       log(`📈 ${modeLabel}: ${mStreak} ${resultType} streak → ${mMult.toFixed(2)}x size`);
    }

    log(`${logPrefix} 📏 Sizing: ${sizing.multiplier}x (WinRate) * ${mMult.toFixed(2)}x (Martingale) = ${(sizing.multiplier * mMult).toFixed(2)}x Total`);
    
    const effectiveAmount = (finalAmount * leverage) / currentPrice;
    trader.short(symbol, currentPrice, effectiveAmount, signal.reason, leverage);
  }
  
  // Log minimal stats per cycle
  // log(`${logPrefix} Cycle complete.`);
  
  // Save cycle log
  const cycleLog = {
    timestamp: new Date().toISOString(),
    symbol,
    price: currentPrice,
    signal,
    sentiment: sentiment ? { score: sentiment.score } : null,
    stats: trader.getStats(),
  };
  
  const cycleLogFile = path.join(logsDir, 'cycles.jsonl');
  fs.appendFileSync(cycleLogFile, JSON.stringify(cycleLog) + '\n');
}

// Main loop
async function main() {
  const symbols = config.symbols || [config.symbol];
  
  log('🤖 Crypto Trading Bot Started!');
  log(`📊 Trading Pairs: ${symbols.join(', ')}`);
  log(`🎯 Strategy: ${config.strategy.name}`);
  
  const runAll = async () => {
    log('='.repeat(60));
    for (const symbol of symbols) {
      try {
        await runTradingCycle(symbol);
      } catch (e) {
        log(`Error running cycle for ${symbol}: ${e.message}`, 'error');
      }
    }
    const stats = trader.getStats();
    log(`💰 Global Stats: Balance ${stats.balance} | P/L ${stats.totalProfit} | Open Pos: ${stats.openPositions}`);
  };

  // Run immediately
  await runAll();
  
  // Then run every 1 minute
  const intervalMs = 60 * 1000;
  log(`⏰ Next cycle in 1 minute...`);
  
  setInterval(runAll, intervalMs);
}

export { runTradingCycle, trader };

if (process.argv[1]?.includes('trader.js')) {
  main().catch(e => {
    log(`Fatal error: ${e.message}`, 'error');
    process.exit(1);
  });
}
