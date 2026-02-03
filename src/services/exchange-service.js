// src/services/exchange-service.js
import ccxt from 'ccxt';
import { config } from '../config.js';

class ExchangeService {
  constructor() {
    this.exchange = new ccxt.binance({ enableRateLimit: true });
  }

  async fetchCandles(symbol, timeframe, limit = 200) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      return ohlcv.map(c => ({
        timestamp: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
      }));
    } catch (error) {
      console.error(`[ExchangeService] Error: ${error.message}`);
      return null;
    }
  }

  async fetchMultiTimeframe(symbol, timeframes = ['1m', '5m', '15m'], limits = {}) {
    const results = {};
    for (const tf of timeframes) {
      const limit = limits[tf] || 200;
      results[tf] = await this.fetchCandles(symbol, tf, limit);
    }
    return results;
  }
}

export const exchangeService = new ExchangeService();
