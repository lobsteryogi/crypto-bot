// Database-backed Configuration System
// Allows runtime config changes without code modification

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'config.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Create config table with JSON support
db.exec(`
  CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  
  CREATE TABLE IF NOT EXISTS config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_at INTEGER DEFAULT (strftime('%s', 'now')),
    changed_by TEXT DEFAULT 'system'
  );
  
  CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(key);
  CREATE INDEX IF NOT EXISTS idx_config_history_time ON config_history(changed_at);
`);

// Default configuration values (fallback)
const DEFAULT_CONFIG = {
  // Trading symbols
  'trading.symbols': {
    value: ['SOL/USDT', 'ETH/USDT', 'AVAX/USDT'],
    type: 'json',
    description: 'Trading pairs to monitor'
  },
  'trading.symbol': {
    value: 'SOL/USDT',
    type: 'string',
    description: 'Primary trading symbol'
  },
  
  // Paper trading
  'paperTrading.enabled': {
    value: true,
    type: 'boolean',
    description: 'Enable paper trading mode'
  },
  'paperTrading.initialBalance': {
    value: 10000,
    type: 'number',
    description: 'Initial balance in USDT'
  },
  
  // Basic trading params
  'trading.tradeAmount': {
    value: 150,
    type: 'number',
    description: 'USDT per trade (before leverage)'
  },
  'trading.leverage': {
    value: 20,
    type: 'number',
    description: 'Leverage multiplier'
  },
  'trading.maxOpenTrades': {
    value: 15,
    type: 'number',
    description: 'Maximum total open positions'
  },
  'trading.maxOpenTradesPerSymbol': {
    value: 5,
    type: 'number',
    description: 'Maximum positions per symbol'
  },
  'trading.stopLossPercent': {
    value: 2.5,
    type: 'number',
    description: 'Stop loss percentage'
  },
  'trading.takeProfitPercent': {
    value: 3.5,
    type: 'number',
    description: 'Take profit percentage'
  },
  
  // Trailing stop
  'trading.trailingStop.enabled': {
    value: true,
    type: 'boolean',
    description: 'Enable trailing stop'
  },
  'trading.trailingStop.activationPercent': {
    value: 1.0,
    type: 'number',
    description: 'Activate trailing when profit >= %'
  },
  'trading.trailingStop.trailingPercent': {
    value: 0.5,
    type: 'number',
    description: 'Trail % below highest price'
  },
  
  // Position sizing
  'trading.positionSizing': {
    value: {
      minMultiplier: 0.25,
      maxMultiplier: 2.0,
      baseWinRate: 50,
      minTrades: 10,
      winRateWeight: 0.7,
      streakWeight: 0.3
    },
    type: 'json',
    description: 'Dynamic position sizing parameters'
  },
  
  // Martingale
  'trading.martingale': {
    value: {
      mode: 'anti-martingale',
      multiplier: 1.5,
      maxMultiplier: 3.0
    },
    type: 'json',
    description: 'Martingale/Anti-martingale settings'
  },
  
  // Volatility adjustment
  'trading.volatilityAdjustment': {
    value: {
      enabled: true,
      atrPeriod: 14,
      avgAtrPeriod: 100,
      minSlPercent: 0.5,
      maxSlPercent: 3.0,
      minTpPercent: 1.0,
      maxTpPercent: 5.0
    },
    type: 'json',
    description: 'ATR-based TP/SL adjustment'
  },
  
  // Leverage adjustment
  'trading.leverageAdjustment': {
    value: {
      enabled: false,
      minLeverage: 15,
      maxLeverage: 25,
      highVolThreshold: 2.0,
      lowVolThreshold: 0.5
    },
    type: 'json',
    description: 'Volatility-based leverage adjustment'
  },
  
  // Drawdown protection
  'trading.drawdownProtection': {
    value: {
      enabled: false,
      maxDrawdownPercent: 10,
      pauseDurationMinutes: 30,
      resetOnNewPeak: true
    },
    type: 'json',
    description: 'Drawdown protection settings'
  },
  
  // Time filter
  'trading.timeFilter': {
    value: {
      enabled: false,
      blockedHours: [],
      avoidWeekends: false
    },
    type: 'json',
    description: 'Time-based trading restrictions'
  },
  
  // Hour optimization
  'trading.hourOptimization': {
    value: {
      enabled: false,
      minTradesPerHour: 3,
      blockThreshold: 20,
      optimizeEvery: 10
    },
    type: 'json',
    description: 'Hour-based performance optimization'
  },
  
  // BTC correlation
  'trading.btcCorrelation': {
    value: {
      enabled: true,
      strictMode: false
    },
    type: 'json',
    description: 'BTC correlation filter'
  },
  
  // RSI optimization
  'trading.rsiOptimization': {
    value: {
      enabled: true,
      minTrades: 15,
      optimizeEvery: 5
    },
    type: 'json',
    description: 'RSI parameter optimization'
  },
  
  // Strategy settings
  'strategy.name': {
    value: 'multi_timeframe',
    type: 'string',
    description: 'Active trading strategy'
  },
  'strategy.version': {
    value: 3,
    type: 'number',
    description: 'Strategy version'
  },
  'strategy.params': {
    value: {
      trendFastPeriod: 20,
      trendSlowPeriod: 50,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      rsiPeriod: 14,
      rsiOversold: 40,
      rsiOverbought: 60,
      requireAllTimeframes: false
    },
    type: 'json',
    description: 'Strategy-specific parameters'
  },
  
  // Timeframe
  'timeframe': {
    value: '1m',
    type: 'string',
    description: 'Default timeframe for single-TF strategies'
  }
};

