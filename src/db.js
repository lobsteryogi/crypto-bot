/**
 * SQLite Database for Crypto Bot
 * Handles all database operations for positions, trades, and state.
 * @module TradeDB
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'trades.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better concurrent access

// Create tables
db.exec(`
  -- Trading state
  CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Trades history
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price REAL NOT NULL,
    exit_price REAL,
    amount REAL NOT NULL,
    leverage INTEGER DEFAULT 1,
    margin REAL,
    stop_loss REAL,
    take_profit REAL,
    pnl REAL,
    pnl_percent REAL,
    result TEXT CHECK (result IN ('WIN', 'LOSS', NULL)),
    reason TEXT,
    exit_reason TEXT,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    
    -- Context for learning
    rsi REAL,
    macd_histogram REAL,
    trend TEXT,
    volatility_multiplier REAL,
    btc_momentum TEXT,
    sentiment TEXT,
    hour_utc INTEGER
  );

  -- Open positions
  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price REAL NOT NULL,
    amount REAL NOT NULL,
    leverage INTEGER DEFAULT 1,
    margin REAL,
    stop_loss REAL,
    take_profit REAL,
    highest_price REAL,
    lowest_price REAL,
    trailing_active INTEGER DEFAULT 0,
    reason TEXT,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Context
    rsi REAL,
    trend TEXT,
    volatility_multiplier REAL
  );

  -- Optimized parameters
  CREATE TABLE IF NOT EXISTS params (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Blocked hours
  CREATE TABLE IF NOT EXISTS blocked_hours (
    hour_utc INTEGER PRIMARY KEY,
    reason TEXT,
    avg_loss REAL,
    trade_count INTEGER,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);
  CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at);
  CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
`);

// Prepared statements for performance
const stmts = {
  // State
  getState: db.prepare('SELECT value FROM state WHERE key = ?'),
  setState: db.prepare('INSERT OR REPLACE INTO state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'),
  
  // Positions
  getPositions: db.prepare('SELECT * FROM positions'),
  getPositionsBySymbol: db.prepare('SELECT * FROM positions WHERE symbol = ?'),
  insertPosition: db.prepare(`
    INSERT INTO positions (symbol, side, entry_price, amount, leverage, margin, stop_loss, take_profit, reason, rsi, trend, volatility_multiplier)
    VALUES (@symbol, @side, @entry_price, @amount, @leverage, @margin, @stop_loss, @take_profit, @reason, @rsi, @trend, @volatility_multiplier)
  `),
  updatePosition: db.prepare(`
    UPDATE positions SET 
      highest_price = @highest_price,
      lowest_price = @lowest_price,
      trailing_active = @trailing_active,
      stop_loss = @stop_loss
    WHERE id = @id
  `),
  deletePosition: db.prepare('DELETE FROM positions WHERE id = ?'),
  
  // Trades
  insertTrade: db.prepare(`
    INSERT INTO trades (symbol, side, entry_price, exit_price, amount, leverage, margin, stop_loss, take_profit, 
                        pnl, pnl_percent, result, reason, exit_reason, opened_at, closed_at,
                        rsi, macd_histogram, trend, volatility_multiplier, btc_momentum, sentiment, hour_utc)
    VALUES (@symbol, @side, @entry_price, @exit_price, @amount, @leverage, @margin, @stop_loss, @take_profit,
            @pnl, @pnl_percent, @result, @reason, @exit_reason, @opened_at, @closed_at,
            @rsi, @macd_histogram, @trend, @volatility_multiplier, @btc_momentum, @sentiment, @hour_utc)
  `),
  getRecentTrades: db.prepare('SELECT * FROM trades ORDER BY closed_at DESC LIMIT ?'),
  getTradeStats: db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) as losses,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl
    FROM trades
  `),
  getTradesBySymbol: db.prepare('SELECT * FROM trades WHERE symbol = ? ORDER BY closed_at DESC'),
  
  // Params
  getParam: db.prepare('SELECT value FROM params WHERE key = ?'),
  setParam: db.prepare('INSERT OR REPLACE INTO params (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'),
  
  // Blocked hours
  getBlockedHours: db.prepare('SELECT hour_utc FROM blocked_hours'),
  setBlockedHour: db.prepare('INSERT OR REPLACE INTO blocked_hours (hour_utc, reason, avg_loss, trade_count) VALUES (?, ?, ?, ?)'),
  clearBlockedHours: db.prepare('DELETE FROM blocked_hours'),
};

/**
 * Database API for crypto trading bot
 * @namespace TradeDB
 */
