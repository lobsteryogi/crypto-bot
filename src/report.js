// Report generator - produces summary of trading performance
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradeDB } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const logsDir = path.join(__dirname, '..', 'logs');

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CRYPTO BOT TRADING REPORT');
  console.log('='.repeat(60));
  console.log(`Generated: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
  console.log('');

  // Load data from SQLite
  const trades = TradeDB.getAllTrades().filter(t => t.closed_at !== null);
  const positions = TradeDB.getPositions();
  const balance = TradeDB.getBalance();
  const initialBalance = 10000; // From config

  if (trades.length === 0 && positions.length === 0) {
    console.log('❌ No trading data found. Bot may not have run yet.');
    return null;
  }

  // Calculate margin locked in positions
  const marginLocked = positions.reduce((sum, p) => sum + (p.margin || 0), 0);
  const totalEquity = balance + marginLocked;

  // Calculate stats
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length * 100) : 0;
  const roi = ((totalEquity - initialBalance) / initialBalance * 100);

  console.log('💰 ACCOUNT SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Initial Balance:  ${initialBalance.toFixed(2)} USDT`);
  console.log(`Available:        ${balance.toFixed(2)} USDT`);
  console.log(`Margin Locked:    ${marginLocked.toFixed(2)} USDT (${positions.length} positions)`);
  console.log(`Total Equity:     ${totalEquity.toFixed(2)} USDT`);
  console.log(`Realized P/L:     ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} USDT`);
  console.log(`ROI:              ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`);
  console.log('');

  console.log('📈 TRADING STATS');
  console.log('-'.repeat(40));
  console.log(`Total Trades:     ${trades.length}`);
  console.log(`Wins:             ${wins.length} (${winRate.toFixed(1)}%)`);
  console.log(`Losses:           ${losses.length} (${(100 - winRate).toFixed(1)}%)`);
  console.log(`Open Positions:   ${positions.length}`);
  console.log('');

  if (trades.length > 0) {
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const bestTrade = trades.reduce((best, t) => t.pnl > best.pnl ? t : best, trades[0]);
    const worstTrade = trades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, trades[0]);

    console.log('📊 TRADE ANALYSIS');
    console.log('-'.repeat(40));
    console.log(`Avg Win:          +${avgWin.toFixed(2)} USDT`);
    console.log(`Avg Loss:         ${avgLoss.toFixed(2)} USDT`);
    console.log(`Best Trade:       +${bestTrade.pnl.toFixed(2)} USDT (${bestTrade.pnl_percent.toFixed(2)}%)`);
    console.log(`Worst Trade:      ${worstTrade.pnl.toFixed(2)} USDT (${worstTrade.pnl_percent.toFixed(2)}%)`);
    console.log('');
  }

  // Recent trades
  if (trades.length > 0) {
    console.log('📋 RECENT TRADES (Last 5)');
    console.log('-'.repeat(40));
    const recentTrades = trades.slice(-5).reverse();
    for (const t of recentTrades) {
      const emoji = t.pnl > 0 ? '🟢' : '🔴';
      const time = new Date(t.closed_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      console.log(`${emoji} ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)} USDT (${t.pnl_percent.toFixed(1)}%) - ${time}`);
    }
    console.log('');
  }

  // Open positions
  if (positions.length > 0) {
    console.log('📦 OPEN POSITIONS');
    console.log('-'.repeat(40));
    for (const p of positions) {
      const time = new Date(p.opened_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      console.log(`• ${p.symbol}: ${p.amount.toFixed(6)} @ ${p.entry_price.toFixed(2)} USDT (${time})`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('🤖 Build → Trade → Evaluate → Repeat');
  console.log('='.repeat(60));

  return {
    balance,
    totalEquity,
    marginLocked,
    totalProfit,
    winRate,
    roi,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    openPositions: positions.length,
  };
}

// Run if called directly
const report = generateReport();

export { generateReport };