// Prepared statements for performance
const stmts = {
  get: db.prepare('SELECT value, type FROM bot_config WHERE key = ?'),
  set: db.prepare(`
    INSERT INTO bot_config (key, value, type, description, updated_at) 
    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value,
      updated_at = excluded.updated_at
  `),
  getAll: db.prepare('SELECT key, value, type FROM bot_config'),
  delete: db.prepare('DELETE FROM bot_config WHERE key = ?'),
  logHistory: db.prepare(`
    INSERT INTO config_history (key, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?)
  `)
};

// Get a single config value
function get(key, defaultValue = null) {
  try {
    const row = stmts.get.get(key);
    if (!row) {
      // Return default if exists
      if (DEFAULT_CONFIG[key]) {
        return DEFAULT_CONFIG[key].value;
      }
      return defaultValue;
    }
    
    return deserializeValue(row.value, row.type);
  } catch (error) {
    console.error(`Error getting config key "${key}":`, error);
    return defaultValue;
  }
}

// Set a single config value
function set(key, value, changedBy = 'system') {
  try {
    const type = inferType(value);
    const serialized = serializeValue(value, type);
    
    // Get old value for history
    const oldRow = stmts.get.get(key);
    const oldValue = oldRow ? oldRow.value : null;
    
    // Get description from defaults
    const description = DEFAULT_CONFIG[key]?.description || null;
    
    // Update config
    stmts.set.run(key, serialized, type, description);
    
    // Log history
    stmts.logHistory.run(key, oldValue, serialized, changedBy);
    
    return true;
  } catch (error) {
    console.error(`Error setting config key "${key}":`, error);
    return false;
  }
}

// Get all config as object
function getAll() {
  try {
    const rows = stmts.getAll.all();
    const config = {};
    
    for (const row of rows) {
      setNestedValue(config, row.key, deserializeValue(row.value, row.type));
    }
    
    return config;
  } catch (error) {
    console.error('Error getting all config:', error);
    return {};
  }
}

