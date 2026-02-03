// Paper trading engine - simulates trades without real money
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { RsiOptimizer } from './rsi-optimizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const skillDir = '/root/.openclaw/workspace/skills/crypto-self-learning';

// Log trade to self-learning skill
function logToSelfLearning(trade, indicators = {}) {
  try {
    const symbol = trade.symbol.replace('/', '');
    const direction = trade.type === 'long' ? 'LONG' : 'SHORT';
    const result = trade.profit > 0 ? 'WIN' : 'LOSS';
    const day = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
    const hour = new Date().getHours();
    
    const cmd = `python3 ${skillDir}/scripts/log_trade.py \\
      --symbol "${symbol}" \\
      --direction "${direction}" \\
      --entry ${trade.entryPrice} \\
      --exit ${trade.exitPrice} \\
      --pnl_percent ${trade.profitPercent.toFixed(2)} \\
      --reason "${trade.reason || 'Auto trade'}" \\
      --indicators '${JSON.stringify(indicators)}' \\
      --market_context '{"day": "${day}", "hour": ${hour}}' \\
      --result ${result} \\
      --notes "${trade.closeReason || ''}"`;
    
    execSync(cmd, { stdio: 'pipe' });
    console.log('🧠 Trade logged to self-learning system');
  } catch (e) {
    console.log('⚠️ Could not log to self-learning:', e.message);
  }
}

export class PaperTrader {
  constructor(initialBalance = 10000, rsiConfig = {}) {
    this.balance = initialBalance;
    this.initialBalance = initialBalance;
    this.positions = []; // Open positions
    this.trades = []; // Completed trades
    this.peakBalance = initialBalance; // Track peak balance for drawdown
    this.tradingPaused = false; // Drawdown protection flag
    this.pausedUntil = null; // Timestamp when trading can resume
    this.martingaleStreak = 0; // Streak for Martingale/Anti-Martingale
    
    // RSI Optimization
    this.rsiOptimizationConfig = rsiConfig;
    this.rsiOptimizer = new RsiOptimizer({
        minTradesPerBucket: 3 // Default, can be overridden if passed in config
    });
    this.optimizedParams = null; // Store optimized values { oversold, overbought }

    this.loadState();
  }

