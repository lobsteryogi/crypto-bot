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
        signal: 'short', 
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
        signal: 'short', 
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

  /**
   * Multi-Timeframe Analysis Strategy
   * Uses higher timeframes for trend direction, lower timeframe for entry
   * 
   * Logic:
   * - 15m: Primary trend direction (EMA 20 vs EMA 50)
   * - 5m: Momentum confirmation (MACD histogram direction)
   * - 1m: Entry trigger (RSI oversold/overbought)
   * 
   * Only trades in direction of higher timeframe trend
   * 
   * @param {Object} multiCandles - Object with candles for each timeframe: { '1m': [], '5m': [], '15m': [] }
   * @param {Object} params - Strategy parameters
   * @returns {Object} Trading signal
   */
  static multiTimeframe(multiCandles, params) {
    const {
      // Trend params (15m)
      trendFastPeriod = 20,
      trendSlowPeriod = 50,
      // Momentum params (5m)
      macdFast = 12,
      macdSlow = 26,
      macdSignal = 9,
      // Entry params (1m)
      rsiPeriod = 14,
      rsiOversold = 35,
      rsiOverbought = 65,
      // Confluence
      requireAllTimeframes = true,
    } = params;

    // Extract candles for each timeframe
    const candles1m = multiCandles['1m'];
    const candles5m = multiCandles['5m'];
    const candles15m = multiCandles['15m'];

    if (!candles1m || !candles5m || !candles15m) {
      return { signal: 'hold', reason: 'Missing timeframe data for multi-TF analysis' };
    }

    if (candles15m.length < trendSlowPeriod + 5) {
      return { signal: 'hold', reason: 'Insufficient 15m data for trend analysis' };
    }

    // ===== 15M TREND ANALYSIS =====
    const closes15m = candles15m.map(c => c.close);
    const emaFast15m = Indicators.ema(closes15m, trendFastPeriod);
    const emaSlow15m = Indicators.ema(closes15m, trendSlowPeriod);
    
    const lastIdx15m = closes15m.length - 1;
    const currentEmaFast15m = emaFast15m[lastIdx15m];
    const currentEmaSlow15m = emaSlow15m[lastIdx15m];
    const currentClose15m = closes15m[lastIdx15m];

    let trend15m = 'neutral';
    let trendStrength = 0;
    
    if (currentEmaFast15m !== null && currentEmaSlow15m !== null) {
      const emaDiff = ((currentEmaFast15m - currentEmaSlow15m) / currentEmaSlow15m) * 100;
      
      if (currentEmaFast15m > currentEmaSlow15m && currentClose15m > currentEmaFast15m) {
        trend15m = 'bullish';
        trendStrength = Math.min(100, Math.abs(emaDiff) * 20);
      } else if (currentEmaFast15m < currentEmaSlow15m && currentClose15m < currentEmaFast15m) {
        trend15m = 'bearish';
        trendStrength = Math.min(100, Math.abs(emaDiff) * 20);
      } else if (currentEmaFast15m > currentEmaSlow15m) {
        trend15m = 'weak_bullish';
        trendStrength = Math.min(50, Math.abs(emaDiff) * 10);
      } else if (currentEmaFast15m < currentEmaSlow15m) {
        trend15m = 'weak_bearish';
        trendStrength = Math.min(50, Math.abs(emaDiff) * 10);
      }
    }

    // ===== 5M MOMENTUM ANALYSIS =====
    const closes5m = candles5m.map(c => c.close);
    const macd5m = Indicators.macd(closes5m, macdFast, macdSlow, macdSignal);
    
    const lastIdx5m = closes5m.length - 1;
    const prevIdx5m = lastIdx5m - 1;
    const currentHistogram5m = macd5m.histogram[lastIdx5m];
    const prevHistogram5m = macd5m.histogram[prevIdx5m];

    let momentum5m = 'neutral';
    let momentumStrength = 0;

    if (currentHistogram5m !== null && prevHistogram5m !== null) {
      if (currentHistogram5m > 0 && currentHistogram5m > prevHistogram5m) {
        momentum5m = 'bullish';
        momentumStrength = Math.min(100, Math.abs(currentHistogram5m) * 500 + 30);
      } else if (currentHistogram5m < 0 && currentHistogram5m < prevHistogram5m) {
        momentum5m = 'bearish';
        momentumStrength = Math.min(100, Math.abs(currentHistogram5m) * 500 + 30);
      } else if (currentHistogram5m > 0) {
        momentum5m = 'weak_bullish';
        momentumStrength = Math.min(50, Math.abs(currentHistogram5m) * 300);
      } else if (currentHistogram5m < 0) {
        momentum5m = 'weak_bearish';
        momentumStrength = Math.min(50, Math.abs(currentHistogram5m) * 300);
      }
    }

    // ===== 1M ENTRY ANALYSIS =====
    const closes1m = candles1m.map(c => c.close);
    const rsi1m = Indicators.rsi(closes1m, rsiPeriod);
    
    const lastIdx1m = closes1m.length - 1;
    const currentRsi1m = rsi1m[lastIdx1m];
    const currentPrice = closes1m[lastIdx1m];

    let entry1m = 'neutral';
    let entryStrength = 0;

    if (currentRsi1m !== null) {
      if (currentRsi1m < rsiOversold) {
        entry1m = 'oversold';
        entryStrength = Math.min(100, (rsiOversold - currentRsi1m) * 3 + 40);
      } else if (currentRsi1m > rsiOverbought) {
        entry1m = 'overbought';
        entryStrength = Math.min(100, (currentRsi1m - rsiOverbought) * 3 + 40);
      }
    }

    // ===== BUILD INDICATORS OBJECT =====
    const indicators = {
      trend15m,
      trendStrength,
      emaFast15m: currentEmaFast15m,
      emaSlow15m: currentEmaSlow15m,
      momentum5m,
      momentumStrength,
      histogram5m: currentHistogram5m,
      entry1m,
      entryStrength,
      rsi1m: currentRsi1m,
      price: currentPrice,
    };

    // ===== DECISION LOGIC =====
    const reasons = [];

    // BUY: Bullish trend + Bullish momentum + Oversold entry
    const bullishTrend = trend15m === 'bullish' || trend15m === 'weak_bullish';
    const bullishMomentum = momentum5m === 'bullish' || momentum5m === 'weak_bullish';
    const oversoldEntry = entry1m === 'oversold';

    // SELL: Bearish trend + Bearish momentum + Overbought entry  
    const bearishTrend = trend15m === 'bearish' || trend15m === 'weak_bearish';
    const bearishMomentum = momentum5m === 'bearish' || momentum5m === 'weak_bearish';
    const overboughtEntry = entry1m === 'overbought';

    if (requireAllTimeframes) {
      // Strict mode: require all 3 timeframes to align
      if (bullishTrend && bullishMomentum && oversoldEntry) {
        reasons.push(`15m: ${trend15m} (str: ${trendStrength.toFixed(0)})`);
        reasons.push(`5m: ${momentum5m} (hist: ${currentHistogram5m?.toFixed(4)})`);
        reasons.push(`1m: RSI ${currentRsi1m?.toFixed(1)} oversold`);
        
        const confidence = Math.round((trendStrength + momentumStrength + entryStrength) / 3);
        return {
          signal: 'buy',
          reason: `MTF BUY: ${reasons.join(' | ')}`,
          confidence: Math.min(95, confidence),
          indicators,
        };
      }

      if (bearishTrend && bearishMomentum && overboughtEntry) {
        reasons.push(`15m: ${trend15m} (str: ${trendStrength.toFixed(0)})`);
        reasons.push(`5m: ${momentum5m} (hist: ${currentHistogram5m?.toFixed(4)})`);
        reasons.push(`1m: RSI ${currentRsi1m?.toFixed(1)} overbought`);
        
        const confidence = Math.round((trendStrength + momentumStrength + entryStrength) / 3);
        return {
          signal: 'sell',
          reason: `MTF SELL: ${reasons.join(' | ')}`,
          confidence: Math.min(95, confidence),
          indicators,
        };
      }
    } else {
      // Relaxed mode: 2 out of 3 is enough
      let buyScore = (bullishTrend ? 1 : 0) + (bullishMomentum ? 1 : 0) + (oversoldEntry ? 1 : 0);
      let sellScore = (bearishTrend ? 1 : 0) + (bearishMomentum ? 1 : 0) + (overboughtEntry ? 1 : 0);

      if (buyScore >= 2 && buyScore > sellScore) {
        if (bullishTrend) reasons.push(`15m: ${trend15m}`);
        if (bullishMomentum) reasons.push(`5m: ${momentum5m}`);
        if (oversoldEntry) reasons.push(`1m: RSI ${currentRsi1m?.toFixed(1)}`);
        
        return {
          signal: 'buy',
          reason: `MTF BUY (${buyScore}/3): ${reasons.join(' | ')}`,
          confidence: Math.min(85, 50 + buyScore * 15),
          indicators,
        };
      }

      if (sellScore >= 2 && sellScore > buyScore) {
        if (bearishTrend) reasons.push(`15m: ${trend15m}`);
        if (bearishMomentum) reasons.push(`5m: ${momentum5m}`);
        if (overboughtEntry) reasons.push(`1m: RSI ${currentRsi1m?.toFixed(1)}`);
        
        return {
          signal: 'sell',
          reason: `MTF SELL (${sellScore}/3): ${reasons.join(' | ')}`,
          confidence: Math.min(85, 50 + sellScore * 15),
          indicators,
        };
      }
    }

    // No signal
    return {
      signal: 'hold',
      reason: `MTF: No alignment (15m: ${trend15m}, 5m: ${momentum5m}, 1m: ${entry1m})`,
      indicators,
    };
  }

  // Get strategy function by name
  static getStrategy(name) {
    const strategies = {
      'rsi_ma_crossover': this.rsiMaCrossover.bind(this),
      'simple_rsi': this.simpleRsi.bind(this),
      'macd': this.macdStrategy.bind(this),
      'bollinger_bands': this.bollingerBands.bind(this),
      'multi_indicator': this.multiIndicator.bind(this),
      'multi_timeframe': this.multiTimeframe.bind(this),
    };
    return strategies[name] || strategies['rsi_ma_crossover'];
  }

  // Check if strategy requires multi-timeframe data
  static isMultiTimeframe(name) {
    return name === 'multi_timeframe';
  }
}
