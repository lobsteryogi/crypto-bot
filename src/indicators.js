// Technical indicators for trading strategies
export class Indicators {
  // Simple Moving Average
  static sma(data, period) {
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
  }

  // Exponential Moving Average
  static ema(data, period) {
    const result = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
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
  }

  // Relative Strength Index
  static rsi(closes, period = 14) {
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
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }

    return result;
  }

  // MACD
  static macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEma = this.ema(closes, fastPeriod);
    const slowEma = this.ema(closes, slowPeriod);
    
    const macdLine = fastEma.map((fast, i) => {
      if (fast === null || slowEma[i] === null) return null;
      return fast - slowEma[i];
    });

    const validMacd = macdLine.filter(v => v !== null);
    const signalLine = this.ema(validMacd, signalPeriod);
    
    // Pad signal line to match original length
    const paddedSignal = new Array(macdLine.length - validMacd.length).fill(null).concat(signalLine);

    return {
      macd: macdLine,
      signal: paddedSignal,
      histogram: macdLine.map((m, i) => {
        if (m === null || paddedSignal[i] === null) return null;
        return m - paddedSignal[i];
      })
    };
  }

  // Bollinger Bands
  static bollingerBands(closes, period = 20, stdDev = 2) {
    const sma = this.sma(closes, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
        continue;
      }

      const slice = closes.slice(i - period + 1, i + 1);
      const avg = sma[i];
      const squaredDiffs = slice.map(v => Math.pow(v - avg, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const std = Math.sqrt(variance);

      upper.push(avg + stdDev * std);
      lower.push(avg - stdDev * std);
    }

    return { upper, middle: sma, lower };
  }
}
