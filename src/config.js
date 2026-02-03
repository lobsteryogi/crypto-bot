// Configuration for the crypto trading bot
// Now loads from database with fallback to defaults
import { ConfigDB } from './config-db.js';

// Get full config from database
// This function can be called at runtime to reload config
export function loadConfig() {
  return ConfigDB.getFullConfig();
}

// Export config object (lazy loaded)
export const config = loadConfig();

// Export ConfigDB for runtime updates
export { ConfigDB };

// Hot reload support: re-export loadConfig for dynamic updates
export function reloadConfig() {
  const newConfig = loadConfig();
  
  // Update existing config object in-place
  Object.keys(config).forEach(key => delete config[key]);
  Object.assign(config, newConfig);
  
  console.log('✅ Config reloaded from database');
  return config;
}

// Legacy: Keep old structure for backward compatibility
// (Remove these comments after migration is confirmed working)
/*
Original hardcoded config structure:
- symbol, symbols
- paperTrading { enabled, initialBalance, startPrice }
- trading { tradeAmount, leverage, maxOpenTrades, ... }
- strategy { name, version, params }
- timeframe
- paths
*/
