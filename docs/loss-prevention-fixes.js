// ================================================
// CRYPTO BOT - LOSS PREVENTION FIXES
// Implementation Guide Based on Loss Analysis
// Generated: 2026-02-04
// ================================================

// ================================================
// PHASE 1: CRITICAL FIXES (Deploy Immediately)
// ================================================

/**
 * FIX 1: Disable Weak Bullish LONG Entries
 * Location: Add to signal generation/validation in strategy.js
 */
function validateLongEntry(signal, indicators) {
  const { mtfSignal, rsi, trend } = signal;
  
  // CRITICAL: Block "weak_bullish" entries with low RSI
  if (mtfSignal.includes('weak_bullish')) {
    console.log('❌ LONG rejected: "weak_bullish" pattern disabled (88.9% historical loss rate)');
    return false;
  }
  
  // Require STRONG bullish alignment (3/3 timeframes)
  const alignedTimeframes = Object.keys(indicators).filter(tf => 
    indicators[tf].trend === 'bullish'
  ).length;
  
  if (alignedTimeframes < 3) {
    console.log(`❌ LONG rejected: Only ${alignedTimeframes}/3 timeframes aligned (need 3/3)`);
    return false;
  }
  
  // Don't enter LONG if RSI too low (falling knife)
  if (rsi < 35) {
    console.log(`❌ LONG rejected: RSI ${rsi} too low (likely still falling)`);
    return false;
  }
  
  return true;
}

/**
 * FIX 2: Block High-Risk Trading Hours
 * Location: Add to main trading loop check
 */
const BLOCKED_HOURS_CONFIG = {
  13: { reason: 'Historical: 0% win rate, choppy market', avgLoss: -5.74 },
  16: { reason: 'Historical: 0% win rate, -$109 total loss', avgLoss: -13.64 },
  21: { reason: 'Historical: 20% win rate, -$1,016 net loss', avgLoss: -100.95 }
};

function isHourBlocked() {
  const currentHourUTC = new Date().getUTCHours();
  
  if (BLOCKED_HOURS_CONFIG[currentHourUTC]) {
    const config = BLOCKED_HOURS_CONFIG[currentHourUTC];
    console.log(`⛔ Trading BLOCKED for hour ${currentHourUTC} UTC`);
    console.log(`   Reason: ${config.reason}`);
    return true;
  }
  
  return false;
}

// In main trading cycle:
async function tradingCycle() {
  if (isHourBlocked()) {
    console.log('⏭️  Skipping trading cycle (blocked hour)');
    return;
  }
  
  // ... rest of trading logic
}

/**
 * FIX 3: Consecutive Loss Circuit Breaker
 * Location: Add to trade closing logic
 */
class CircuitBreaker {
  constructor(maxConsecutiveLosses = 3, pauseDurationMs = 15 * 60 * 1000) {
    this.maxConsecutiveLosses = maxConsecutiveLosses;
    this.pauseDurationMs = pauseDurationMs;
    this.consecutiveLosses = 0;
    this.pausedUntil = null;
  }
  
  recordTradeResult(result, pnl) {
    if (result === 'LOSS') {
      this.consecutiveLosses++;
      console.log(`📉 Consecutive losses: ${this.consecutiveLosses}/${this.maxConsecutiveLosses}`);
      
      if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
        this.trigger();
      }
    } else if (result === 'WIN') {
      if (this.consecutiveLosses > 0) {
        console.log(`✅ Win! Resetting consecutive loss counter (was ${this.consecutiveLosses})`);
      }
      this.consecutiveLosses = 0;
    }
  }
  
  trigger() {
    this.pausedUntil = Date.now() + this.pauseDurationMs;
    const resumeTime = new Date(this.pausedUntil).toISOString();
    
    console.log('');
    console.log('🚨 ============================================');
    console.log('🚨 CIRCUIT BREAKER ACTIVATED');
    console.log('🚨 ============================================');
    console.log(`   Reason: ${this.consecutiveLosses} consecutive losses detected`);
    console.log(`   Action: Pausing ALL trading for ${this.pauseDurationMs / 60000} minutes`);
    console.log(`   Resume: ${resumeTime}`);
    console.log('🚨 ============================================');
    console.log('');
    
    // Optional: Send Telegram alert
    // sendTelegramAlert(`⚠️ Circuit breaker: ${this.consecutiveLosses} consecutive losses. Trading paused for 15min.`);
  }
  
  isActive() {
    if (!this.pausedUntil) return false;
    
    if (Date.now() < this.pausedUntil) {
      const remainingMs = this.pausedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      console.log(`⏸️  Circuit breaker active: ${remainingMin} minutes remaining`);
      return true;
    }
    
    console.log('✅ Circuit breaker expired, resuming normal trading');
    this.pausedUntil = null;
    this.consecutiveLosses = 0;
    return false;
  }
}

// Initialize globally
const circuitBreaker = new CircuitBreaker(3, 15 * 60 * 1000);

