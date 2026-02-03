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

  // MACD Strategy - Uses MACD crossovers with histogram confirmation
  static macdStrategy(candles, params) {
    const closes = candles.map(c => c.close);
    const { 
      macdFast = 12, 
      macdSlow = 26, 
      macdSignal = 9,
      histogramThreshold = 0 
    } = params;
    
    const macd = Indicators.macd(closes, macdFast, macdSlow, macdSignal);
    
    const lastIndex = closes.length - 1;
    const prevIndex = lastIndex - 1;
    
    const currentMacd = macd.macd[lastIndex];
    const currentSignal = macd.signal[lastIndex];
    const currentHistogram = macd.histogram[lastIndex];
    const prevMacd = macd.macd[prevIndex];
    const prevSignal = macd.signal[prevIndex];
    const prevHistogram = macd.histogram[prevIndex];
    
    if (currentMacd === null || currentSignal === null || prevMacd === null || prevSignal === null) {
      return { signal: 'hold', reason: 'Insufficient data for MACD' };
    }
    
    // Bullish crossover: MACD crosses above signal line
    const bullishCrossover = prevMacd <= prevSignal && currentMacd > currentSignal;
    // Bearish crossover: MACD crosses below signal line
    const bearishCrossover = prevMacd >= prevSignal && currentMacd < currentSignal;
    // Histogram confirmation
    const histogramBullish = currentHistogram > histogramThreshold;
    const histogramBearish = currentHistogram < -histogramThreshold;
    
    if (bullishCrossover && histogramBullish) {
      return {
        signal: 'buy',
        reason: `MACD bullish crossover (${currentMacd.toFixed(4)} > signal ${currentSignal.toFixed(4)})`,
        confidence: Math.min(90, 50 + Math.abs(currentHistogram) * 1000),
        indicators: { macd: currentMacd, signal: currentSignal, histogram: currentHistogram }
      };
    }
    
    if (bearishCrossover && histogramBearish) {
      return {
        signal: 'sell',
        reason: `MACD bearish crossover (${currentMacd.toFixed(4)} < signal ${currentSignal.toFixed(4)})`,
        confidence: Math.min(90, 50 + Math.abs(currentHistogram) * 1000),
        indicators: { macd: currentMacd, signal: currentSignal, histogram: currentHistogram }
      };
    }
    
    // Weaker signals - just histogram direction change
    if (prevHistogram !== null) {
      if (prevHistogram < 0 && currentHistogram > 0) {
        return {
          signal: 'buy',
          reason: `MACD histogram turned positive (${currentHistogram.toFixed(4)})`,
          confidence: 55,
          indicators: { macd: currentMacd, signal: currentSignal, histogram: currentHistogram }
        };
      }
      if (prevHistogram > 0 && currentHistogram < 0) {
        return {
          signal: 'sell',
          reason: `MACD histogram turned negative (${currentHistogram.toFixed(4)})`,
          confidence: 55,
          indicators: { macd: currentMacd, signal: currentSignal, histogram: currentHistogram }
        };
      }
    }
    
    return {
      signal: 'hold',
      reason: `MACD neutral (histogram: ${currentHistogram?.toFixed(4) || 'N/A'})`,
      indicators: { macd: currentMacd, signal: currentSignal, histogram: currentHistogram }
    };
  }

  // Bollinger Bands Strategy - Mean reversion with band touches
  static bollingerBands(candles, params) {
    const closes = candles.map(c => c.close);
    const { 
      bbPeriod = 20, 
      bbStdDev = 2,
      bounceConfirmation = true
    } = params;
    
    const bb = Indicators.bollingerBands(closes, bbPeriod, bbStdDev);
    
    const lastIndex = closes.length - 1;
    const prevIndex = lastIndex - 1;
    
    const currentClose = closes[lastIndex];
    const prevClose = closes[prevIndex];
    const currentUpper = bb.upper[lastIndex];
    const currentLower = bb.lower[lastIndex];
    const currentMiddle = bb.middle[lastIndex];
    const prevLower = bb.lower[prevIndex];
    const prevUpper = bb.upper[prevIndex];
    
    if (currentUpper === null || currentLower === null) {
      return { signal: 'hold', reason: 'Insufficient data for Bollinger Bands' };
    }
    
    // Calculate band width for volatility measure
    const bandWidth = (currentUpper - currentLower) / currentMiddle;
    const pricePosition = (currentClose - currentLower) / (currentUpper - currentLower);
    
    // Buy: Price touches lower band and bounces
    const touchedLower = prevClose <= prevLower;
    const bouncedFromLower = touchedLower && currentClose > currentLower;
    const nearLower = currentClose <= currentLower * 1.001; // Within 0.1% of lower band
    
    // Sell: Price touches upper band and bounces down
    const touchedUpper = prevClose >= prevUpper;
    const bouncedFromUpper = touchedUpper && currentClose < currentUpper;
    const nearUpper = currentClose >= currentUpper * 0.999; // Within 0.1% of upper band
    
    if (bounceConfirmation) {
      if (bouncedFromLower) {
        return {
          signal: 'buy',
          reason: `Price bounced from lower BB (${currentLower.toFixed(2)})`,
          confidence: Math.min(85, 60 + (1 - pricePosition) * 50),
          indicators: { upper: currentUpper, middle: currentMiddle, lower: currentLower, bandWidth, pricePosition }
        };
      }
      if (bouncedFromUpper) {
        return {
          signal: 'sell',
          reason: `Price bounced from upper BB (${currentUpper.toFixed(2)})`,
          confidence: Math.min(85, 60 + pricePosition * 50),
          indicators: { upper: currentUpper, middle: currentMiddle, lower: currentLower, bandWidth, pricePosition }
        };
      }
    } else {
      if (nearLower) {
        return {
          signal: 'buy',
          reason: `Price at lower BB (${currentLower.toFixed(2)})`,
          confidence: Math.min(75, 50 + (1 - pricePosition) * 40),
          indicators: { upper: currentUpper, middle: currentMiddle, lower: currentLower, bandWidth, pricePosition }
        };
      }
      if (nearUpper) {
        return {
          signal: 'sell',
          reason: `Price at upper BB (${currentUpper.toFixed(2)})`,
          confidence: Math.min(75, 50 + pricePosition * 40),
          indicators: { upper: currentUpper, middle: currentMiddle, lower: currentLower, bandWidth, pricePosition }
        };
      }
    }
    
    return {
      signal: 'hold',
      reason: `Price within BB (${(pricePosition * 100).toFixed(1)}% from lower)`,
      indicators: { upper: currentUpper, middle: currentMiddle, lower: currentLower, bandWidth, pricePosition }
    };
  }

  // Combined Multi-Indicator Strategy - Uses RSI, MACD, and Bollinger Bands together
  static multiIndicator(candles, params) {
    const closes = candles.map(c => c.close);
    const {
      // RSI params
      rsiPeriod = 14,
      rsiOversold = 35,
      rsiOverbought = 65,
      // MACD params
      macdFast = 12,
      macdSlow = 26,
      macdSignal = 9,
      // BB params
      bbPeriod = 20,
      bbStdDev = 2,
      // Confluence settings
      minConfluence = 2  // Minimum number of indicators that must agree
    } = params;
    
    const lastIndex = closes.length - 1;
    const prevIndex = lastIndex - 1;
    const currentClose = closes[lastIndex];
    
    // Calculate all indicators
    const rsi = Indicators.rsi(closes, rsiPeriod);
    const macd = Indicators.macd(closes, macdFast, macdSlow, macdSignal);
    const bb = Indicators.bollingerBands(closes, bbPeriod, bbStdDev);
    
    const currentRsi = rsi[lastIndex];
    const currentMacd = macd.macd[lastIndex];
    const currentSignal = macd.signal[lastIndex];
    const currentHistogram = macd.histogram[lastIndex];
    const prevMacd = macd.macd[prevIndex];
    const prevSignal = macd.signal[prevIndex];
    const prevHistogram = macd.histogram[prevIndex];
    const currentUpper = bb.upper[lastIndex];
    const currentLower = bb.lower[lastIndex];
    const currentMiddle = bb.middle[lastIndex];
    
    if (currentRsi === null || currentMacd === null || currentUpper === null) {
      return { signal: 'hold', reason: 'Insufficient data for multi-indicator analysis' };
    }
    
    // Score each indicator for buy/sell signals
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // RSI scoring
    if (currentRsi < rsiOversold) {
      buyScore++;
      reasons.push(`RSI oversold (${currentRsi.toFixed(1)})`);
    } else if (currentRsi > rsiOverbought) {
      sellScore++;
      reasons.push(`RSI overbought (${currentRsi.toFixed(1)})`);
    }
    
    // MACD scoring
    const macdBullishCross = prevMacd !== null && prevSignal !== null && 
                             prevMacd <= prevSignal && currentMacd > currentSignal;
    const macdBearishCross = prevMacd !== null && prevSignal !== null && 
                              prevMacd >= prevSignal && currentMacd < currentSignal;
    const macdBullish = currentHistogram > 0 && (prevHistogram === null || currentHistogram > prevHistogram);
    const macdBearish = currentHistogram < 0 && (prevHistogram === null || currentHistogram < prevHistogram);
    
    if (macdBullishCross) {
      buyScore += 1.5;
      reasons.push('MACD bullish crossover');
    } else if (macdBullish) {
      buyScore += 0.5;
      reasons.push('MACD bullish momentum');
    }
    
    if (macdBearishCross) {
      sellScore += 1.5;
      reasons.push('MACD bearish crossover');
    } else if (macdBearish) {
      sellScore += 0.5;
      reasons.push('MACD bearish momentum');
    }
    
    // Bollinger Bands scoring
    const pricePosition = (currentClose - currentLower) / (currentUpper - currentLower);
    
    if (currentClose <= currentLower) {
      buyScore++;
      reasons.push(`Price at lower BB`);
    } else if (pricePosition < 0.2) {
      buyScore += 0.5;
      reasons.push(`Price near lower BB (${(pricePosition * 100).toFixed(0)}%)`);
    }
    
    if (currentClose >= currentUpper) {
      sellScore++;
      reasons.push(`Price at upper BB`);
    } else if (pricePosition > 0.8) {
      sellScore += 0.5;
      reasons.push(`Price near upper BB (${(pricePosition * 100).toFixed(0)}%)`);
    }
    
    // Build indicator summary
    const indicators = {
      rsi: currentRsi,
      macd: currentMacd,
      macdSignal: currentSignal,
      histogram: currentHistogram,
      bbUpper: currentUpper,
      bbMiddle: currentMiddle,
      bbLower: currentLower,
      pricePosition,
      buyScore,
      sellScore
    };
    
    // Make decision based on confluence
    if (buyScore >= minConfluence && buyScore > sellScore) {
      return {
        signal: 'buy',
        reason: `Multi-indicator BUY (score: ${buyScore.toFixed(1)}): ${reasons.join(', ')}`,
        confidence: Math.min(95, 50 + buyScore * 15),
        indicators
      };
    }
    
    if (sellScore >= minConfluence && sellScore > buyScore) {
      return {
        signal: 'sell',
        reason: `Multi-indicator SELL (score: ${sellScore.toFixed(1)}): ${reasons.join(', ')}`,
        confidence: Math.min(95, 50 + sellScore * 15),
        indicators
      };
    }
    
    return {
      signal: 'hold',
      reason: `No confluence (buy: ${buyScore.toFixed(1)}, sell: ${sellScore.toFixed(1)})`,
      indicators
    };
  }

  /**
   * Adjust strategy signal based on sentiment
   * Uses contrarian approach: buy when fearful, cautious when greedy
   * @param {Object} technicalSignal - Original strategy signal
   * @param {Object} sentiment - Sentiment data from getSentiment()
   * @returns {Object} Adjusted signal
   */
  static applySentimentAdjustment(technicalSignal, sentiment) {
    if (!sentiment || sentiment.error) {
      return technicalSignal; // No adjustment if sentiment unavailable
    }
    
    const score = sentiment.score;
    const bias = sentiment.tradingBias; // -1 to 1
    const classification = sentiment.classification;
    
    // Clone the signal
    const adjusted = { ...technicalSignal };
    let reasons = [];
    
    // Adjust confidence based on sentiment alignment
    if (technicalSignal.signal === 'buy') {
      if (score < 30) {
        // Extreme fear + buy signal = boost confidence (contrarian)
        adjusted.confidence = Math.min(100, (adjusted.confidence || 60) + 15);
        reasons.push(`Sentiment boost: ${classification} (${score})`);
      } else if (score > 70) {
        // Greed + buy signal = reduce confidence (risky)
        adjusted.confidence = Math.max(30, (adjusted.confidence || 60) - 20);
        reasons.push(`Sentiment caution: ${classification} (${score})`);
        
        // If extreme greed, potentially override to hold
        if (score > 85 && adjusted.confidence < 50) {
          adjusted.signal = 'hold';
          adjusted.reason = `Buy signal blocked by extreme greed (${score})`;
        }
      }
    } else if (technicalSignal.signal === 'sell') {
      if (score > 70) {
        // Greed + sell signal = boost confidence (contrarian)
        adjusted.confidence = Math.min(100, (adjusted.confidence || 60) + 15);
        reasons.push(`Sentiment boost: ${classification} (${score})`);
      } else if (score < 30) {
        // Fear + sell signal = reduce confidence (potentially wrong time to sell)
        adjusted.confidence = Math.max(30, (adjusted.confidence || 60) - 15);
        reasons.push(`Sentiment caution: ${classification} (${score})`);
        
        // If extreme fear, potentially override to hold
        if (score < 15 && adjusted.confidence < 50) {
          adjusted.signal = 'hold';
          adjusted.reason = `Sell signal blocked by extreme fear (${score})`;
        }
      }
    } else if (technicalSignal.signal === 'hold') {
      // On hold signals, sentiment can provide weak signals
      if (score < 20) {
        adjusted.sentimentSignal = 'buy';
        reasons.push(`Extreme fear: contrarian buy opportunity`);
      } else if (score > 80) {
        adjusted.sentimentSignal = 'sell';
        reasons.push(`Extreme greed: contrarian sell opportunity`);
      }
    }
    
    // Add sentiment info to the signal
    adjusted.sentiment = {
      score,
      classification,
      bias,
      adjustment: reasons.join(', ') || 'none'
    };
    
    if (reasons.length > 0 && adjusted.reason) {
      adjusted.reason = `${adjusted.reason} [${reasons.join(', ')}]`;
    }
    
    return adjusted;
  }

  // Get strategy function by name
  static getStrategy(name) {
    const strategies = {
      'rsi_ma_crossover': this.rsiMaCrossover.bind(this),
      'simple_rsi': this.simpleRsi.bind(this),
      'macd': this.macdStrategy.bind(this),
      'bollinger_bands': this.bollingerBands.bind(this),
      'multi_indicator': this.multiIndicator.bind(this),
    };
    return strategies[name] || strategies['rsi_ma_crossover'];
  }
}
