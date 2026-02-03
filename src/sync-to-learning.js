#!/usr/bin/env node
/**
 * Sync paper trading data to crypto-self-learning skill
 * Reads data/paper_state.json and logs trades to self-learning system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAPER_STATE_PATH = path.join(__dirname, '..', 'data', 'paper_state.json');
const LEARNING_SKILL_PATH = '/root/.openclaw/workspace/skills/crypto-self-learning';
const SYNC_STATE_PATH = path.join(__dirname, '..', 'data', 'last_synced_trade.txt');

async function loadPaperState() {
  if (!fs.existsSync(PAPER_STATE_PATH)) {
    throw new Error(`Paper state file not found: ${PAPER_STATE_PATH}`);
  }
  const data = fs.readFileSync(PAPER_STATE_PATH, 'utf8');
  return JSON.parse(data);
}

function getLastSyncedTradeId() {
  if (!fs.existsSync(SYNC_STATE_PATH)) {
    return null;
  }
  return fs.readFileSync(SYNC_STATE_PATH, 'utf8').trim();
}

function saveLastSyncedTradeId(tradeId) {
  fs.writeFileSync(SYNC_STATE_PATH, tradeId);
}

async function logTradeToLearningSkill(trade) {
  // Build command for logging trade
  const symbol = trade.symbol.replace('/', '');
  const direction = trade.type === 'short' ? 'SHORT' : 'LONG';
  const entry = trade.entryPrice;
  const exit = trade.exitPrice;
  const pnl = trade.profitPercent;
  const leverage = trade.leverage || 1;
  const reason = trade.reason || 'No reason provided';
  const result = trade.profit > 0 ? 'WIN' : 'LOSS';

  // Build indicators JSON
  const indicators = trade.indicators || {};
  const indicatorsJson = JSON.stringify(indicators).replace(/"/g, '\\"');

  // Build market context JSON
  const marketContext = {
    timestamp: trade.closeTime,
    hour: new Date(trade.closeTime).getUTCHours(),
    day: new Date(trade.closeTime).toLocaleDateString('en-US', { weekday: 'long' }),
  };
  const marketContextJson = JSON.stringify(marketContext).replace(/"/g, '\\"');

  const cmd = `python3 ${LEARNING_SKILL_PATH}/scripts/log_trade.py \\
    --symbol ${symbol} \\
    --direction ${direction} \\
    --entry ${entry} \\
    --exit ${exit} \\
    --pnl_percent ${pnl.toFixed(2)} \\
    --leverage ${leverage} \\
    --reason "${reason}" \\
    --indicators "${indicatorsJson}" \\
    --market_context "${marketContextJson}" \\
    --result ${result}`;

  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) {
      console.error(`⚠️ Warning while logging trade: ${stderr}`);
    }
    return { success: true, output: stdout };
  } catch (error) {
    console.error(`❌ Failed to log trade: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 Starting sync to crypto-self-learning...\n');

  // Load paper state
  const state = await loadPaperState();
  const allTrades = state.trades || [];
  
  if (allTrades.length === 0) {
    console.log('⚠️ No trades found in paper state.');
    return;
  }

  // Get last synced trade ID
  const lastSyncedId = getLastSyncedTradeId();
  
  // Find trades to sync (after last synced ID)
  let tradesToSync = [];
  if (lastSyncedId) {
    const lastSyncedIndex = allTrades.findIndex(t => t.id === lastSyncedId);
    if (lastSyncedIndex !== -1) {
      tradesToSync = allTrades.slice(lastSyncedIndex + 1);
    } else {
      console.log('⚠️ Last synced trade not found. Syncing all trades...');
      tradesToSync = allTrades;
    }
  } else {
    console.log('📝 First sync - syncing all trades...');
    tradesToSync = allTrades;
  }

  // Filter only closed trades
  tradesToSync = tradesToSync.filter(t => t.exitPrice && t.closeTime);

  if (tradesToSync.length === 0) {
    console.log('✅ No new trades to sync.');
    return;
  }

  console.log(`📊 Found ${tradesToSync.length} new trades to sync.\n`);

  // Sync each trade
  let synced = 0;
  let failed = 0;

  for (const trade of tradesToSync) {
    const result = await logTradeToLearningSkill(trade);
    if (result.success) {
      synced++;
      console.log(`✅ Synced trade ${trade.id}: ${trade.symbol} ${trade.type} ${trade.profitPercent > 0 ? 'WIN' : 'LOSS'} (${trade.profitPercent.toFixed(2)}%)`);
      saveLastSyncedTradeId(trade.id);
    } else {
      failed++;
      console.error(`❌ Failed to sync trade ${trade.id}`);
    }
  }

  console.log(`\n📊 Sync complete: ${synced} synced, ${failed} failed`);
  
  // Run analysis after sync
  if (synced > 0) {
    console.log('\n🧠 Running analysis on updated data...\n');
    try {
      const { stdout } = await execAsync(`python3 ${LEARNING_SKILL_PATH}/scripts/analyze.py`);
      console.log(stdout);
    } catch (error) {
      console.error(`⚠️ Analysis failed: ${error.message}`);
    }
  }
}

main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
