// Paper trading engine - SQLite version
import { TradeDB } from './db.js';

export class PaperTrader {
  constructor(initialBalance = 10000, rsiConfig = {}, hourOptConfig = {}) {
    this.initialBalance = initialBalance;
    this.rsiOptConfig = rsiConfig;
    this.hourOptConfig = hourOptConfig;
    
    // Trading state from DB
    this.tradingPaused = false;
    this.pausedUntil = null;
    
    // Load state
    this.loadState();
  }

  loadState() {
    const balance = TradeDB.getBalance();
    const positions = TradeDB.getPositions();
    const rsiParams = TradeDB.getRsiParams();
    const blockedHours = TradeDB.getBlockedHours();
    
    console.log(`📂 Loaded state: Balance ${balance.toFixed(2)} USDT, ${positions.length} open positions`);
    
    if (rsiParams.oversold !== 35 || rsiParams.overbought !== 65) {
      console.log(`🎯 Loaded optimized RSI params: Oversold ${rsiParams.oversold}, Overbought ${rsiParams.overbought}`);
    }
    
    if (blockedHours.length > 0) {
      console.log(`⏰ Loaded learned blocked hours: ${blockedHours.join(', ')} UTC`);
    }
  }

  // Getters
  get balance() {
    return TradeDB.getBalance();
  }

  getPositions(symbol = null) {
    if (symbol) {
      return TradeDB.getPositionsBySymbol(symbol);
    }
    return TradeDB.getPositions();
  }

  getOpenPositionCount(symbol = null) {
    return this.getPositions(symbol).length;
  }

  getTrades() {
    return TradeDB.getAllTrades();
  }

  getStats() {
    const dbStats = TradeDB.getTradeStats();
    const positions = TradeDB.getPositions();
    const balance = TradeDB.getBalance();
    
    return {
      balance: balance.toFixed(2),
      totalProfit: (dbStats.total_pnl || 0).toFixed(2),
      openPositions: positions.length,
      totalTrades: dbStats.total || 0,
      wins: dbStats.wins || 0,
      losses: dbStats.losses || 0,
      winRate: dbStats.total ? ((dbStats.wins / dbStats.total) * 100).toFixed(1) : '0.0',
    };
  }

  getOptimizedRsi() {
    return TradeDB.getRsiParams();
  }

  getBlockedHours() {
    return TradeDB.getBlockedHours();
  }

  getMartingaleStreak() {
    return TradeDB.getMartingaleStreak();
  }

  setMartingaleStreak(streak) {
    TradeDB.setMartingaleStreak(streak);
  }

  // Trading operations
  buy(symbol, price, amount, reason, leverage = 1, stopLoss = null, takeProfit = null, context = {}) {
    const margin = (amount * price) / leverage;
    
    // Check balance
    if (margin > this.balance) {
      console.log(`❌ Insufficient balance for ${symbol} LONG: need ${margin.toFixed(2)}, have ${this.balance.toFixed(2)}`);
      return null;
    }
    
    // Deduct margin
    const newBalance = this.balance - margin;
    TradeDB.setBalance(newBalance);
    
    // Open position
    const positionId = TradeDB.openPosition({
      symbol,
      side: 'LONG',
      entryPrice: price,
      amount,
      leverage,
      margin,
      stopLoss,
      takeProfit,
      reason,
      rsi: context.rsi,
      trend: context.trend,
      volatilityMultiplier: context.volatilityMultiplier,
    });
    
    console.log(`🟢 LONG: ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} (${leverage}x, margin: ${margin.toFixed(2)} USDT)`);
    
    return positionId;
  }

  short(symbol, price, amount, reason, leverage = 1, stopLoss = null, takeProfit = null, context = {}) {
    const margin = (amount * price) / leverage;
    
    // Check balance
    if (margin > this.balance) {
      console.log(`❌ Insufficient balance for ${symbol} SHORT: need ${margin.toFixed(2)}, have ${this.balance.toFixed(2)}`);
      return null;
    }
    
    // Deduct margin
    const newBalance = this.balance - margin;
    TradeDB.setBalance(newBalance);
    
    // Open position
    const positionId = TradeDB.openPosition({
      symbol,
      side: 'SHORT',
      entryPrice: price,
      amount,
      leverage,
      margin,
      stopLoss,
      takeProfit,
      reason,
      rsi: context.rsi,
      trend: context.trend,
      volatilityMultiplier: context.volatilityMultiplier,
    });
    
    console.log(`🔴 SHORT: ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} (${leverage}x, margin: ${margin.toFixed(2)} USDT)`);
    
    return positionId;
  }

  closePosition(positionId, exitPrice, exitReason, context = {}) {
    // Get position from DB
    const position = TradeDB.raw.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position) {
      console.log(`❌ Position ${positionId} not found`);
      return null;
    }
    
    // Close and get result
    const result = TradeDB.closePosition(positionId, {
      exitPrice,
      reason: exitReason,
      ...context,
    });
    
    if (!result) return null;
    
    // Return margin + profit to balance
    const newBalance = this.balance + position.margin + result.pnl;
    TradeDB.setBalance(newBalance);
    
    const emoji = result.pnl > 0 ? '✅' : '❌';
    console.log(`${emoji} Closed ${position.side} ${position.symbol}: ${result.pnl > 0 ? '+' : ''}${result.pnl.toFixed(2)} USDT (${result.pnlPercent.toFixed(2)}%)`);
    
