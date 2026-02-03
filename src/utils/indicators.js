// src/utils/indicators.js
export const Indicators = {
  sma(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      result.push(avg);
    }
    return result;
  },

  ema(data, period) {
    const result = [];
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      if (i === period - 1) {
        result.push(ema);
        continue;
      }
      ema = (data[i] - ema) * multiplier + ema;
      result.push(ema);
    }
    return result;
  },

  rsi(closes, period = 14) {
    const result = [];
    const gains = [];
    const losses = [];

    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    for (let i = 0; i < closes.length; i++) {
      if (i < period) {
        result.push(null);
        continue;
      }
      const gainSlice = gains.slice(i - period, i);
      const lossSlice = losses.slice(i - period, i);
      const avgGain = gainSlice.reduce((a, b) => a + b, 0) / period;
      const avgLoss = lossSlice.reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        result.push(100);
        continue;
      }
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
    return result;
  },

  atr(candles, period = 14) {
    if (!candles || candles.length < period + 1) return [];
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trueRanges.push(tr);
    }
    return this.sma(trueRanges, period);
  }
};
