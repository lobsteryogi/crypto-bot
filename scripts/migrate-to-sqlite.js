// Migration script: JSON to SQLite
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradeDB } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'data', 'paper_state.json');

async function migrate() {
  console.log('🔄 Starting migration from JSON to SQLite...\n');
  
  // Check if state file exists
  if (!fs.existsSync(STATE_FILE)) {
    console.log('❌ No paper_state.json found. Nothing to migrate.');
    return;
  }
  
  // Load JSON state
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  console.log(`📂 Loaded JSON state:`);
  console.log(`   Balance: ${state.balance} USDT`);
  console.log(`   Positions: ${Object.keys(state.positions || {}).length}`);
  console.log(`   Trades: ${state.tradesHistory?.length || 0}`);
  console.log('');
  
  // Migrate balance
  TradeDB.setBalance(state.balance);
  console.log('✅ Migrated balance');
  
  // Migrate martingale streak
  if (state.martingaleStreak) {
    TradeDB.setMartingaleStreak(state.martingaleStreak);
    console.log('✅ Migrated martingale streak');
  }
  
  // Migrate RSI params
  if (state.optimizedRsi) {
    TradeDB.setRsiParams(state.optimizedRsi.oversold, state.optimizedRsi.overbought);
    console.log(`✅ Migrated RSI params: ${state.optimizedRsi.oversold}/${state.optimizedRsi.overbought}`);
  }
  
  // Migrate blocked hours
  if (state.blockedHours?.length > 0) {
    TradeDB.setBlockedHours(state.blockedHours);
    console.log(`✅ Migrated blocked hours: ${state.blockedHours.join(', ')}`);
  }
  
  // Migrate open positions
  const positions = state.positions || [];
  let posCount = 0;
  
  // Handle both array and object format
  const posArray = Array.isArray(positions) ? positions : Object.values(positions).flat();
  
  for (const pos of posArray) {
    if (!pos || !pos.symbol) continue;
    const side = (pos.side || pos.type || '').toUpperCase();
    if (!side) continue;
    
    TradeDB.openPosition({
      symbol: pos.symbol,
      side: side,
      entryPrice: pos.entryPrice,
      amount: pos.amount,
      leverage: pos.leverage || 1,
      margin: pos.cost || pos.margin,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      reason: pos.reason,
    });
    posCount++;
  }
  console.log(`✅ Migrated ${posCount} open positions`);
  
  // Migrate trades history
  const trades = state.tradesHistory || [];
  let tradeCount = 0;
  
  // Use raw db for batch insert
  const insertTrade = TradeDB.raw.prepare(`
    INSERT INTO trades (symbol, side, entry_price, exit_price, amount, leverage, margin, 
                        pnl, pnl_percent, result, reason, exit_reason, opened_at, closed_at, hour_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const batchInsert = TradeDB.raw.transaction((trades) => {
    for (const trade of trades) {
      const closedAt = trade.closedAt || trade.timestamp || new Date().toISOString();
      const hour = new Date(closedAt).getUTCHours();
      
      insertTrade.run(
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice,
        trade.amount,
        trade.leverage || 1,
        trade.margin,
        trade.profit || trade.pnl || 0,
        trade.profitPercent || trade.pnlPercent || 0,
        (trade.profit || trade.pnl || 0) > 0 ? 'WIN' : 'LOSS',
        trade.reason || null,
        trade.exitReason || null,
        trade.openedAt || trade.timestamp || closedAt,
        closedAt,
        hour
      );
      tradeCount++;
    }
  });
  
  batchInsert(trades);
  console.log(`✅ Migrated ${tradeCount} trades`);
  
  // Verify
  console.log('\n📊 Verification:');
  const stats = TradeDB.getTradeStats();
  console.log(`   Total trades: ${stats.total}`);
  console.log(`   Wins: ${stats.wins} | Losses: ${stats.losses}`);
  console.log(`   Win rate: ${(stats.wins / stats.total * 100).toFixed(1)}%`);
  console.log(`   Total P/L: ${stats.total_pnl?.toFixed(2)} USDT`);
  
  const dbPositions = TradeDB.getPositions();
  console.log(`   Open positions: ${dbPositions.length}`);
  console.log(`   Balance: ${TradeDB.getBalance()} USDT`);
  
  // Rename old file
  const backupPath = STATE_FILE.replace('.json', '.json.bak');
  fs.renameSync(STATE_FILE, backupPath);
  console.log(`\n📁 Backed up old file to: paper_state.json.bak`);
  
  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
