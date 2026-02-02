// Main trading bot - fetches data, runs strategy, executes trades
import ccxt from 'ccxt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { Strategies } from './strategies.js';
import { PaperTrader } from './paper-trader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');

// Initialize exchange (Binance public API - no auth needed for price data)
const exchange = new ccxt.binance({ enableRateLimit: true });

// Initialize paper trader
const trader = new PaperTrader(config.paperTrading.initialBalance);

// Log function
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = path.join(logsDir, `trading_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Fetch OHLCV candles
async function fetchCandles(symbol, timeframe, limit = 100) {
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
    log(`Error fetching candles: ${error.message}`, 'error');
    return null;
  }
}

// Run one trading cycle
async function runTradingCycle() {
  log('='.repeat(60));
  log('🔄 Starting trading cycle...');
  
  // 1. Fetch latest candles
  const candles = await fetchCandles(config.symbol, config.timeframe);
  if (!candles || candles.length < 30) {
    log('Not enough candle data', 'warn');
    return;
  }
  
  const currentPrice = candles[candles.length - 1].close;
  log(`📊 ${config.symbol} Current Price: ${currentPrice.toFixed(2)} USDT`);
  
  // 2. Check stop loss / take profit for open positions
  const closedTrades = trader.checkPositions(
    currentPrice,
    config.trading.stopLossPercent,
    config.trading.takeProfitPercent
  );
  if (closedTrades.length > 0) {
    log(`📦 Closed ${closedTrades.length} position(s) via SL/TP`);
  }
  
  // 3. Get strategy signal
  const strategy = Strategies.getStrategy(config.strategy.name);
  const signal = strategy(candles, config.strategy.params);
  log(`📈 Strategy Signal: ${signal.signal.toUpperCase()} - ${signal.reason}`);
  
  // 4. Execute signal
  if (signal.signal === 'buy' && trader.positions.length < config.trading.maxOpenTrades) {
    const amount = config.trading.tradeAmount / currentPrice;
    trader.buy(config.symbol, currentPrice, amount, signal.reason);
  } else if (signal.signal === 'sell' && trader.positions.length > 0) {
    // Close oldest position
    const oldestPosition = trader.positions[0];
    trader.sell(oldestPosition.id, currentPrice, signal.reason);
  }
  
  // 5. Log stats
  const stats = trader.getStats();
  log(`💰 Balance: ${stats.balance} USDT | Win Rate: ${stats.winRate}% | Trades: ${stats.totalTrades} | P/L: ${stats.totalProfit} USDT`);
  
  // Save cycle log
  const cycleLog = {
    timestamp: new Date().toISOString(),
    price: currentPrice,
    signal,
    stats,
    openPositions: trader.positions.length,
  };
  
  const cycleLogFile = path.join(logsDir, 'cycles.jsonl');
  fs.appendFileSync(cycleLogFile, JSON.stringify(cycleLog) + '\n');
  
  return stats;
}

// Main loop
async function main() {
  log('🤖 Crypto Trading Bot Started!');
  log(`📊 Trading ${config.symbol} on ${config.timeframe} timeframe`);
  log(`💵 Paper Trading with ${config.paperTrading.initialBalance} USDT`);
  log(`🎯 Strategy: ${config.strategy.name} v${config.strategy.version}`);
  
  // Run immediately
  await runTradingCycle();
  
  // Then run every 5 minutes
  const intervalMs = 5 * 60 * 1000; // 5 minutes
  log(`⏰ Next cycle in 5 minutes...`);
  
  setInterval(async () => {
    try {
      await runTradingCycle();
    } catch (error) {
      log(`Cycle error: ${error.message}`, 'error');
    }
  }, intervalMs);
}

// Export for use as module
export { runTradingCycle, trader };

// Run if called directly
if (process.argv[1].includes('trader.js')) {
  main().catch(e => {
    log(`Fatal error: ${e.message}`, 'error');
    process.exit(1);
  });
}