// In trade closing handler:
async function handleClosedPosition(position, exitPrice, exitReason) {
  const result = position.pnl >= 0 ? 'WIN' : 'LOSS';
  
  // Record result for circuit breaker
  circuitBreaker.recordTradeResult(result, position.pnl);
  
  // ... rest of closing logic
}

// In main trading cycle:
async function tradingCycle() {
  if (circuitBreaker.isActive()) {
    return; // Skip this cycle
  }
  
  // ... rest of trading logic
}

// ================================================
// PHASE 2: IMPORTANT IMPROVEMENTS (Deploy in 7 Days)
// ================================================

/**
 * FIX 4: RSI Recovery Confirmation
 * Ensure RSI is actually RISING, not just "low"
 */
function checkRSIRecovery(indicators, timeframe = '1m') {
  const history = indicators[timeframe].rsi_history || [];
  
  if (history.length < 3) {
    console.log('⚠️ Insufficient RSI history for recovery check');
    return false;
  }
  
  const current = history[0];  // Most recent
  const prev1 = history[1];
  const prev2 = history[2];
  
  // RSI must be rising for at least 2 periods
  const isRising = current > prev1 && prev1 > prev2;
  
  if (!isRising) {
    console.log(`❌ RSI not recovering: ${prev2.toFixed(1)} → ${prev1.toFixed(1)} → ${current.toFixed(1)}`);
    return false;
  }
  
  console.log(`✅ RSI in recovery: ${prev2.toFixed(1)} → ${prev1.toFixed(1)} → ${current.toFixed(1)}`);
  return true;
}

// In LONG validation:
function validateLongEntryPhase2(signal, indicators) {
  // ... previous checks from Phase 1 ...
  
  // New: Check RSI recovery
  if (!checkRSIRecovery(indicators, '1m')) {
    console.log('❌ LONG rejected: RSI not in recovery mode');
    return false;
  }
  
  return true;
}

/**
 * FIX 5: Volume Confirmation
 * Require volume spike for reversal signals
 */
function checkVolumeConfirmation(candles, minRatio = 1.2) {
  const currentVolume = candles[0].volume;
  
  // Calculate 20-period average volume
  const avgVolume = candles.slice(0, 20).reduce((sum, c) => sum + c.volume, 0) / 20;
  const volumeRatio = currentVolume / avgVolume;
  
  if (volumeRatio < minRatio) {
    console.log(`❌ Volume too low: ${volumeRatio.toFixed(2)}x (need >${minRatio}x)`);
    return false;
  }
  
  console.log(`✅ Volume confirmed: ${volumeRatio.toFixed(2)}x average`);
  return true;
}

// In LONG validation:
function validateLongEntryPhase2WithVolume(signal, indicators, candles) {
  // ... previous checks ...
  
  // New: Volume confirmation for reversals
  if (!checkVolumeConfirmation(candles['1m'], 1.2)) {
    console.log('❌ LONG rejected: insufficient volume for reversal');
    return false;
  }
  
  return true;
}

/**
 * FIX 6: MACD Momentum Confirmation
 * Don't enter if MACD still declining
 */
function checkMACDMomentum(indicators, timeframe = '1m') {
  const macd = indicators[timeframe].macd;
  const macdPrev = indicators[timeframe].macd_prev;
  
  if (!macd || !macdPrev) {
    console.log('⚠️ MACD data not available');
    return false;
  }
  
  const histogram = macd.histogram;
  const histogramPrev = macdPrev.histogram;
  
  if (histogram <= histogramPrev) {
    console.log(`❌ MACD not improving: ${histogramPrev.toFixed(4)} → ${histogram.toFixed(4)}`);
    return false;
  }
  
  console.log(`✅ MACD improving: ${histogramPrev.toFixed(4)} → ${histogram.toFixed(4)}`);
  return true;
}

// ================================================
// PHASE 3: ADVANCED ENHANCEMENTS (Future)
// ================================================

/**
 * FIX 7: Market Regime Detection
 * Classify market state before trading
 */
function detectMarketRegime(indicators) {
  const ema20 = indicators['15m'].ema20;
  const ema50 = indicators['15m'].ema50;
  const atr = indicators['15m'].atr;
  const avgATR = indicators['15m'].atr_avg20;
  
  // High volatility downtrend = dangerous for LONG
  if (ema20 < ema50 && atr > avgATR * 1.5) {
    return {
      regime: 'HIGH_VOLATILITY_DOWNTREND',
      message: 'Strong downtrend with high volatility - AVOID LONGS',
      allowLong: false,
      allowShort: true
    };
  }
  
  // Low volatility chop = unpredictable
  if (Math.abs(ema20 - ema50) / ema50 < 0.01 && atr < avgATR * 0.8) {
    return {
      regime: 'LOW_VOLATILITY_CHOP',
      message: 'Sideways choppy market - REDUCE SIZE',
      allowLong: true,
      allowShort: true,
      positionMultiplier: 0.5
    };
  }
  
  // High volatility uptrend = good for LONG
  if (ema20 > ema50 && atr > avgATR * 1.2) {
    return {
      regime: 'HIGH_VOLATILITY_UPTREND',
      message: 'Strong uptrend - LONGS FAVORED',
      allowLong: true,
      allowShort: false,
      positionMultiplier: 1.2
    };
  }
  
  return {
    regime: 'NORMAL',
    message: 'Normal market conditions',
    allowLong: true,
    allowShort: true,
    positionMultiplier: 1.0
  };
}