// Get full config object with defaults
function getFullConfig() {
  const dbConfig = getAll();
  
  // Merge with defaults
  const config = {
    symbol: dbConfig.trading?.symbol || DEFAULT_CONFIG['trading.symbol'].value,
    symbols: dbConfig.trading?.symbols || DEFAULT_CONFIG['trading.symbols'].value,
    paperTrading: {
      enabled: dbConfig.paperTrading?.enabled ?? DEFAULT_CONFIG['paperTrading.enabled'].value,
      initialBalance: dbConfig.paperTrading?.initialBalance ?? DEFAULT_CONFIG['paperTrading.initialBalance'].value,
      startPrice: null
    },
    trading: {
      tradeAmount: dbConfig.trading?.tradeAmount ?? DEFAULT_CONFIG['trading.tradeAmount'].value,
      leverage: dbConfig.trading?.leverage ?? DEFAULT_CONFIG['trading.leverage'].value,
      maxOpenTrades: dbConfig.trading?.maxOpenTrades ?? DEFAULT_CONFIG['trading.maxOpenTrades'].value,
      maxOpenTradesPerSymbol: dbConfig.trading?.maxOpenTradesPerSymbol ?? DEFAULT_CONFIG['trading.maxOpenTradesPerSymbol'].value,
      stopLossPercent: dbConfig.trading?.stopLossPercent ?? DEFAULT_CONFIG['trading.stopLossPercent'].value,
      takeProfitPercent: dbConfig.trading?.takeProfitPercent ?? DEFAULT_CONFIG['trading.takeProfitPercent'].value,
      trailingStop: dbConfig.trading?.trailingStop ?? DEFAULT_CONFIG['trading.trailingStop.enabled'].value ? {
        enabled: dbConfig.trading?.trailingStop?.enabled ?? DEFAULT_CONFIG['trading.trailingStop.enabled'].value,
        activationPercent: dbConfig.trading?.trailingStop?.activationPercent ?? DEFAULT_CONFIG['trading.trailingStop.activationPercent'].value,
        trailingPercent: dbConfig.trading?.trailingStop?.trailingPercent ?? DEFAULT_CONFIG['trading.trailingStop.trailingPercent'].value
      } : DEFAULT_CONFIG['trading.trailingStop.enabled'].value,
      positionSizing: dbConfig.trading?.positionSizing ?? DEFAULT_CONFIG['trading.positionSizing'].value,
      martingale: dbConfig.trading?.martingale ?? DEFAULT_CONFIG['trading.martingale'].value,
      volatilityAdjustment: dbConfig.trading?.volatilityAdjustment ?? DEFAULT_CONFIG['trading.volatilityAdjustment'].value,
      leverageAdjustment: dbConfig.trading?.leverageAdjustment ?? DEFAULT_CONFIG['trading.leverageAdjustment'].value,
      drawdownProtection: dbConfig.trading?.drawdownProtection ?? DEFAULT_CONFIG['trading.drawdownProtection'].value,
      timeFilter: dbConfig.trading?.timeFilter ?? DEFAULT_CONFIG['trading.timeFilter'].value,
      hourOptimization: dbConfig.trading?.hourOptimization ?? DEFAULT_CONFIG['trading.hourOptimization'].value,
      btcCorrelation: dbConfig.trading?.btcCorrelation ?? DEFAULT_CONFIG['trading.btcCorrelation'].value,
      rsiOptimization: dbConfig.trading?.rsiOptimization ?? DEFAULT_CONFIG['trading.rsiOptimization'].value
    },
    strategy: {
      name: dbConfig.strategy?.name ?? DEFAULT_CONFIG['strategy.name'].value,
      version: dbConfig.strategy?.version ?? DEFAULT_CONFIG['strategy.version'].value,
      params: dbConfig.strategy?.params ?? DEFAULT_CONFIG['strategy.params'].value
    },
    timeframe: dbConfig.timeframe ?? DEFAULT_CONFIG['timeframe'].value,
    paths: {
      trades: './data/trades.json',
      performance: './data/performance.json',
      strategyHistory: './data/strategy_history.json'
    }
  };
  
  return config;
}

// Initialize database with default values (idempotent)
function initDefaults() {
  const tx = db.transaction(() => {
    for (const [key, config] of Object.entries(DEFAULT_CONFIG)) {
      // Only insert if not exists
      const existing = stmts.get.get(key);
      if (!existing) {
        const serialized = serializeValue(config.value, config.type);
        stmts.set.run(key, serialized, config.type, config.description);
      }
    }
  });
  
  tx();
}

// Delete a config key
function del(key) {
  try {
    stmts.delete.run(key);
    return true;
  } catch (error) {
    console.error(`Error deleting config key "${key}":`, error);
    return false;
  }
}

// Helper: Infer type from value
function inferType(value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'json';
}

// Helper: Serialize value to string
function serializeValue(value, type) {
  if (type === 'json') return JSON.stringify(value);
  if (type === 'boolean') return value ? '1' : '0';
  return String(value);
}

// Helper: Deserialize string to value
function deserializeValue(str, type) {
  if (type === 'json') return JSON.parse(str);
  if (type === 'boolean') return str === '1' || str === 'true';
  if (type === 'number') return parseFloat(str);
  return str;
}

// Helper: Set nested object value from dot notation
function setNestedValue(obj, key, value) {
  const parts = key.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) current[part] = {};
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
}

// Get config change history
function getHistory(key = null, limit = 50) {
  try {
    let query = 'SELECT * FROM config_history';
    const params = [];
    
    if (key) {
      query += ' WHERE key = ?';
      params.push(key);
    }
    
    query += ' ORDER BY changed_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    console.error('Error getting config history:', error);
    return [];
  }
}

// Update multiple config values in a transaction
function updateMultiple(updates, changedBy = 'system') {
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      set(key, value, changedBy);
    }
  });
  
  try {
    tx();
    return true;
  } catch (error) {
    console.error('Error updating multiple configs:', error);
    return false;
  }
}

// List all config keys with metadata
function listAll() {
  try {
    const stmt = db.prepare(`
      SELECT key, type, description, 
             datetime(updated_at, 'unixepoch') as updated_at 
      FROM bot_config 
      ORDER BY key
    `);
    return stmt.all();
  } catch (error) {
    console.error('Error listing config:', error);
    return [];
  }
}

// Export API
export const ConfigDB = {
  get,
  set,
  getAll,
  getFullConfig,
  initDefaults,
  delete: del,
  getHistory,
  updateMultiple,
  listAll,
  
  // Direct DB access for advanced use
  db
};

// Auto-initialize on import
initDefaults();
