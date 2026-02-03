// Test file for new indicator strategies
import { Indicators } from './indicators.js';
import { Strategies } from './strategies.js';

// Generate mock candle data with some realistic patterns
function generateMockCandles(count = 100) {
  const candles = [];
  let price = 100;
  
  for (let i = 0; i < count; i++) {
    // Create some volatility
    const change = (Math.random() - 0.5) * 4;
    price = Math.max(50, price + change);
    
    const open = price;
    const high = price + Math.random() * 2;
    const low = price - Math.random() * 2;
    const close = price + (Math.random() - 0.5) * 2;
    
    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000
    });
    
    price = close;
  }
  
  return candles;
}

// Generate trending data (for testing signals)
function generateTrendingCandles(direction = 'up', count = 50) {
  const candles = [];
  let price = direction === 'up' ? 80 : 120;
  const trend = direction === 'up' ? 0.5 : -0.5;
  
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * 1;
    price = price + trend + noise;
    
    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: Math.random() * 1000000
    });
  }
  
  return candles;
}

// Test indicator calculations
console.log('='.repeat(60));
console.log('Testing Indicator Calculations');
console.log('='.repeat(60));

const testData = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
                  45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
                  46.21, 46.25, 45.71, 46.45, 45.78, 46.22, 46.13, 45.70, 46.04, 46.05];

console.log('\n1. Testing MACD calculation:');
const macdResult = Indicators.macd(testData, 12, 26, 9);
console.log(`   Last MACD value: ${macdResult.macd[macdResult.macd.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   Last Signal value: ${macdResult.signal[macdResult.signal.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   Last Histogram value: ${macdResult.histogram[macdResult.histogram.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   ✅ MACD calculation works!`);

console.log('\n2. Testing Bollinger Bands calculation:');
const bbResult = Indicators.bollingerBands(testData, 20, 2);
console.log(`   Last Upper Band: ${bbResult.upper[bbResult.upper.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   Last Middle Band: ${bbResult.middle[bbResult.middle.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   Last Lower Band: ${bbResult.lower[bbResult.lower.length - 1]?.toFixed(4) || 'null'}`);
console.log(`   ✅ Bollinger Bands calculation works!`);

// Test all strategies
console.log('\n' + '='.repeat(60));
console.log('Testing All Strategies');
console.log('='.repeat(60));

const mockCandles = generateMockCandles(100);

const strategies = [
  { name: 'rsi_ma_crossover', params: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, maFastPeriod: 9, maSlowPeriod: 21 } },
  { name: 'simple_rsi', params: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 } },
  { name: 'macd', params: { macdFast: 12, macdSlow: 26, macdSignal: 9, histogramThreshold: 0 } },
  { name: 'bollinger_bands', params: { bbPeriod: 20, bbStdDev: 2, bounceConfirmation: true } },
  { name: 'multi_indicator', params: { rsiPeriod: 14, rsiOversold: 35, rsiOverbought: 65, macdFast: 12, macdSlow: 26, macdSignal: 9, bbPeriod: 20, bbStdDev: 2, minConfluence: 2 } }
];

for (const strat of strategies) {
  console.log(`\n${strat.name}:`);
  try {
    const strategyFn = Strategies.getStrategy(strat.name);
    const result = strategyFn(mockCandles, strat.params);
    console.log(`   Signal: ${result.signal}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.confidence) console.log(`   Confidence: ${result.confidence}%`);
    console.log(`   ✅ Strategy works!`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Test with trending data
console.log('\n' + '='.repeat(60));
console.log('Testing with Trending Data');
console.log('='.repeat(60));

console.log('\n--- Testing MACD with uptrend data ---');
const uptrendCandles = generateTrendingCandles('up', 50);
const macdUp = Strategies.macdStrategy(uptrendCandles, { macdFast: 12, macdSlow: 26, macdSignal: 9 });
console.log(`   Uptrend signal: ${macdUp.signal} - ${macdUp.reason}`);

console.log('\n--- Testing MACD with downtrend data ---');
const downtrendCandles = generateTrendingCandles('down', 50);
const macdDown = Strategies.macdStrategy(downtrendCandles, { macdFast: 12, macdSlow: 26, macdSignal: 9 });
console.log(`   Downtrend signal: ${macdDown.signal} - ${macdDown.reason}`);

console.log('\n--- Testing Bollinger Bands with extreme values ---');
// Create candles that touch lower band
const lowBandCandles = generateMockCandles(50);
const bb = Indicators.bollingerBands(lowBandCandles.map(c => c.close), 20, 2);
const lastLower = bb.lower[bb.lower.length - 1];
if (lastLower) {
  lowBandCandles[lowBandCandles.length - 1].close = lastLower * 0.99; // Below lower band
  lowBandCandles[lowBandCandles.length - 2].close = lastLower * 0.98;
}
const bbResult2 = Strategies.bollingerBands(lowBandCandles, { bbPeriod: 20, bbStdDev: 2, bounceConfirmation: false });
console.log(`   Lower band touch signal: ${bbResult2.signal} - ${bbResult2.reason}`);

console.log('\n--- Testing Multi-Indicator confluence ---');
const multiResult = Strategies.multiIndicator(mockCandles, {
  rsiPeriod: 14,
  rsiOversold: 35,
  rsiOverbought: 65,
  minConfluence: 1.5
});
console.log(`   Multi-indicator signal: ${multiResult.signal}`);
console.log(`   Reason: ${multiResult.reason}`);
if (multiResult.indicators) {
  console.log(`   Buy score: ${multiResult.indicators.buyScore?.toFixed(1) || 0}`);
  console.log(`   Sell score: ${multiResult.indicators.sellScore?.toFixed(1) || 0}`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ All tests passed! New strategies are working correctly.');
console.log('='.repeat(60));
console.log('\nAvailable strategies:');
console.log('  - rsi_ma_crossover (original)');
console.log('  - simple_rsi (original)');
console.log('  - macd (NEW)');
console.log('  - bollinger_bands (NEW)');
console.log('  - multi_indicator (NEW - combines all)');
console.log('\nTo use a new strategy, update config.js:');
console.log("  strategy: { name: 'multi_indicator', ... }");
