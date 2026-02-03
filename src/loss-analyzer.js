#!/usr/bin/env node
/**
 * Loss Pattern Analyzer
 * วิเคราะห์ losing trades หา patterns ที่ทำให้ขาดทุน
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRADES_FILE = path.join(__dirname, '../data/paper_state.json');
const OUTPUT_FILE = path.join(__dirname, '../data/loss-patterns.json');

function loadTrades() {
  if (!fs.existsSync(TRADES_FILE)) {
    return [];
  }
  const data = fs.readFileSync(TRADES_FILE, 'utf8');
  const state = JSON.parse(data);
  return state.trades || [];
}

function analyzeLosses() {
  const trades = loadTrades();
  const losses = trades.filter(t => t.profit !== undefined && t.profit < 0);
  
  if (losses.length < 5) {
    console.log('⚠️ Not enough losing trades to analyze (need at least 5)');
    console.log(`   Current losses: ${losses.length}`);
    return null;
  }

  console.log(`\n🔴 LOSS PATTERN ANALYSIS`);
  console.log('='.repeat(60));
  console.log(`Analyzing ${losses.length} losing trades...`);

  const patterns = {
    timestamp: new Date().toISOString(),
    totalLosses: losses.length,
    totalLossAmount: losses.reduce((sum, t) => sum + Math.abs(t.profit), 0),
    avgLoss: losses.reduce((sum, t) => sum + Math.abs(t.profit), 0) / losses.length,
    patterns: {}
  };

  // 1. ขาดทุนตาม timeframe
  const byTimeframe = {};
  losses.forEach(t => {
    const tf = t.metadata?.timeframe || 'unknown';
    if (!byTimeframe[tf]) byTimeframe[tf] = { count: 0, totalLoss: 0 };
    byTimeframe[tf].count++;
    byTimeframe[tf].totalLoss += Math.abs(t.profit);
  });
  patterns.patterns.byTimeframe = byTimeframe;

  // 2. ขาดทุนตาม RSI range
  const byRSI = {
    oversold: { count: 0, totalLoss: 0 },  // < 30
    normal: { count: 0, totalLoss: 0 },    // 30-70
    overbought: { count: 0, totalLoss: 0 } // > 70
  };
  losses.forEach(t => {
    const rsi = t.metadata?.rsi_1m;
    if (!rsi) return;
    const loss = Math.abs(t.profit);
    if (rsi < 30) {
      byRSI.oversold.count++;
      byRSI.oversold.totalLoss += loss;
    } else if (rsi > 70) {
      byRSI.overbought.count++;
      byRSI.overbought.totalLoss += loss;
    } else {
      byRSI.normal.count++;
      byRSI.normal.totalLoss += loss;
    }
  });
  patterns.patterns.byRSI = byRSI;

  // 3. ขาดทุนตาม trend direction
  const byTrend = {
    uptrend: { count: 0, totalLoss: 0 },
    downtrend: { count: 0, totalLoss: 0 },
    sideways: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const trend = t.metadata?.trend_5m || 'sideways';
    const loss = Math.abs(t.profit);
    if (byTrend[trend]) {
      byTrend[trend].count++;
      byTrend[trend].totalLoss += loss;
    }
  });
  patterns.patterns.byTrend = byTrend;

  // 4. ขาดทุนตาม volatility
  const byVolatility = {
    low: { count: 0, totalLoss: 0 },
    normal: { count: 0, totalLoss: 0 },
    high: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const vol = t.metadata?.volatility || 'normal';
    const loss = Math.abs(t.profit);
    if (byVolatility[vol]) {
      byVolatility[vol].count++;
      byVolatility[vol].totalLoss += loss;
    }
  });
  patterns.patterns.byVolatility = byVolatility;

  // 5. ขาดทุนตาม side (LONG/SHORT)
  const bySide = {
    LONG: { count: 0, totalLoss: 0 },
    SHORT: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const side = t.type?.toUpperCase() || 'LONG';
    const loss = Math.abs(t.profit);
    bySide[side].count++;
    bySide[side].totalLoss += loss;
  });
  patterns.patterns.bySide = bySide;

  // 6. ขาดทุนตามช่วงเวลา (hour)
  const byHour = {};
  losses.forEach(t => {
    const hour = new Date(t.openTime).getHours();
    if (!byHour[hour]) byHour[hour] = { count: 0, totalLoss: 0 };
    byHour[hour].count++;
    byHour[hour].totalLoss += Math.abs(t.profit);
  });
  patterns.patterns.byHour = byHour;

  // 7. ขาดทุนตาม BTC correlation
  const byBtcCorr = {
    positive: { count: 0, totalLoss: 0 },  // BTC up, SOL up
    negative: { count: 0, totalLoss: 0 },  // BTC down, SOL down
    divergent: { count: 0, totalLoss: 0 }  // BTC/SOL move opposite
  };
  losses.forEach(t => {
    const btcTrend = t.metadata?.btc_trend_5m;
    const solTrend = t.metadata?.trend_5m;
    const loss = Math.abs(t.profit);
    
    if (!btcTrend || !solTrend) return;
    
    if (btcTrend === solTrend) {
      byBtcCorr.positive.count++;
      byBtcCorr.positive.totalLoss += loss;
    } else if ((btcTrend === 'uptrend' && solTrend === 'downtrend') ||
               (btcTrend === 'downtrend' && solTrend === 'uptrend')) {
      byBtcCorr.divergent.count++;
      byBtcCorr.divergent.totalLoss += loss;
    } else {
      byBtcCorr.negative.count++;
      byBtcCorr.negative.totalLoss += loss;
    }
  });
  patterns.patterns.byBtcCorr = byBtcCorr;

  // 8. ขาดทุนตาม sentiment
  const bySentiment = {
    extreme_fear: { count: 0, totalLoss: 0 },  // < 25
    fear: { count: 0, totalLoss: 0 },          // 25-45
    neutral: { count: 0, totalLoss: 0 },       // 45-55
    greed: { count: 0, totalLoss: 0 },         // 55-75
    extreme_greed: { count: 0, totalLoss: 0 }  // > 75
  };
  losses.forEach(t => {
    const fng = t.metadata?.fear_greed_index;
    if (!fng) return;
    const loss = Math.abs(t.profit);
    
    if (fng < 25) {
      bySentiment.extreme_fear.count++;
      bySentiment.extreme_fear.totalLoss += loss;
    } else if (fng < 45) {
      bySentiment.fear.count++;
      bySentiment.fear.totalLoss += loss;
    } else if (fng < 55) {
      bySentiment.neutral.count++;
      bySentiment.neutral.totalLoss += loss;
    } else if (fng < 75) {
      bySentiment.greed.count++;
      bySentiment.greed.totalLoss += loss;
    } else {
      bySentiment.extreme_greed.count++;
      bySentiment.extreme_greed.totalLoss += loss;
    }
  });
  patterns.patterns.bySentiment = bySentiment;

  // บันทึกผล
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(patterns, null, 2));

  // แสดงผล
  console.log('\n📊 LOSS PATTERNS FOUND:');
  console.log('─'.repeat(60));
  
  // หา pattern ที่มี loss มากที่สุด
  const insights = [];

  // RSI analysis
  const rsiWorst = Object.entries(byRSI)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (rsiWorst[1].count > 0) {
    insights.push(`🔴 RSI: Most losses in ${rsiWorst[0]} range (${rsiWorst[1].count} trades, ${rsiWorst[1].totalLoss.toFixed(2)} USDT)`);
  }

  // Trend analysis
  const trendWorst = Object.entries(byTrend)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (trendWorst[1].count > 0) {
    insights.push(`📉 Trend: Most losses during ${trendWorst[0]} (${trendWorst[1].count} trades, ${trendWorst[1].totalLoss.toFixed(2)} USDT)`);
  }

  // Volatility analysis
  const volWorst = Object.entries(byVolatility)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (volWorst[1].count > 0) {
    insights.push(`📊 Volatility: Most losses in ${volWorst[0]} volatility (${volWorst[1].count} trades, ${volWorst[1].totalLoss.toFixed(2)} USDT)`);
  }

  // Side analysis
  const sideWorst = Object.entries(bySide)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (sideWorst[1].count > 0) {
    const avgLoss = sideWorst[1].totalLoss / sideWorst[1].count;
    insights.push(`↕️ Side: ${sideWorst[0]} trades losing more (avg ${avgLoss.toFixed(2)} USDT per trade)`);
  }

  // Hour analysis - หา 3 ชม ที่ขาดทุนมากสุด
  const hoursSorted = Object.entries(byHour)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)
    .slice(0, 3);
  if (hoursSorted.length > 0) {
    const worstHours = hoursSorted.map(([h, d]) => `${h}:00 (${d.count} trades, ${d.totalLoss.toFixed(2)} USDT)`).join(', ');
    insights.push(`⏰ Time: Worst hours: ${worstHours}`);
  }

  // BTC correlation
  const btcWorst = Object.entries(byBtcCorr)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (btcWorst[1].count > 0) {
    insights.push(`₿ BTC Correlation: Most losses when ${btcWorst[0]} (${btcWorst[1].count} trades, ${btcWorst[1].totalLoss.toFixed(2)} USDT)`);
  }

  // Sentiment analysis
  const sentWorst = Object.entries(bySentiment)
    .filter(([k, v]) => v.count > 0)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (sentWorst && sentWorst[1].count > 0) {
    insights.push(`😱 Sentiment: Most losses during ${sentWorst[0]} (${sentWorst[1].count} trades, ${sentWorst[1].totalLoss.toFixed(2)} USDT)`);
  }

  insights.forEach(i => console.log(`   ${i}`));

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('─'.repeat(60));

  // สร้างคำแนะนำจาก patterns
  const recommendations = generateRecommendations(patterns);
  recommendations.forEach(r => console.log(`   ${r}`));

  console.log('\n✅ Analysis saved to:', OUTPUT_FILE);
  console.log('='.repeat(60));

  return patterns;
}

function generateRecommendations(patterns) {
  const recs = [];
  const { byRSI, byTrend, byVolatility, bySide, byHour, byBtcCorr, bySentiment } = patterns.patterns;

  // RSI recommendations
  const rsiLossRates = Object.entries(byRSI).map(([k, v]) => ({
    range: k,
    lossRate: v.count > 0 ? v.totalLoss / v.count : 0,
    count: v.count
  })).sort((a, b) => b.lossRate - a.lossRate);

  if (rsiLossRates[0].count >= 3 && rsiLossRates[0].lossRate > 5) {
    recs.push(`⚠️ Avoid trading when RSI is ${rsiLossRates[0].range} (avg loss ${rsiLossRates[0].lossRate.toFixed(2)} USDT)`);
  }

  // Volatility recommendations
  const volLossRates = Object.entries(byVolatility).map(([k, v]) => ({
    vol: k,
    lossRate: v.count > 0 ? v.totalLoss / v.count : 0,
    count: v.count
  })).sort((a, b) => b.lossRate - a.lossRate);

  if (volLossRates[0].count >= 3 && volLossRates[0].lossRate > 5) {
    recs.push(`⚠️ Be careful in ${volLossRates[0].vol} volatility (avg loss ${volLossRates[0].lossRate.toFixed(2)} USDT)`);
  }

  // Side recommendations
  if (bySide.LONG.count > 0 && bySide.SHORT.count > 0) {
    const longAvg = bySide.LONG.totalLoss / bySide.LONG.count;
    const shortAvg = bySide.SHORT.totalLoss / bySide.SHORT.count;
    if (Math.abs(longAvg - shortAvg) > 2) {
      const worse = longAvg > shortAvg ? 'LONG' : 'SHORT';
      recs.push(`⚠️ ${worse} positions losing more (avg ${Math.max(longAvg, shortAvg).toFixed(2)} vs ${Math.min(longAvg, shortAvg).toFixed(2)} USDT)`);
    }
  }

  // Hour recommendations
  const hourLossRates = Object.entries(byHour).map(([k, v]) => ({
    hour: parseInt(k),
    lossRate: v.totalLoss / v.count,
    count: v.count
  })).sort((a, b) => b.lossRate - a.lossRate);

  const dangerousHours = hourLossRates.filter(h => h.count >= 2 && h.lossRate > 5).slice(0, 3);
  if (dangerousHours.length > 0) {
    const hours = dangerousHours.map(h => `${h.hour}:00`).join(', ');
    recs.push(`⏰ Avoid trading at: ${hours}`);
  }

  // BTC correlation recommendations
  const btcWorst = Object.entries(byBtcCorr)
    .map(([k, v]) => ({ type: k, avg: v.count > 0 ? v.totalLoss / v.count : 0, count: v.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  
  if (btcWorst.count >= 3 && btcWorst.avg > 5) {
    recs.push(`₿ Avoid trading when BTC/SOL correlation is ${btcWorst.type}`);
  }

  // Sentiment recommendations
  const sentWorst = Object.entries(bySentiment)
    .filter(([k, v]) => v.count > 0)
    .map(([k, v]) => ({ sentiment: k, avg: v.totalLoss / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  
  if (sentWorst && sentWorst.count >= 2 && sentWorst.avg > 5) {
    recs.push(`😱 Avoid trading during ${sentWorst.sentiment} sentiment`);
  }

  if (recs.length === 0) {
    recs.push('✅ No clear loss patterns detected yet. Keep trading to gather more data.');
  }

  return recs;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeLosses();
}

export { analyzeLosses };
