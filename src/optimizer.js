// Strategy optimizer - analyzes performance and suggests improvements
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const logsDir = path.join(__dirname, '..', 'logs');

function analyze() {
  console.log('\n🧠 STRATEGY OPTIMIZER');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
  
  // Load state
  const statePath = path.join(dataDir, 'paper_state.json');
  if (!fs.existsSync(statePath)) {
    console.log('❌ No trading data found.');
    return null;
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  const trades = state.trades || [];
  
  if (trades.length < 3) {
    console.log('⏳ Not enough trades yet for optimization (need at least 3)');
    return null;
  }

  // Calculate current performance
  const wins = trades.filter(t => t.profit > 0);
  const winRate = (wins.length / trades.length * 100);
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);

  console.log(`\n📊 Current Performance:`);
  console.log(`   Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`   Total P/L: ${totalProfit.toFixed(2)} USDT`);
  console.log(`   Total Trades: ${trades.length}`);

  // Analyze trade patterns
  const recentTrades = trades.slice(-10);
  const recentWinRate = recentTrades.filter(t => t.profit > 0).length / recentTrades.length * 100;
  
  console.log(`\n📈 Recent Performance (Last 10):`);
  console.log(`   Win Rate: ${recentWinRate.toFixed(1)}%`);

  // Generate suggestions based on performance
  const suggestions = [];
  const currentParams = { ...config.strategy.params };

  // If win rate is low, adjust RSI thresholds
  if (winRate < 40) {
    suggestions.push({
      type: 'parameter',
      field: 'rsiOversold',
      oldValue: currentParams.rsiOversold,
      newValue: Math.max(20, currentParams.rsiOversold - 5),
      reason: 'Low win rate - making buy signals more conservative'
    });
    suggestions.push({
      type: 'parameter',
      field: 'rsiOverbought',
      oldValue: currentParams.rsiOverbought,
      newValue: Math.min(80, currentParams.rsiOverbought + 5),
      reason: 'Low win rate - making sell signals more conservative'
    });
  }

  // If we're losing on average, tighten stop loss
  const avgProfit = totalProfit / trades.length;
  if (avgProfit < 0) {
    suggestions.push({
      type: 'trading',
      field: 'stopLossPercent',
      oldValue: config.trading.stopLossPercent,
      newValue: Math.max(1, config.trading.stopLossPercent - 0.5),
      reason: 'Negative average P/L - tightening stop loss'
    });
  }

  // If recent performance is worse than overall, consider reversing signals
  if (recentWinRate < winRate - 20) {
    suggestions.push({
      type: 'observation',
      message: 'Recent performance significantly worse - market conditions may have changed',
      action: 'Consider pausing or reducing position size'
    });
  }

  // Log suggestions
  if (suggestions.length > 0) {
    console.log(`\n💡 Optimization Suggestions:`);
    for (const s of suggestions) {
      if (s.type === 'observation') {
        console.log(`   ⚠️ ${s.message}`);
        console.log(`      → ${s.action}`);
      } else {
        console.log(`   • ${s.field}: ${s.oldValue} → ${s.newValue}`);
        console.log(`     Reason: ${s.reason}`);
      }
    }
  } else {
    console.log(`\n✅ Performance is acceptable. No changes needed.`);
  }

  // Save optimization log
  const optLog = {
    timestamp: new Date().toISOString(),
    winRate,
    recentWinRate,
    totalProfit,
    trades: trades.length,
    suggestions,
    currentParams,
  };
  
  const optLogFile = path.join(logsDir, 'optimizations.jsonl');
  fs.appendFileSync(optLogFile, JSON.stringify(optLog) + '\n');

  console.log('\n' + '='.repeat(60));
  
  return { winRate, suggestions };
}

// Auto-apply safe suggestions
function autoOptimize() {
  const result = analyze();
  
  // Sync to self-learning skill after every optimization (async, don't block)
  console.log('\n🧠 Syncing to self-learning skill...');
  import('child_process').then(({ spawn }) => {
    const proc = spawn('node', ['src/sync-to-learning.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore', // Run silently in background
      detached: true
    });
    proc.unref();
    console.log('   ✅ Sync started in background');
  }).catch(error => {
    console.log(`   ⚠️ Sync failed: ${error.message}`);
  });
  
  if (!result || !result.suggestions || result.suggestions.length === 0) {
    return;
  }

  // Only auto-apply parameter changes if win rate is really bad
  if (result.winRate < 30 && result.suggestions.length > 0) {
    console.log('\n🔧 AUTO-OPTIMIZATION TRIGGERED (win rate < 30%)');
    
    // Load and update config (in memory only for now)
    const updates = result.suggestions.filter(s => s.type === 'parameter');
    if (updates.length > 0) {
      console.log('   Would apply:', updates.map(u => `${u.field}: ${u.newValue}`).join(', '));
      console.log('   (Auto-apply disabled for safety - review manually)');
    }
  }
}

// Run if called directly
autoOptimize();

export { analyze, autoOptimize };
