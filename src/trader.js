// Main trading bot orchestrator
import { config } from './config.js';
import { log } from './utils/logger.js';
import { exchangeService } from './services/exchange-service.js';
import { TradingEngine } from './core/trading-engine.js';
import { PositionManager } from './core/position-manager.js';
import { PaperTrader } from './paper-trader-sqlite.js';
import { MartingaleSizer } from './martingale-sizer.js';
import { Strategies } from './strategies.js';
import { getBtcMomentum, shouldTradeBasedOnBtc } from './btc-correlation.js';
import { isTradeableHour, isWeekend } from './time-filter.js';
import { shouldTrade } from './risk-filter.js';

// Initialize Core Components
const trader = new PaperTrader(
  config.paperTrading.initialBalance,
  config.trading.rsiOptimization,
  config.trading.hourOptimization
);

const martingaleSizer = new MartingaleSizer(config.trading.martingale);
martingaleSizer.setStreak(trader.getMartingaleStreak());

const pm = new PositionManager(trader, martingaleSizer);
const engine = new TradingEngine(pm);

async function runTradingCycle(symbol) {
  log(`🔄 Starting analysis for ${symbol}...`, 'info', symbol);

  // 1. Fetch Data
  const isMultiTF = Strategies.isMultiTimeframe(config.strategy.name);
  let candles, multiCandles = null;

  if (isMultiTF) {
    multiCandles = await exchangeService.fetchMultiTimeframe(symbol);
    if (!multiCandles) return;
    candles = multiCandles['1m'];
  } else {
    candles = await exchangeService.fetchCandles(symbol, config.timeframe);
    if (!candles || candles.length < 30) return;
  }

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;
  const highPrice = lastCandle.high;
  const lowPrice = lastCandle.low;

  // 2. Manage Existing Positions (SL/TP)
  const adj = engine.getVolatilityAdjustments(candles);
  const closed = pm.checkExistingPositions(symbol, currentPrice, highPrice, lowPrice);
  if (closed.length > 0) log(`📦 Closed ${closed.length} position(s)`, 'info', symbol);

  // 3. Global Filters (BTC, Time, Drawdown)
  const btcMomentum = config.trading.btcCorrelation?.enabled ? await getBtcMomentum(exchangeService.exchange) : 'neutral';
  if (trader.checkDrawdownProtection(config.trading.drawdownProtection).paused) return;
  
  const now = new Date();
  const effectiveBlocked = trader.getEffectiveBlockedHours(config.trading.timeFilter?.blockedHours || []);
  if (!isTradeableHour(now, config.trading, effectiveBlocked) || isWeekend(now, config.trading)) return;

  // 4. Decision Engine
  const analysis = await engine.analyze(symbol, candles, multiCandles);
  log(`📈 Signal: ${analysis.signal.toUpperCase()} - ${analysis.reason}`, 'info', symbol);

  if (analysis.signal === 'hold') return;

  // 5. Check Cooldown (after SL hit)
  if (pm.isInCooldown(symbol)) {
    const remaining = Math.ceil(pm.getCooldownRemaining(symbol) / 60000);
    log(`⏸️ Skipping entry - ${symbol} in cooldown (${remaining}m remaining)`, 'info', symbol);
    return;
  }

  // 6. Direction Switch (Reversals)
  handleReversals(symbol, analysis.signal, currentPrice, analysis.reason);

  // 7. Entry Execution
  const btcCheck = shouldTradeBasedOnBtc(btcMomentum, analysis.signal);
  if (!btcCheck.allowed) return;

  const symbolPositions = trader.positions.filter(p => p.symbol === symbol);
  if (symbolPositions.length < (config.trading.maxOpenTradesPerSymbol || 1)) {
    executeEntry(symbol, analysis, currentPrice);
  }
}

function handleReversals(symbol, signal, price, reason) {
  const symbolPositions = trader.positions.filter(p => p.symbol === symbol);
  const toClose = signal === 'buy' 
    ? symbolPositions.filter(p => p.type === 'short')
    : (signal === 'short' ? symbolPositions.filter(p => p.type === 'long' || !p.type) : []);

  for (const p of toClose) {
    log(`🔄 Switching direction: Closing ${p.type} position`, 'info', symbol);
    const result = trader.sell(p.id, price, `Reversal to ${signal}: ${reason}`);
    if (result.success) pm.processTradeResult(result.trade);
  }
}

function executeEntry(symbol, analysis, price) {
  const riskCheck = shouldTrade({
    trend: analysis.indicators?.trend_5m || 'sideways',
    volatility: analysis.indicators?.volatility || 'normal',
    side: analysis.signal === 'buy' ? 'LONG' : 'SHORT',
    rsi: analysis.indicators?.rsi_1m
  });

  if (!riskCheck.allowed) {
    log(`⛔ RISK FILTER: ${riskCheck.reason}`, 'warn', symbol);
    return;
  }

  const order = pm.calculateOrderSize(trader.getStats());
  
  // Side-specific leverage adjustment (learned from loss patterns)
  // LONG positions lose ~3x more per losing trade (12.64 vs 4.72 USDT)
  let leverage = analysis.adjustments.leverage;
  if (analysis.signal === 'buy') {
    leverage = Math.max(3, Math.round(leverage * 0.7)); // Reduce LONG leverage by 30%
  }
  
  const effectiveAmount = (order.amount * leverage) / price;

  if (analysis.signal === 'buy') {
    trader.buy(symbol, price, effectiveAmount, analysis.reason, leverage);
  } else {
    trader.short(symbol, price, effectiveAmount, analysis.reason, leverage);
  }
}

async function main() {
  const symbols = config.symbols || [config.symbol];
  log('🤖 Crypto Trading Bot (Refactored) Started!', 'info');
  
  const runAll = async () => {
    for (const symbol of symbols) {
      try { await runTradingCycle(symbol); } catch (e) { log(`Error: ${e.message}`, 'error', symbol); }
    }
  };

  await runAll();
  setInterval(runAll, 60000);
}

main().catch(console.error);
export { trader };