export const TradeDB = {
  /**
   * Get current trading balance
   * @returns {number} Current balance in USDT
   */
  getBalance() {
    const row = stmts.getState.get('balance');
    return row ? parseFloat(row.value) : 10000;
  },
  
  /**
   * Set trading balance
   * @param {number} balance - New balance in USDT
   */
  setBalance(balance) {
    stmts.setState.run('balance', balance.toString());
  },
  
  /**
   * Get current Martingale streak count
   * @returns {number} Current streak count
   */
  getMartingaleStreak() {
    const row = stmts.getState.get('martingale_streak');
    return row ? parseInt(row.value) : 0;
  },
  
  /**
   * Set Martingale streak count
   * @param {number} streak - New streak count
   */
  setMartingaleStreak(streak) {
    stmts.setState.run('martingale_streak', streak.toString());
  },
  
  /**
   * Get all open positions
   * @returns {Object[]} Array of position objects
   */
  getPositions() {
    return stmts.getPositions.all();
  },
  
  /**
   * Get positions for a specific trading pair
   * @param {string} symbol - Trading pair (e.g., 'SOL/USDT')
   * @returns {Object[]} Array of position objects
   */
  getPositionsBySymbol(symbol) {
    return stmts.getPositionsBySymbol.all(symbol);
  },
  
  /**
   * Open a new position
   * @param {Object} position - Position data
   * @param {string} position.symbol - Trading pair
   * @param {'LONG'|'SHORT'} position.side - Position direction
   * @param {number} position.entryPrice - Entry price
   * @param {number} position.amount - Position size
   * @param {number} [position.leverage=1] - Leverage multiplier
   * @param {number} [position.margin] - Margin used
   * @param {number} [position.stopLoss] - Stop loss price
   * @param {number} [position.takeProfit] - Take profit price
   * @param {string} [position.reason] - Trade reason
   * @returns {number} New position ID
   */
  openPosition(position) {
    const result = stmts.insertPosition.run({
      symbol: position.symbol,
      side: position.side,
      entry_price: position.entryPrice,
      amount: position.amount,
      leverage: position.leverage || 1,
      margin: position.margin,
      stop_loss: position.stopLoss,
      take_profit: position.takeProfit,
      reason: position.reason,
      rsi: position.rsi || null,
      trend: position.trend || null,
      volatility_multiplier: position.volatilityMultiplier || null,
    });
    return result.lastInsertRowid;
  },
  
  /**
   * Update position data (for trailing stops, etc.)
   * @param {number} id - Position ID
   * @param {Object} updates - Fields to update
   * @param {number} [updates.highestPrice] - New highest price
   * @param {number} [updates.lowestPrice] - New lowest price
   * @param {boolean} [updates.trailingActive] - Trailing stop active flag
   * @param {number} [updates.stopLoss] - New stop loss price
   */
  updatePosition(id, updates) {
    stmts.updatePosition.run({
      id,
      highest_price: updates.highestPrice,
      lowest_price: updates.lowestPrice,
      trailing_active: updates.trailingActive ? 1 : 0,
      stop_loss: updates.stopLoss,
    });
  },
  
  /**
   * Close a position and record the trade
   * @param {number} positionId - Position ID to close
   * @param {Object} exitData - Exit data
   * @param {number} exitData.exitPrice - Exit price
   * @param {string} [exitData.reason] - Exit reason
   * @returns {Object|null} Trade result with pnl, pnlPercent, result
   */
  closePosition(positionId, exitData) {
    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position) return null;
    
    // Calculate P/L
    const direction = position.side === 'LONG' ? 1 : -1;
    const pnlPercent = direction * ((exitData.exitPrice - position.entry_price) / position.entry_price) * 100;
    const pnl = (pnlPercent / 100) * position.margin * position.leverage;
    
    // Insert into trades
    stmts.insertTrade.run({
      symbol: position.symbol,
      side: position.side,
      entry_price: position.entry_price,
      exit_price: exitData.exitPrice,
      amount: position.amount,
      leverage: position.leverage,
      margin: position.margin,
      stop_loss: position.stop_loss,
      take_profit: position.take_profit,
      pnl: pnl,
      pnl_percent: pnlPercent,
      result: pnl > 0 ? 'WIN' : 'LOSS',
      reason: position.reason,
      exit_reason: exitData.reason,
      opened_at: position.opened_at,
      closed_at: new Date().toISOString(),
      rsi: position.rsi,
      macd_histogram: exitData.macdHistogram || null,
      trend: position.trend,
      volatility_multiplier: position.volatility_multiplier,
      btc_momentum: exitData.btcMomentum || null,
      sentiment: exitData.sentiment || null,
      hour_utc: new Date().getUTCHours(),
    });
    
    // Delete position
    stmts.deletePosition.run(positionId);
    
    return { pnl, pnlPercent, result: pnl > 0 ? 'WIN' : 'LOSS' };
  },
  
  // Trades
  getRecentTrades(limit = 10) {
    return stmts.getRecentTrades.all(limit);
  },
  
  getTradeStats() {
    return stmts.getTradeStats.get();
  },
  
  getAllTrades() {
    return db.prepare('SELECT * FROM trades ORDER BY closed_at DESC').all();
  },
  
  getTradesForLearning() {
    return db.prepare(`
      SELECT * FROM trades 
      WHERE closed_at IS NOT NULL 
      ORDER BY closed_at DESC
    `).all();
  },
  
  // Params
  getRsiParams() {
    const oversold = stmts.getParam.get('rsi_oversold');
    const overbought = stmts.getParam.get('rsi_overbought');
    return {
      oversold: oversold ? parseInt(oversold.value) : 35,
      overbought: overbought ? parseInt(overbought.value) : 65,
    };
  },
  
  setRsiParams(oversold, overbought) {
    stmts.setParam.run('rsi_oversold', oversold.toString());
    stmts.setParam.run('rsi_overbought', overbought.toString());
  },
  
  // Blocked hours
  getBlockedHours() {
    return stmts.getBlockedHours.all().map(r => r.hour_utc);
  },
  
  setBlockedHours(hours, stats = {}) {
    stmts.clearBlockedHours.run();
    for (const hour of hours) {
      const hourStats = stats[hour] || {};
      stmts.setBlockedHour.run(hour, 'auto-optimized', hourStats.avgLoss || 0, hourStats.count || 0);
    }
  },
  
  // Analytics
  getWinRateByHour() {
    return db.prepare(`
      SELECT 
        hour_utc,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
        ROUND(100.0 * SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
        SUM(pnl) as total_pnl
      FROM trades
      GROUP BY hour_utc
      ORDER BY hour_utc
    `).all();
  },
  
  getWinRateBySide() {
    return db.prepare(`
      SELECT 
        side,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
        ROUND(100.0 * SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
        SUM(pnl) as total_pnl
      FROM trades
      GROUP BY side
    `).all();
  },
  
  getWinRateBySymbol() {
    return db.prepare(`
      SELECT 
        symbol,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
        ROUND(100.0 * SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
        SUM(pnl) as total_pnl
      FROM trades
      GROUP BY symbol
    `).all();
  },
  
  // Raw database access for advanced queries
  raw: db,
};

export default TradeDB;
