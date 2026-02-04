// src/core/position-manager.js
import { log } from '../utils/logger.js'; // เดี๋ยวสร้าง logger แยก
import { PositionSizer } from '../position-sizer.js';
import { MartingaleSizer } from '../martingale-sizer.js';
import { config } from '../config.js';

export class PositionManager {
  constructor(trader, martingaleSizer) {
    this.trader = trader;
    this.martingaleSizer = martingaleSizer;
    this.cooldowns = new Map(); // symbol -> timestamp when cooldown ends
  }

  // Check if symbol is in cooldown after SL hit
  isInCooldown(symbol) {
    const cooldownEnd = this.cooldowns.get(symbol);
    if (!cooldownEnd) return false;
    if (Date.now() >= cooldownEnd) {
      this.cooldowns.delete(symbol);
      return false;
    }
    return true;
  }

  getCooldownRemaining(symbol) {
    const cooldownEnd = this.cooldowns.get(symbol);
    if (!cooldownEnd) return 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  checkExistingPositions(symbol, currentPrice, highPrice, lowPrice) {
    const closedTrades = this.trader.checkPositions(
      symbol,
      currentPrice,
      highPrice,
      lowPrice
    );

    if (closedTrades.length > 0) {
      for (const trade of closedTrades) {
        this.processTradeResult(trade, symbol);
      }
    }
    return closedTrades;
  }

  processTradeResult(trade, symbol) {
    if (!trade) return;
    const win = trade.profit > 0;
    const newStreak = this.martingaleSizer.recordResult(win);
    this.trader.setMartingaleStreak(newStreak);

    // Set cooldown after SL hit (5 minutes)
    if (!win && trade.reason?.includes('Stop Loss')) {
      const cooldownMs = (config.trading.slCooldownMinutes || 5) * 60 * 1000;
      this.cooldowns.set(symbol, Date.now() + cooldownMs);
      log(`⏸️ ${symbol} in cooldown for ${config.trading.slCooldownMinutes || 5} minutes after SL hit`, 'warn', symbol);
    }
  }
    const win = trade.profit > 0;
    const newStreak = this.martingaleSizer.recordResult(win);
    this.trader.setMartingaleStreak(newStreak);
  }

  calculateOrderSize(stats) {
    const sizing = PositionSizer.getPositionSize(config.trading.tradeAmount, stats, config.trading.positionSizing);
    const mResult = this.martingaleSizer.getPositionSize(sizing.amount);
    
    return {
      amount: mResult.size,
      multiplier: sizing.multiplier * mResult.multiplier,
      streak: mResult.streak
    };
  }
}
