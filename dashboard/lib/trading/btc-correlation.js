import { Indicators } from './indicators.js';
import { config } from './config.js';

let btcCache = {
  lastFetch: 0,
  momentum: 'neutral',
  data: null
};

export async function getBtcMomentum(exchange) {
  const now = Date.now();
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Return cached momentum if valid
  if (now - btcCache.lastFetch < CACHE_DURATION && btcCache.data) {
    return btcCache.momentum;
  }

  try {
    // Fetch BTC/USDT 15m candles (enough for SMA20 + RSI14)
    // 50 candles is enough: 20 for SMA, 14 for RSI + buffer
    const candles = await exchange.fetchOHLCV('BTC/USDT', '15m', undefined, 50);
    
    if (!candles || candles.length < 25) {
      console.warn('⚠️ Not enough BTC data for correlation analysis');
      return 'neutral';
    }

    const closes = candles.map(c => c[4]);
    const currentPrice = closes[closes.length - 1];

    // Calculate Indicators
    const sma20 = Indicators.sma(closes, 20);
    const rsi14 = Indicators.rsi(closes, 14);

    const lastSma = sma20[sma20.length - 1];
    const lastRsi = rsi14[rsi14.length - 1];

    // Determine Momentum
    // Simple logic:
    // Bullish: Price > SMA20 AND RSI > 50
    // Bearish: Price < SMA20 AND RSI < 50
    // Strong signals could require RSI > 55 or < 45
    
    let momentum = 'neutral';

    if (currentPrice > lastSma && lastRsi > 55) {
      momentum = 'bullish';
    } else if (currentPrice < lastSma && lastRsi < 45) {
      momentum = 'bearish';
    }

    // Update Cache
    btcCache = {
      lastFetch: now,
      momentum: momentum,
      data: { price: currentPrice, sma: lastSma, rsi: lastRsi }
    };

    return momentum;

  } catch (error) {
    console.error(`❌ Failed to fetch BTC momentum: ${error.message}`);
    return 'neutral'; // Default to neutral on error to allow trading (or block if strict, but neutral is safer fallback for now)
  }
}

export function shouldTradeBasedOnBtc(btcMomentum, solSignal) {
  const settings = config.trading?.btcCorrelation || { enabled: true, strictMode: false };

  if (!settings.enabled) {
    return { allowed: true, reason: 'BTC Correlation Disabled' };
  }

  // Strict Mode: BTC must match perfectly
  if (settings.strictMode) {
    if (solSignal === 'buy' && btcMomentum === 'bullish') {
      return { allowed: true, reason: 'BTC confirms Bullish trend' };
    }
    if (solSignal === 'short' && btcMomentum === 'bearish') {
      return { allowed: true, reason: 'BTC confirms Bearish trend' };
    }
    return { allowed: false, reason: `Strict mode: BTC is ${btcMomentum} vs SOL ${solSignal}` };
  }

  // Normal Mode: Don't trade AGAINST the trend
  // Allow Buy if BTC is Bullish or Neutral (Block if Bearish)
  if (solSignal === 'buy') {
    if (btcMomentum === 'bearish') {
      return { allowed: false, reason: 'BTC is Bearish (Blocking Long)' };
    }
    return { allowed: true, reason: `BTC is ${btcMomentum} (Allowing Long)` };
  }

  // Allow Short if BTC is Bearish or Neutral (Block if Bullish)
  if (solSignal === 'short') {
    if (btcMomentum === 'bullish') {
      return { allowed: false, reason: 'BTC is Bullish (Blocking Short)' };
    }
    return { allowed: true, reason: `BTC is ${btcMomentum} (Allowing Short)` };
  }

  return { allowed: true, reason: 'No conflict' };
}
