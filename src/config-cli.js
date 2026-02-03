#!/usr/bin/env node
// CLI tool for managing bot configuration
import { ConfigDB } from './config-db.js';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
🤖 Crypto Bot Config Manager

Usage:
  node config-cli.js <command> [options]

Commands:
  list                          List all config keys
  get <key>                     Get a specific config value
  set <key> <value>             Set a config value
  delete <key>                  Delete a config key
  history [key] [limit]         Show config change history
  export                        Export all config as JSON
  import <json-string>          Import config from JSON
  reset                         Reset to default values
  hot-reload                    Trigger hot reload (if supported)

Examples:
  node config-cli.js get trading.leverage
  node config-cli.js set trading.leverage 15
  node config-cli.js set trading.tradeAmount 200
  node config-cli.js set "trading.symbols" '["BTC/USDT","ETH/USDT"]'
  node config-cli.js list
  node config-cli.js history trading.leverage 10
  node config-cli.js export > config-backup.json

Notes:
  - JSON values must be quoted: '{"enabled": true}'
  - Arrays: '["item1", "item2"]'
  - Booleans: true or false (no quotes)
  - Numbers: no quotes
`);
}

function formatValue(value) {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function parseValue(str) {
  // Try to parse as JSON first
  try {
    return JSON.parse(str);
  } catch {
    // If not JSON, try boolean
    if (str === 'true') return true;
    if (str === 'false') return false;
    
    // Try number
    const num = parseFloat(str);
    if (!isNaN(num) && String(num) === str) {
      return num;
    }
    
    // Otherwise string
    return str;
  }
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'list': {
        const configs = ConfigDB.listAll();
        console.log('\n📋 Configuration Keys:\n');
        console.log('KEY                                    TYPE       UPDATED');
        console.log('─'.repeat(80));
        for (const cfg of configs) {
          const key = cfg.key.padEnd(40);
          const type = cfg.type.padEnd(10);
          const updated = cfg.updated_at || 'N/A';
          console.log(`${key} ${type} ${updated}`);
          if (cfg.description) {
            console.log(`   └─ ${cfg.description}`);
          }
        }
        console.log(`\nTotal: ${configs.length} keys\n`);
        break;
      }

      case 'get': {
        const key = args[1];
        if (!key) {
          console.error('❌ Error: Key required');
          console.log('Usage: node config-cli.js get <key>');
          process.exit(1);
        }
        
        const value = ConfigDB.get(key);
        console.log(`\n🔑 ${key}:`);
        console.log(formatValue(value));
        console.log();
        break;
      }

      case 'set': {
        const key = args[1];
        const valueStr = args.slice(2).join(' ');
        
        if (!key || !valueStr) {
          console.error('❌ Error: Key and value required');
          console.log('Usage: node config-cli.js set <key> <value>');
          process.exit(1);
        }
        
        const value = parseValue(valueStr);
        const success = ConfigDB.set(key, value, 'cli');
        
        if (success) {
          console.log(`✅ Set ${key} = ${formatValue(value)}`);
        } else {
          console.error('❌ Failed to set config');
          process.exit(1);
        }
        break;
      }

      case 'delete': {
        const key = args[1];
        if (!key) {
          console.error('❌ Error: Key required');
          console.log('Usage: node config-cli.js delete <key>');
          process.exit(1);
        }
        
        const success = ConfigDB.delete(key);
        if (success) {
          console.log(`✅ Deleted ${key}`);
        } else {
          console.error('❌ Failed to delete config');
          process.exit(1);
        }
        break;
      }

      case 'history': {
        const key = args[1] || null;
        const limit = parseInt(args[2]) || 50;
        
        const history = ConfigDB.getHistory(key, limit);
        
        console.log('\n📜 Configuration History:\n');
        console.log('KEY                        OLD → NEW                       CHANGED BY    WHEN');
        console.log('─'.repeat(100));
        
        for (const entry of history) {
          const k = (entry.key || '').padEnd(25);
          const oldVal = (entry.old_value || 'null').substring(0, 15);
          const newVal = (entry.new_value || '').substring(0, 15);
          const change = `${oldVal} → ${newVal}`.padEnd(30);
          const by = (entry.changed_by || 'system').padEnd(12);
          const when = new Date(entry.changed_at * 1000).toISOString();
          
          console.log(`${k} ${change} ${by} ${when}`);
        }
        
        console.log(`\nShowing ${history.length} entries\n`);
        break;
      }

      case 'export': {
        const config = ConfigDB.getFullConfig();
        console.log(JSON.stringify(config, null, 2));
        break;
      }

      case 'import': {
        const jsonStr = args.slice(1).join(' ');
        if (!jsonStr) {
          console.error('❌ Error: JSON string required');
          console.log('Usage: node config-cli.js import \'{"key": "value"}\'');
          process.exit(1);
        }
        
        const data = JSON.parse(jsonStr);
        const updates = flattenObject(data);
        
        const success = ConfigDB.updateMultiple(updates, 'cli-import');
        if (success) {
          console.log(`✅ Imported ${Object.keys(updates).length} config values`);
        } else {
          console.error('❌ Failed to import config');
          process.exit(1);
        }
        break;
      }

      case 'reset': {
        console.log('⚠️  This will reset all config to defaults. Continue? (y/N)');
        
        // Simple confirmation (in real CLI, use readline)
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        
        stdin.once('data', (key) => {
          stdin.setRawMode(false);
          stdin.pause();
          
          if (key.toLowerCase() === 'y') {
            // Delete all and reinit
            const all = ConfigDB.listAll();
            for (const cfg of all) {
              ConfigDB.delete(cfg.key);
            }
            ConfigDB.initDefaults();
            console.log('✅ Reset to defaults');
          } else {
            console.log('❌ Cancelled');
          }
        });
        break;
      }

      case 'hot-reload': {
        console.log('🔥 Hot reload triggered');
        console.log('   Note: Restart the bot for changes to take full effect');
        console.log('   Some modules may support dynamic reload');
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Helper: Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  
  return result;
}

main();
