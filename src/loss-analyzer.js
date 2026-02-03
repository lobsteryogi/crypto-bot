#!/usr/bin/env node
/**
 * Loss Pattern Analyzer
 * Analyzes losing trades to find patterns that cause losses.
 * Uses SQLite database for trade data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradeDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../data/loss-patterns.json');

/**
 * Load trades from SQLite database
 * @returns {Object[]} List of trades
 */
function loadTrades() {
  try {
    return TradeDB.getAllTrades();
  } catch (error) {
    console.error('Failed to load trades from DB:', error.message);
    return [];
  }
}

/**
 * Analyze losing trades and identify patterns
 * @returns {Object|null} Loss patterns analysis or null if insufficient data
 */
function analyzeLosses() {
  const trades = loadTrades();
  // SQLite uses 'pnl' field instead of 'profit'
  const losses = trades.filter(t => t.pnl !== undefined && t.pnl < 0);
  
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
    totalLossAmount: losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0),
    avgLoss: losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losses.length,
    patterns: {}
  };

  // 1. Losses by symbol
  const bySymbol = {};
  losses.forEach(t => {
    const symbol = t.symbol || 'unknown';
    if (!bySymbol[symbol]) bySymbol[symbol] = { count: 0, totalLoss: 0 };
    bySymbol[symbol].count++;
    bySymbol[symbol].totalLoss += Math.abs(t.pnl);
  });
  patterns.patterns.bySymbol = bySymbol;

  // 2. Losses by RSI range (using stored RSI in trades table)
  const byRSI = {
    oversold: { count: 0, totalLoss: 0 },  // < 30
    normal: { count: 0, totalLoss: 0 },    // 30-70
    overbought: { count: 0, totalLoss: 0 } // > 70
  };
  losses.forEach(t => {
    const rsi = t.rsi;  // SQLite field
    if (!rsi) return;
    const loss = Math.abs(t.pnl);
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

  // 3. Losses by trend direction
  const byTrend = {
    uptrend: { count: 0, totalLoss: 0 },
    downtrend: { count: 0, totalLoss: 0 },
    sideways: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const trend = t.trend || 'sideways';  // SQLite field
    const loss = Math.abs(t.pnl);
    if (byTrend[trend]) {
      byTrend[trend].count++;
      byTrend[trend].totalLoss += loss;
    }
  });
  patterns.patterns.byTrend = byTrend;

  // 4. Losses by volatility
  const byVolatility = {
    low: { count: 0, totalLoss: 0 },
    normal: { count: 0, totalLoss: 0 },
    high: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const volMult = t.volatility_multiplier || 1;
    const vol = volMult < 0.8 ? 'low' : volMult > 1.3 ? 'high' : 'normal';
    const loss = Math.abs(t.pnl);
    byVolatility[vol].count++;
    byVolatility[vol].totalLoss += loss;
  });
  patterns.patterns.byVolatility = byVolatility;

  // 5. Losses by side (LONG/SHORT)
  const bySide = {
    LONG: { count: 0, totalLoss: 0 },
    SHORT: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const side = t.side || 'LONG';  // SQLite uses 'side' not 'type'
    const loss = Math.abs(t.pnl);
    if (bySide[side]) {
      bySide[side].count++;
      bySide[side].totalLoss += loss;
    }
  });
  patterns.patterns.bySide = bySide;

  // 6. Losses by hour (using hour_utc from SQLite)
  const byHour = {};
  losses.forEach(t => {
    const hour = t.hour_utc ?? new Date(t.opened_at).getUTCHours();
    if (!byHour[hour]) byHour[hour] = { count: 0, totalLoss: 0 };
    byHour[hour].count++;
    byHour[hour].totalLoss += Math.abs(t.pnl);
  });
  patterns.patterns.byHour = byHour;

  // 7. Losses by BTC momentum
  const byBtcMomentum = {
    bullish: { count: 0, totalLoss: 0 },
    bearish: { count: 0, totalLoss: 0 },
    neutral: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    const btc = t.btc_momentum || 'neutral';
    const loss = Math.abs(t.pnl);
    if (byBtcMomentum[btc]) {
      byBtcMomentum[btc].count++;
      byBtcMomentum[btc].totalLoss += loss;
    }
  });
  patterns.patterns.byBtcMomentum = byBtcMomentum;

  // 8. Losses by sentiment
  const bySentiment = {
    extreme_fear: { count: 0, totalLoss: 0 },
    fear: { count: 0, totalLoss: 0 },
    neutral: { count: 0, totalLoss: 0 },
    greed: { count: 0, totalLoss: 0 },
    extreme_greed: { count: 0, totalLoss: 0 }
  };
  losses.forEach(t => {
    if (!t.sentiment) return;
    const sent = t.sentiment.toLowerCase().replace(' ', '_');
    const loss = Math.abs(t.pnl);
    if (bySentiment[sent]) {
      bySentiment[sent].count++;
      bySentiment[sent].totalLoss += loss;
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

  // BTC momentum analysis
  const btcWorst = Object.entries(byBtcMomentum)
    .sort((a, b) => b[1].totalLoss - a[1].totalLoss)[0];
  if (btcWorst[1].count > 0) {
    insights.push(`₿ BTC Momentum: Most losses during ${btcWorst[0]} (${btcWorst[1].count} trades, ${btcWorst[1].totalLoss.toFixed(2)} USDT)`);
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
  const { byRSI, byTrend, byVolatility, bySide, byHour, byBtcMomentum, bySentiment } = patterns.patterns;

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

  // BTC momentum recommendations
  const btcWorstRec = Object.entries(byBtcMomentum)
    .map(([k, v]) => ({ type: k, avg: v.count > 0 ? v.totalLoss / v.count : 0, count: v.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  
  if (btcWorstRec.count >= 3 && btcWorstRec.avg > 5) {
    recs.push(`₿ Avoid trading when BTC momentum is ${btcWorstRec.type}`);
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
