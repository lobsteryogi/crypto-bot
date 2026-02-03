# Database Config System

## Overview
Bot configuration is now stored in SQLite database (`data/config.db`) instead of hardcoded values. This allows runtime configuration changes without code modification.

## Features
- ✅ SQLite-based config storage with better-sqlite3
- ✅ Key-value pairs with JSON support
- ✅ Configuration history/audit trail
- ✅ CLI tool for easy config management
- ✅ Hot reload support (partial - some changes require restart)
- ✅ Backward compatible with defaults

## Database Schema

### `bot_config` table
- `key` (TEXT PRIMARY KEY) - Dot-notation config key (e.g., `trading.leverage`)
- `value` (TEXT) - Serialized value
- `type` (TEXT) - Value type: `string`, `number`, `boolean`, or `json`
- `description` (TEXT) - Human-readable description
- `updated_at` (INTEGER) - Unix timestamp

### `config_history` table
- `id` (INTEGER PRIMARY KEY)
- `key` (TEXT) - Config key
- `old_value` (TEXT) - Previous value
- `new_value` (TEXT) - New value
- `changed_at` (INTEGER) - Unix timestamp
- `changed_by` (TEXT) - Who made the change (e.g., 'system', 'cli', 'api')

## CLI Usage

### List all config keys
```bash
node src/config-cli.js list
```

### Get a specific value
```bash
node src/config-cli.js get trading.leverage
node src/config-cli.js get strategy.params
```

### Set a value
```bash
# Number
node src/config-cli.js set trading.leverage 15

# String
node src/config-cli.js set strategy.name multi_timeframe

# Boolean
node src/config-cli.js set trading.drawdownProtection.enabled true

# JSON object
node src/config-cli.js set 'trading.martingale' '{"mode":"anti-martingale","multiplier":1.5}'

# JSON array
node src/config-cli.js set 'trading.symbols' '["BTC/USDT","ETH/USDT","SOL/USDT"]'
```

### View change history
```bash
# All changes (last 50)
node src/config-cli.js history

# Specific key
node src/config-cli.js history trading.leverage

# Custom limit
node src/config-cli.js history trading.leverage 100
```

### Export/Import
```bash
# Export to file
node src/config-cli.js export > config-backup.json

# Import from file
node src/config-cli.js import "$(cat config-backup.json)"
```

### Reset to defaults
```bash
node src/config-cli.js reset
```

## Programmatic API

```javascript
import { ConfigDB } from './config-db.js';

// Get single value
const leverage = ConfigDB.get('trading.leverage');

// Set value
ConfigDB.set('trading.leverage', 15, 'api');

// Get all config as nested object
const allConfig = ConfigDB.getAll();

// Get full config with defaults merged
const config = ConfigDB.getFullConfig();

// Update multiple values
ConfigDB.updateMultiple({
  'trading.leverage': 15,
  'trading.tradeAmount': 200,
  'strategy.name': 'rsi_ma_crossover'
}, 'batch-update');

// Get change history
const history = ConfigDB.getHistory('trading.leverage', 50);

// List all keys with metadata
const keys = ConfigDB.listAll();
```

## Hot Reload

Some config changes take effect immediately, others require bot restart:

**Immediate effect** (on next trading cycle):
- `trading.leverage`
- `trading.tradeAmount`
- `trading.stopLossPercent`
- `trading.takeProfitPercent`
- `trading.maxOpenTrades`
- Most trading parameters

**Requires restart**:
- `strategy.name` (strategy switching)
- `trading.symbols` (symbol list)
- Database-dependent features

To reload config manually in code:
```javascript
import { reloadConfig } from './config.js';

// Reload from database
reloadConfig();
```

## Migration from Hardcoded Config

The old `config.js` is now a thin wrapper that loads from database. All existing code continues to work:

```javascript
// Old code (still works)
import { config } from './config.js';
console.log(config.trading.leverage); // Works!

// New code (dynamic reload)
import { reloadConfig } from './config.js';
reloadConfig(); // Refresh from DB
```

## Configuration Keys

### Trading Parameters
- `trading.tradeAmount` - Base trade size in USDT
- `trading.leverage` - Leverage multiplier
- `trading.maxOpenTrades` - Max total positions
- `trading.maxOpenTradesPerSymbol` - Max per symbol
- `trading.stopLossPercent` - Stop loss %
- `trading.takeProfitPercent` - Take profit %

### Risk Management
- `trading.positionSizing` (JSON) - Dynamic position sizing
- `trading.martingale` (JSON) - Martingale settings
- `trading.volatilityAdjustment` (JSON) - ATR-based adjustments
- `trading.drawdownProtection` (JSON) - Drawdown protection
- `trading.timeFilter` (JSON) - Time-based restrictions

### Strategy
- `strategy.name` - Active strategy name
- `strategy.params` (JSON) - Strategy-specific parameters
- `strategy.version` - Strategy version number

### Indicators
- `strategy.params.rsiPeriod` - RSI period
- `strategy.params.rsiOversold` - RSI oversold threshold
- `strategy.params.rsiOverbought` - RSI overbought threshold
- `strategy.params.macdFast` - MACD fast period
- `strategy.params.macdSlow` - MACD slow period
- And more...

See `src/config-db.js` `DEFAULT_CONFIG` for full list.

## File Locations
- Database: `data/config.db`
- CLI tool: `src/config-cli.js`
- Config module: `src/config.js`
- Config DB module: `src/config-db.js`

## Backup Strategy

```bash
# Backup database
cp data/config.db data/config.db.backup

# Export as JSON
node src/config-cli.js export > backups/config-$(date +%Y%m%d).json

# Restore from JSON
node src/config-cli.js import "$(cat backups/config-20260203.json)"
```

## Examples

### Adjust risk settings
```bash
# More conservative
node src/config-cli.js set trading.leverage 10
node src/config-cli.js set trading.stopLossPercent 1.5
node src/config-cli.js set trading.takeProfitPercent 2.5

# More aggressive
node src/config-cli.js set trading.leverage 25
node src/config-cli.js set trading.stopLossPercent 3.0
node src/config-cli.js set trading.takeProfitPercent 5.0
```

### Enable/disable features
```bash
# Enable drawdown protection
node src/config-cli.js set 'trading.drawdownProtection' '{"enabled":true,"maxDrawdownPercent":5,"pauseDurationMinutes":60,"resetOnNewPeak":true}'

# Disable time filter
node src/config-cli.js set 'trading.timeFilter.enabled' false

# Enable BTC correlation strict mode
node src/config-cli.js set 'trading.btcCorrelation.strictMode' true
```

### Switch strategy
```bash
node src/config-cli.js set strategy.name simple_rsi
# Note: Requires bot restart for strategy change
```

## Troubleshooting

### Config not updating
1. Check if bot needs restart (see "Hot Reload" section)
2. Verify change with: `node src/config-cli.js get <key>`
3. Check history: `node src/config-cli.js history <key>`

### Database corruption
```bash
# Rebuild from defaults
rm data/config.db
node src/config-cli.js list  # Auto-creates with defaults
```

### Import/export issues
```bash
# Verify JSON syntax
cat config.json | jq .

# Test export
node src/config-cli.js export | jq .
```
