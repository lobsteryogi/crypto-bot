// Paper trading engine - simulates trades without real money
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

export class PaperTrader {
  constructor(initialBalance = 10000) {
    this.balance = initialBalance;
    this.initialBalance = initialBalance;
    this.positions = []; // Open positions
    this.trades = []; // Completed trades
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
        console.log(`📂 Loaded state: Balance ${this.balance.toFixed(2)} USDT, ${this.positions.length} open positions, ${this.trades.length} trades`);
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
      lastUpdate: new Date().toISOString()
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  // Open a new position
  buy(symbol, price, amount, reason) {
    const cost = price * amount;
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
      reason,
      openTime: new Date().toISOString(),
    };

    this.balance -= cost;
    this.positions.push(position);
    this.saveState();

    console.log(`🟢 BUY: ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} (${cost.toFixed(2)} USDT)`);
    return { success: true, position };
  }

  // Close a position
  sell(positionId, price, reason) {
    const posIndex = this.positions.findIndex(p => p.id === positionId);
    if (posIndex === -1) {
      return { success: false, reason: 'Position not found' };
    }

    const position = this.positions[posIndex];
    const revenue = price * position.amount;
    const profit = revenue - position.cost;
    const profitPercent = (profit / position.cost) * 100;

    const trade = {
      ...position,
      exitPrice: price,
      revenue,
      profit,
      profitPercent,
      closeTime: new Date().toISOString(),
      closeReason: reason,
      duration: Date.now() - new Date(position.openTime).getTime(),
    };

    this.balance += revenue;
    this.trades.push(trade);
    this.positions.splice(posIndex, 1);
    this.saveState();

    const emoji = profit > 0 ? '🟢' : '🔴';
    console.log(`${emoji} SELL: ${position.amount.toFixed(6)} ${position.symbol} @ ${price.toFixed(2)} | P/L: ${profit.toFixed(2)} USDT (${profitPercent.toFixed(2)}%)`);
    return { success: true, trade };
  }

  // Check stop loss / take profit for all positions
  checkPositions(currentPrice, stopLossPercent, takeProfitPercent) {
    const closedTrades = [];
    
    for (const position of [...this.positions]) {
      const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      
      if (priceChange <= -stopLossPercent) {
        const result = this.sell(position.id, currentPrice, `Stop loss triggered (${priceChange.toFixed(2)}%)`);
        if (result.success) closedTrades.push(result.trade);
      } else if (priceChange >= takeProfitPercent) {
        const result = this.sell(position.id, currentPrice, `Take profit triggered (${priceChange.toFixed(2)}%)`);
        if (result.success) closedTrades.push(result.trade);
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
      openPositions: this.positions.length,
      roi: ((this.balance - this.initialBalance) / this.initialBalance * 100).toFixed(2),
    };
  }
}
