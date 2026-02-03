#!/usr/bin/env node

// Test script for sentiment monitoring
import { checkSentimentAlerts, getSentimentHistory } from '../src/sentiment-monitor.js';

async function test() {
  console.log('🧪 Testing Sentiment Monitor\n');
  
  console.log('1️⃣ Checking current sentiment alerts...\n');
  
  const result = await checkSentimentAlerts('BTC/USDT');
  
  if (result.error) {
    console.error('❌ Error:', result.error);
    return;
  }
  
  // Display current sentiment
  console.log('📊 Current Sentiment:');
  console.log(`   Score: ${result.sentiment.score}/100`);
  console.log(`   Classification: ${result.sentiment.classification}`);
  console.log(`   Fear & Greed: ${result.sentiment.fearGreed.value}/100 (${result.sentiment.fearGreed.classification})`);
  console.log(`   News Score: ${result.sentiment.newsScore.value}/100`);
  console.log(`   Summary: ${result.sentiment.summary}\n`);
  
  // Display alerts if any
  if (result.alerts.length > 0) {
    console.log(`🚨 ALERTS DETECTED (${result.alerts.length}):\n`);
    for (const alert of result.alerts) {
      console.log(`   [${alert.severity}] ${alert.type}`);
      console.log(`   ${alert.message}`);
      console.log(`   → ${alert.action}\n`);
    }
  } else {
    console.log('✅ No alerts detected.\n');
  }
  
  // Display pause decision
  if (result.pauseDecision.pause) {
    console.log('⏸️  TRADING PAUSE RECOMMENDED:');
    console.log(`   Reason: ${result.pauseDecision.reason}`);
    console.log(`   Duration: ${result.pauseDecision.duration} minutes`);
    console.log(`   ${result.pauseDecision.message}\n`);
  } else {
    console.log('✅ Trading allowed (no pause).\n');
  }
  
  // Display history
  console.log('📜 Recent History:');
  console.log(`   Total data points: ${result.history.total}`);
  console.log(`   Latest 5 scores:`);
  for (const h of result.history.latest) {
    const date = new Date(h.timestamp);
    console.log(`     ${date.toLocaleTimeString()}: ${h.score}/100 (${h.classification})`);
  }
  
  console.log('\n2️⃣ Getting 24h history...\n');
  const history24h = await getSentimentHistory(24);
  console.log(`   Found ${history24h.length} data points in last 24 hours`);
  
  if (history24h.length > 1) {
    const oldest = history24h[0];
    const newest = history24h[history24h.length - 1];
    const change = newest.score - oldest.score;
    console.log(`   24h change: ${change > 0 ? '+' : ''}${change} points (${oldest.score} → ${newest.score})`);
  }
  
  console.log('\n✅ Test complete!');
}

test().catch(console.error);