    return result;
  }

  // Alias for closePosition (used by trader.js)
  sell(positionId, exitPrice, reason, indicators = {}) {
    const result = this.closePosition(positionId, exitPrice, reason, indicators);
    if (result) {
      return { success: true, trade: { ...result, exitPrice, reason } };
    }
    return { success: false };
  }

  // Check positions for SL/TP hits
  checkPositions(symbol, currentPrice, highPrice = null, lowPrice = null) {
    const positions = this.getPositions(symbol);
    const closedTrades = [];
    
    for (const pos of positions) {
      const isLong = pos.side === 'LONG';
      const entryPrice = pos.entry_price;
      
      // Calculate current P/L percent
      const direction = isLong ? 1 : -1;
      const pnlPercent = direction * ((currentPrice - entryPrice) / entryPrice) * 100;
      
      // Check stop loss
      if (pos.stop_loss) {
        const slHit = isLong 
          ? (lowPrice || currentPrice) <= pos.stop_loss
          : (highPrice || currentPrice) >= pos.stop_loss;
        
        if (slHit) {
          const result = this.closePosition(pos.id, pos.stop_loss, 'Stop Loss Hit');
          if (result) closedTrades.push({ ...result, position: pos });
          continue;
        }
      }
      
      // Check take profit
      if (pos.take_profit) {
        const tpHit = isLong
          ? (highPrice || currentPrice) >= pos.take_profit
          : (lowPrice || currentPrice) <= pos.take_profit;
        
        if (tpHit) {
          const result = this.closePosition(pos.id, pos.take_profit, 'Take Profit Hit');
          if (result) closedTrades.push({ ...result, position: pos });
          continue;
        }
      }
      
      // Update trailing stop
      if (pos.trailing_active || pnlPercent >= 1.0) { // Activate at 1% profit
        const newHighest = isLong 
          ? Math.max(pos.highest_price || entryPrice, highPrice || currentPrice)
          : pos.highest_price || entryPrice;
        const newLowest = !isLong
          ? Math.min(pos.lowest_price || entryPrice, lowPrice || currentPrice)
          : pos.lowest_price || entryPrice;
        
        // Calculate trailing stop (0.5% trail)
        const trailPercent = 0.005;
        const newSL = isLong
          ? newHighest * (1 - trailPercent)
          : newLowest * (1 + trailPercent);
        
        // Only move SL if it's better than current
        const shouldUpdate = !pos.stop_loss || (isLong ? newSL > pos.stop_loss : newSL < pos.stop_loss);
        
        if (pnlPercent >= 1.0 || pos.trailing_active) {
          TradeDB.updatePosition(pos.id, {
            highestPrice: newHighest,
            lowestPrice: newLowest,
            trailingActive: true,
            stopLoss: shouldUpdate ? newSL : pos.stop_loss,
          });
        }
      }
    }
    
    return closedTrades;
  }

  // Get summary
  getSummary() {
    const stats = TradeDB.getTradeStats();
    const positions = TradeDB.getPositions();
    const balance = TradeDB.getBalance();
    
    return {
      balance,
      openPositions: positions.length,
      totalTrades: stats.total || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      winRate: stats.total ? ((stats.wins / stats.total) * 100).toFixed(1) : 0,
      totalPnL: stats.total_pnl || 0,
      roi: ((balance - this.initialBalance) / this.initialBalance * 100).toFixed(2),
    };
  }

  // Get global stats for logging
  getGlobalStats() {
    const stats = TradeDB.getTradeStats();
    const positions = TradeDB.getPositions();
    const balance = TradeDB.getBalance();
    
    return {
      balance: balance.toFixed(2),
      pnl: (stats.total_pnl || 0).toFixed(2),
      openPositions: positions.length,
    };
  }

  // Optimization methods
  setOptimizedRsi(oversold, overbought) {
    TradeDB.setRsiParams(oversold, overbought);
    console.log(`🎯 Updated RSI params: Oversold ${oversold}, Overbought ${overbought}`);
  }

  setBlockedHours(hours, stats = {}) {
    TradeDB.setBlockedHours(hours, stats);
    console.log(`⏰ Updated blocked hours: ${hours.join(', ')} UTC`);
  }

  // Analytics
  getWinRateByHour() {
    return TradeDB.getWinRateByHour();
  }

  getWinRateBySide() {
    return TradeDB.getWinRateBySide();
  }

  getWinRateBySymbol() {
    return TradeDB.getWinRateBySymbol();
  }

  // Drawdown protection (disabled for YOLO mode)
  checkDrawdownProtection(config) {
    // Return false = trading NOT paused
    return { isPaused: false, shouldPause: false };
  }

  // Compatibility with old trader.js
  get trades() {
    return TradeDB.getAllTrades();
  }

  // Positions as property (normalized format)
  get positions() {
    return TradeDB.getPositions().map(p => ({
      ...p,
      type: p.side.toLowerCase(),  // Normalize side to type for backward compat
      entryPrice: p.entry_price,
      stopLoss: p.stop_loss,
      takeProfit: p.take_profit,
      openTime: p.opened_at,
    }));
  }

  getTradesHistory() {
    return TradeDB.getAllTrades();
  }

  // Check if a specific RSI value is within optimized range
  isRsiInRange(rsi) {
    const params = TradeDB.getRsiParams();
    return rsi >= params.oversold && rsi <= params.overbought;
  }

  // Optimize methods (stubs for now)
  optimizeHours() {
    const hourStats = TradeDB.getWinRateByHour();
    const badHours = hourStats
      .filter(h => h.total >= 3 && h.win_rate < 40)
      .map(h => h.hour_utc);
    
    if (badHours.length > 0) {
      this.setBlockedHours(badHours);
    }
    return badHours;
  }

  shouldOptimize() {
    const stats = TradeDB.getTradeStats();
    return stats.total > 0 && stats.total % 5 === 0;
  }

  // Get effective blocked hours (merges static config with learned hours)
  getEffectiveBlockedHours(staticHours = []) {
    const learned = this.getBlockedHours();
    return [...new Set([...staticHours, ...learned])];
  }
}

export default PaperTrader;