  loadState() {
    const statePath = path.join(dataDir, 'paper_state.json');
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        this.balance = state.balance;
        this.positions = state.positions || [];
        this.trades = state.trades || [];
        this.peakBalance = state.peakBalance || this.balance;
        this.tradingPaused = state.tradingPaused || false;
        this.pausedUntil = state.pausedUntil || null;
        this.martingaleStreak = state.martingaleStreak || 0;
        this.optimizedParams = state.optimizedParams || null;
        
        console.log(`📂 Loaded state: Balance ${this.balance.toFixed(2)} USDT, ${this.positions.length} open positions, ${this.trades.length} trades`);
        if (this.optimizedParams) {
             console.log(`🎯 Loaded optimized RSI params: Oversold ${this.optimizedParams.oversold}, Overbought ${this.optimizedParams.overbought}`);
        }
      } catch (e) {
        console.log('⚠️ Could not load state, starting fresh');
      }
    }
  }

  saveState() {
    const statePath = path.join(dataDir, 'paper_state.json');
    const state = {
      balance: this.balance,
      positions: this.positions,
      trades: this.trades,
      peakBalance: this.peakBalance,
      tradingPaused: this.tradingPaused,
      pausedUntil: this.pausedUntil,
      martingaleStreak: this.martingaleStreak,
      optimizedParams: this.optimizedParams,
      lastUpdate: new Date().toISOString()
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  setMartingaleStreak(streak) {
    this.martingaleStreak = streak;
    this.saveState();
  }

  getMartingaleStreak() {
    return this.martingaleStreak || 0;
  }

  // Open a new position
  buy(symbol, price, amount, reason, leverage = 1) {
    // Check if trading is paused
    if (this.tradingPaused) {
      if (this.pausedUntil && Date.now() < new Date(this.pausedUntil).getTime()) {
        const remainingMinutes = Math.ceil((new Date(this.pausedUntil).getTime() - Date.now()) / 60000);
        console.log(`⏸️ Trading paused due to drawdown protection. Resume in ${remainingMinutes} minutes.`);
        return { success: false, reason: 'Trading paused due to drawdown' };
      } else {
        // Pause expired, resume trading
        this.tradingPaused = false;
        this.pausedUntil = null;
        console.log(`▶️ Trading resumed after drawdown pause.`);
        this.saveState();
      }
    }

    const cost = (price * amount) / leverage; // Actual margin required
    if (cost > this.balance) {
      return { success: false, reason: 'Insufficient balance' };
    }

    const position = {
      id: Date.now().toString(),
      symbol,
      type: 'long',
      entryPrice: price,
      amount,
      cost,
      leverage,
      reason,
      openTime: new Date().toISOString(),
      highestPrice: price, // Track highest price for trailing stop
      trailingStopActive: false, // Whether trailing stop is activated
    };

    this.balance -= cost;
    this.positions.push(position);
    this.saveState();

    console.log(`🟢 BUY: ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} (${leverage}x, margin: ${cost.toFixed(2)} USDT)`);
    return { success: true, position };
  }

  // Open a new short position
  short(symbol, price, amount, reason, leverage = 1) {
    // Check if trading is paused
    if (this.tradingPaused) {
      if (this.pausedUntil && Date.now() < new Date(this.pausedUntil).getTime()) {
        const remainingMinutes = Math.ceil((new Date(this.pausedUntil).getTime() - Date.now()) / 60000);
        console.log(`⏸️ Trading paused due to drawdown protection. Resume in ${remainingMinutes} minutes.`);
        return { success: false, reason: 'Trading paused due to drawdown' };
      } else {
        // Pause expired, resume trading
        this.tradingPaused = false;
        this.pausedUntil = null;
        console.log(`▶️ Trading resumed after drawdown pause.`);
        this.saveState();
      }
    }

    const cost = (price * amount) / leverage; // Actual margin required
    if (cost > this.balance) {
      return { success: false, reason: 'Insufficient balance' };
    }

    const position = {
      id: Date.now().toString(),
      symbol,
      type: 'short',
      entryPrice: price,
      amount,
      cost,
      leverage,
      reason,
      openTime: new Date().toISOString(),
      lowestPrice: price, // Track lowest price for trailing stop
      trailingStopActive: false,
    };

    this.balance -= cost;
    this.positions.push(position);
    this.saveState();

    console.log(`🔴 SHORT: ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} (${leverage}x, margin: ${cost.toFixed(2)} USDT)`);
    return { success: true, position };
  }

  // Close a position
  sell(positionId, price, reason, indicators = {}) {
    const posIndex = this.positions.findIndex(p => p.id === positionId);
    if (posIndex === -1) {
      return { success: false, reason: 'Position not found' };
    }

    const position = this.positions[posIndex];
    const leverage = position.leverage || 1;
    const type = position.type || 'long';
    
    let profit;
    if (type === 'long') {
      const notionalValue = position.entryPrice * position.amount;
      const exitValue = price * position.amount;
      profit = exitValue - notionalValue;
    } else {
      // Short: Profit if price goes down (Entry - Exit)
      const notionalValue = position.entryPrice * position.amount;
      const exitValue = price * position.amount;
      profit = notionalValue - exitValue;
    }

    const profitPercent = (profit / position.cost) * 100; // % based on margin used

    const trade = {
      ...position,
      exitPrice: price,
      revenue: position.cost + profit, // Return margin + profit
      profit,
      profitPercent,
      closeTime: new Date().toISOString(),
      closeReason: reason,
      duration: Date.now() - new Date(position.openTime).getTime(),
    };

    this.balance += trade.revenue;
    
    // Update peak balance if we hit a new high
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
    
    this.trades.push(trade);
    this.positions.splice(posIndex, 1);
    this.saveState();

    // Trigger RSI Optimization check
    if (this.rsiOptimizationConfig && 
        this.rsiOptimizationConfig.enabled && 
        this.trades.length >= this.rsiOptimizationConfig.minTrades &&
        this.trades.length % this.rsiOptimizationConfig.optimizeEvery === 0) {
        this.optimizeRsi();
    }

    // Log to self-learning system
    logToSelfLearning(trade, indicators);

    const emoji = profit > 0 ? '💰' : '💸';
    const direction = type === 'long' ? 'LONG' : 'SHORT';
    console.log(`${emoji} CLOSE ${direction}: ${position.amount.toFixed(6)} ${position.symbol} @ ${price.toFixed(2)} | P/L: ${profit.toFixed(2)} USDT (${profitPercent.toFixed(2)}%)`);
    return { success: true, trade };
  }

  // Check stop loss / take profit / trailing stop for positions of a specific symbol
  checkPositions(symbol, currentPrice, stopLossPercent, takeProfitPercent, trailingStop = null) {
    const closedTrades = [];
    
    // Filter positions to only check those matching the current symbol
    const symbolPositions = this.positions.filter(p => p.symbol === symbol);
    
    for (const position of symbolPositions) {
      const type = position.type || 'long';
      const leverage = position.leverage || 1;
      
      if (type === 'long') {
        const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        // Update highest price for trailing stop
        if (currentPrice > (position.highestPrice || position.entryPrice)) {
          position.highestPrice = currentPrice;
          this.saveState();
        }
        
        // Check trailing stop first (if enabled and activated)
        if (trailingStop && trailingStop.enabled) {
          // Activate trailing stop when profit reaches activation threshold
          if (!position.trailingStopActive && priceChange >= trailingStop.activationPercent) {
            position.trailingStopActive = true;
            console.log(`🎯 Trailing stop activated for LONG ${position.symbol} at ${currentPrice.toFixed(2)} (profit: ${priceChange.toFixed(2)}%)`);
            this.saveState();
          }
          
          // Check trailing stop trigger
          if (position.trailingStopActive) {
            const dropFromHigh = ((position.highestPrice - currentPrice) / position.highestPrice) * 100;
            if (dropFromHigh >= trailingStop.trailingPercent) {
              const result = this.sell(position.id, currentPrice, `Trailing stop triggered (dropped ${dropFromHigh.toFixed(2)}% from high ${position.highestPrice.toFixed(2)})`);
              if (result.success) closedTrades.push(result.trade);
              continue;
            }
          }
        }
        
        // Regular stop loss
        if (priceChange <= -stopLossPercent) {
          const result = this.sell(position.id, currentPrice, `Stop loss triggered (${priceChange.toFixed(2)}%)`);
          if (result.success) closedTrades.push(result.trade);
        } else if (priceChange >= takeProfitPercent) {
          const result = this.sell(position.id, currentPrice, `Take profit triggered (${priceChange.toFixed(2)}%)`);
          if (result.success) closedTrades.push(result.trade);
        }
      } else {
        // SHORT POSITION LOGIC
        // For short, priceChange positive is LOSS, negative is PROFIT
        const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        const profitPercent = -priceChange; // Invert for readability
        
        // Update lowest price for trailing stop (want to trail above the lowest price)
        if (currentPrice < (position.lowestPrice || position.entryPrice)) {
          position.lowestPrice = currentPrice;
          this.saveState();
        }

        // Check trailing stop
        if (trailingStop && trailingStop.enabled) {
          // Activate when profit reaches threshold (price drops by %)
          if (!position.trailingStopActive && profitPercent >= trailingStop.activationPercent) {
            position.trailingStopActive = true;
            console.log(`🎯 Trailing stop activated for SHORT ${position.symbol} at ${currentPrice.toFixed(2)} (profit: ${profitPercent.toFixed(2)}%)`);
            this.saveState();
          }

          if (position.trailingStopActive) {
            // Check if price rose from lowest point
            const riseFromLow = ((currentPrice - position.lowestPrice) / position.lowestPrice) * 100;
            if (riseFromLow >= trailingStop.trailingPercent) {
              const result = this.sell(position.id, currentPrice, `Trailing stop triggered (rose ${riseFromLow.toFixed(2)}% from low ${position.lowestPrice.toFixed(2)})`);
              if (result.success) closedTrades.push(result.trade);
              continue;
            }
          }
        }

        // Stop Loss (Price Rises)
        if (priceChange >= stopLossPercent) {
          const result = this.sell(position.id, currentPrice, `Stop loss triggered (-${priceChange.toFixed(2)}%)`);
          if (result.success) closedTrades.push(result.trade);
        } 
        // Take Profit (Price Drops)
        else if (priceChange <= -takeProfitPercent) {
          const result = this.sell(position.id, currentPrice, `Take profit triggered (+${Math.abs(priceChange).toFixed(2)}%)`);
          if (result.success) closedTrades.push(result.trade);
        }
      }
    }
    
    return closedTrades;
  }

  // Get current portfolio value
  getPortfolioValue(currentPrice) {
    const positionsValue = this.positions.reduce((sum, p) => sum + (p.amount * currentPrice), 0);
    return this.balance + positionsValue;
  }

  // Get performance stats
  getStats() {
    const wins = this.trades.filter(t => t.profit > 0);
    const losses = this.trades.filter(t => t.profit <= 0);
    const totalProfit = this.trades.reduce((sum, t) => sum + t.profit, 0);
    
    return {
      totalTrades: this.trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: this.trades.length > 0 ? (wins.length / this.trades.length * 100).toFixed(2) : 0,
      totalProfit: totalProfit.toFixed(2),
      avgProfit: this.trades.length > 0 ? (totalProfit / this.trades.length).toFixed(2) : 0,
      balance: this.balance.toFixed(2),
      peakBalance: this.peakBalance.toFixed(2),
      openPositions: this.positions.length,
      roi: ((this.balance - this.initialBalance) / this.initialBalance * 100).toFixed(2),
      tradingPaused: this.tradingPaused,
      pausedUntil: this.pausedUntil,
    };
  }
  
  // Check and apply drawdown protection
  checkDrawdownProtection(config) {
    if (!config || !config.enabled) return { paused: false };
    
    // If trading is already paused, check if we should resume
    if (this.tradingPaused) {
      if (this.pausedUntil && Date.now() >= new Date(this.pausedUntil).getTime()) {
        this.tradingPaused = false;
        this.pausedUntil = null;
        console.log(`▶️ Trading resumed after drawdown pause.`);
        this.saveState();
        return { paused: false, resumed: true };
      }
      return { paused: true, remainingMinutes: Math.ceil((new Date(this.pausedUntil).getTime() - Date.now()) / 60000) };
    }
    
    // Reset peak on new high if configured
    if (config.resetOnNewPeak && this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
      this.saveState();
    }
    
    // Calculate drawdown from peak
    const drawdownPercent = ((this.peakBalance - this.balance) / this.peakBalance) * 100;
    
    // Check if we exceeded max drawdown
    if (drawdownPercent >= config.maxDrawdownPercent) {
      this.tradingPaused = true;
      this.pausedUntil = new Date(Date.now() + config.pauseDurationMinutes * 60000).toISOString();
      this.saveState();
      
      console.log(`🚨 DRAWDOWN PROTECTION TRIGGERED!`);
      console.log(`   Peak Balance: ${this.peakBalance.toFixed(2)} USDT`);
      console.log(`   Current Balance: ${this.balance.toFixed(2)} USDT`);
      console.log(`   Drawdown: ${drawdownPercent.toFixed(2)}% (Max: ${config.maxDrawdownPercent}%)`);
      console.log(`   Trading PAUSED for ${config.pauseDurationMinutes} minutes.`);
      console.log(`   Resume at: ${new Date(this.pausedUntil).toLocaleString()}`);
      
      return { 
        paused: true, 
        triggered: true,
        drawdownPercent: drawdownPercent.toFixed(2),
        pauseDurationMinutes: config.pauseDurationMinutes
      };
    }
    
    return { paused: false, drawdownPercent: drawdownPercent.toFixed(2) };
  }

  // RSI Optimization Logic
  optimizeRsi() {
    if (!this.rsiOptimizer || this.trades.length < this.rsiOptimizationConfig.minTrades) return;

    try {
        const optimal = this.rsiOptimizer.getOptimalThresholds(this.trades);
        
        // Check if values are different enough to update
        // We only update if we have a valid result
        if (optimal && optimal.oversold) {
            const currentOversold = this.optimizedParams ? this.optimizedParams.oversold : 30; // Default 30
            
            // If significant change (e.g. diff > 2 or first time)
            if (!this.optimizedParams || Math.abs(optimal.oversold - currentOversold) >= 2) {
                const oldParams = this.optimizedParams ? {...this.optimizedParams} : { oversold: 30, overbought: 70 };
                
                this.optimizedParams = {
                    oversold: optimal.oversold,
                    overbought: optimal.overbought || 70,
                    lastOptimization: new Date().toISOString(),
                    tradeCountAtOptimization: this.trades.length
                };
                
                console.log(`🎯 RSI Optimization: Adjusting oversold ${oldParams.oversold} -> ${this.optimizedParams.oversold}`);
                this.saveState();
            }
        }
    } catch (e) {
        console.log(`⚠️ RSI Optimization failed: ${e.message}`);
    }
  }

  getOptimizedParams() {
    return this.optimizedParams;
  }
}