/**
 * FIX 8: Bullish Price Structure Check
 * Require actual reversal pattern on chart
 */
function checkBullishPriceStructure(candles) {
  if (candles.length < 2) return false;
  
  const current = candles[0];
  const prev = candles[1];
  
  // Bullish engulfing pattern
  const isBullishEngulfing = 
    prev.close < prev.open && // Previous candle was red
    current.close > current.open && // Current candle is green
    current.close > prev.open && // Current close above previous open
    current.open < prev.close; // Current open below previous close
  
  if (isBullishEngulfing) {
    console.log('✅ Bullish engulfing pattern detected');
    return true;
  }
  
  // Higher low formation
  const isHigherLow = current.low > prev.low;
  const isGreen = current.close > current.open;
  
  if (isHigherLow && isGreen) {
    console.log('✅ Higher low + green candle detected');
    return true;
  }
  
  console.log('❌ No bullish price structure found');
  return false;
}

// ================================================
// COMPLETE VALIDATION FUNCTION (All Phases Combined)
// ================================================

function validateLongEntryComplete(signal, indicators, candles) {
  console.log('');
  console.log('=== LONG ENTRY VALIDATION ===');
  
  // Phase 1: Critical filters
  if (signal.mtfSignal.includes('weak_bullish')) {
    console.log('❌ REJECTED: weak_bullish pattern (Phase 1)');
    return false;
  }
  
  const alignedTimeframes = Object.keys(indicators).filter(tf => 
    indicators[tf].trend === 'bullish'
  ).length;
  
  if (alignedTimeframes < 3) {
    console.log(`❌ REJECTED: Only ${alignedTimeframes}/3 timeframes aligned (Phase 1)`);
    return false;
  }
  
  if (signal.rsi < 35) {
    console.log(`❌ REJECTED: RSI ${signal.rsi} too low (Phase 1)`);
    return false;
  }
  
  // Phase 2: Recovery & momentum checks
  if (!checkRSIRecovery(indicators, '1m')) {
    console.log('❌ REJECTED: RSI not recovering (Phase 2)');
    return false;
  }
  
  if (!checkVolumeConfirmation(candles['1m'], 1.2)) {
    console.log('❌ REJECTED: Insufficient volume (Phase 2)');
    return false;
  }
  
  if (!checkMACDMomentum(indicators, '1m')) {
    console.log('❌ REJECTED: MACD not improving (Phase 2)');
    return false;
  }
  
  // Phase 3: Advanced checks (if implemented)
  const regime = detectMarketRegime(indicators);
  if (!regime.allowLong) {
    console.log(`❌ REJECTED: Market regime (${regime.regime}) - ${regime.message}`);
    return false;
  }
  
  if (!checkBullishPriceStructure(candles['1m'])) {
    console.log('❌ REJECTED: No bullish price structure (Phase 3)');
    return false;
  }
  
  console.log('✅ LONG ENTRY APPROVED - All validation passed');
  console.log('=== END VALIDATION ===');
  console.log('');
  
  return true;
}

// ================================================
// USAGE EXAMPLE
// ================================================

/*
// In your main strategy file:

async function processSignal(symbol, side, signal, indicators, candles) {
  // Check circuit breaker
  if (circuitBreaker.isActive()) {
    return null;
  }
  
  // Check blocked hours
  if (isHourBlocked()) {
    return null;
  }
  
  // Validate LONG entries with strict criteria
  if (side === 'LONG') {
    if (!validateLongEntryComplete(signal, indicators, candles)) {
      return null; // Reject the LONG
    }
  }
  
  // SHORT validation (keep existing logic - it's working well!)
  if (side === 'SHORT') {
    // Your existing SHORT validation
  }
  
  // Proceed with entry...
  return {
    symbol,
    side,
    signal,
    // ... rest of entry data
  };
}

// In position closing handler:
async function onPositionClosed(position) {
  const result = position.pnl >= 0 ? 'WIN' : 'LOSS';
  
  // Update circuit breaker
  circuitBreaker.recordTradeResult(result, position.pnl);
  
  // Log trade
  console.log(`${result}: ${position.symbol} ${position.side} PnL: $${position.pnl.toFixed(2)}`);
}
*/

// ================================================
// CONFIGURATION EXPORT
// ================================================

module.exports = {
  // Phase 1
  BLOCKED_HOURS_CONFIG,
  CircuitBreaker,
  isHourBlocked,
  validateLongEntry,
  
  // Phase 2
  checkRSIRecovery,
  checkVolumeConfirmation,
  checkMACDMomentum,
  
  // Phase 3
  detectMarketRegime,
  checkBullishPriceStructure,
  
  // Complete
  validateLongEntryComplete
};
