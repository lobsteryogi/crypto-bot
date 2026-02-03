// src/core/position-manager.js
import { log } from '../utils/logger.js'; // เดี๋ยวสร้าง logger แยก
import { PositionSizer } from '../position-sizer.js';
import { MartingaleSizer } from '../martingale-sizer.js';
import { config } from '../config.js';

export class PositionManager {
  constructor(trader, martingaleSizer) {
    this.trader = trader;
    this.martingaleSizer = martingaleSizer;
  }

  checkExistingPositions(symbol, currentPrice, slPercent, tpPercent) {
    const closedTrades = this.trader.checkPositions(
      symbol,
      currentPrice,
      slPercent,
      tpPercent,
      config.trading.trailingStop
    );

    if (closedTrades.length > 0) {
      for (const trade of closedTrades) {
        this.processTradeResult(trade);
      }
    }
    return closedTrades;
  }

  processTradeResult(trade) {
    if (!trade) return;
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
