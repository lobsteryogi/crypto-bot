// Trading strategies
import { Indicators } from './indicators.js';

export class Strategies {
  // RSI + MA Crossover Strategy
  static rsiMaCrossover(candles, params) {
    const closes = candles.map(c => c.close);
    const { rsiPeriod, rsiOversold, rsiOverbought, maFastPeriod, maSlowPeriod } = params;
    
    const rsi = Indicators.rsi(closes, rsiPeriod);
    const maFast = Indicators.ema(closes, maFastPeriod);
    const maSlow = Indicators.ema(closes, maSlowPeriod);
    
    const lastIndex = closes.length - 1;
    const prevIndex = lastIndex - 1;
    
    const currentRsi = rsi[lastIndex];
    const currentMaFast = maFast[lastIndex];
    const currentMaSlow = maSlow[lastIndex];
    const prevMaFast = maFast[prevIndex];
    const prevMaSlow = maSlow[prevIndex];
    
    if (currentRsi === null || currentMaFast === null || currentMaSlow === null) {
      return { signal: 'hold', reason: 'Insufficient data' };
    }
    
    // Buy signal: RSI oversold AND fast MA crosses above slow MA
    const maCrossUp = prevMaFast <= prevMaSlow && currentMaFast > currentMaSlow;
    const maCrossDown = prevMaFast >= prevMaSlow && currentMaFast < currentMaSlow;
    
    if (currentRsi < rsiOversold && maCrossUp) {
      return { 
        signal: 'buy', 
        reason: `RSI oversold (${currentRsi.toFixed(2)}) + MA bullish crossover`,
        confidence: Math.min(100, (rsiOversold - currentRsi) * 3 + 50)
      };
    }
    
    // Sell signal: RSI overbought AND fast MA crosses below slow MA
    if (currentRsi > rsiOverbought && maCrossDown) {
      return { 
        signal: 'sell', 
        reason: `RSI overbought (${currentRsi.toFixed(2)}) + MA bearish crossover`,
        confidence: Math.min(100, (currentRsi - rsiOverbought) * 3 + 50)
      };
    }
    
    // Weak signals (just RSI)
    if (currentRsi < rsiOversold) {
      return { 
        signal: 'buy', 
        reason: `RSI oversold (${currentRsi.toFixed(2)})`,
        confidence: Math.min(80, (rsiOversold - currentRsi) * 2 + 30)
      };
    }
    
    if (currentRsi > rsiOverbought) {
      return { 
        signal: 'sell', 
        reason: `RSI overbought (${currentRsi.toFixed(2)})`,
        confidence: Math.min(80, (currentRsi - rsiOverbought) * 2 + 30)
      };
    }
    
    return { 
      signal: 'hold', 
      reason: `RSI neutral (${currentRsi.toFixed(2)}), waiting for signal`,
      indicators: { rsi: currentRsi, maFast: currentMaFast, maSlow: currentMaSlow }
    };
  }

  // Simple RSI Strategy (fallback)
  static simpleRsi(candles, params) {
    const closes = candles.map(c => c.close);
    const { rsiPeriod, rsiOversold, rsiOverbought } = params;
    
    const rsi = Indicators.rsi(closes, rsiPeriod);
    const currentRsi = rsi[rsi.length - 1];
    
    if (currentRsi === null) {
      return { signal: 'hold', reason: 'Insufficient data' };
    }
    
    if (currentRsi < rsiOversold) {
      return { signal: 'buy', reason: `RSI ${currentRsi.toFixed(2)} < ${rsiOversold}`, confidence: 60 };
    }
    
    if (currentRsi > rsiOverbought) {
      return { signal: 'sell', reason: `RSI ${currentRsi.toFixed(2)} > ${rsiOverbought}`, confidence: 60 };
    }
    
    return { signal: 'hold', reason: `RSI ${currentRsi.toFixed(2)} is neutral` };
  }

  // Get strategy function by name
  static getStrategy(name) {
    const strategies = {
      'rsi_ma_crossover': this.rsiMaCrossover.bind(this),
      'simple_rsi': this.simpleRsi.bind(this),
    };
    return strategies[name] || strategies['rsi_ma_crossover'];
  }
}
