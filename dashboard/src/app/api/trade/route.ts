import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getLatestPrice(): number {
  try {
    const rootDir = path.join(process.cwd(), '..');
    const logsDir = path.join(rootDir, 'logs');
    const cycleLogPath = path.join(logsDir, 'cycles.jsonl');
    
    if (!fs.existsSync(cycleLogPath)) return 0;

    // Read last few bytes/lines to get the latest entry efficiently
    // For simplicity in this env, we read the file but only the end if possible
    // or just read the whole thing if small. Given the previous `tail` worked, 
    // let's read the whole file and take the last line (node fs doesn't have simple tail).
    // Optimization: Read last 2KB.
    const fd = fs.openSync(cycleLogPath, 'r');
    const stats = fs.statSync(cycleLogPath);
    const size = stats.size;
    const bufferSize = Math.min(2048, size);
    const buffer = Buffer.alloc(bufferSize);
    
    fs.readSync(fd, buffer, 0, bufferSize, size - bufferSize);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf-8');
    const lines = content.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    
    if (!lastLine) return 0;
    
    const data = JSON.parse(lastLine);
    return data.price || 0;
  } catch (e) {
    console.error("Error fetching price:", e);
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, symbol = "SOL/USDT", amount, positionId } = body;

    const rootDir = path.join(process.cwd(), '..');
    const dataDir = path.join(rootDir, 'data');
    const statePath = path.join(dataDir, 'paper_state.json');

    // 1. Load State
    if (!fs.existsSync(statePath)) {
      return NextResponse.json({ status: 'error', message: 'State file not found' }, { status: 404 });
    }
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

    // 2. Get Price
    const currentPrice = getLatestPrice();
    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json({ status: 'error', message: 'Could not fetch current market price' }, { status: 500 });
    }

    const timestamp = Date.now();
    const dateStr = new Date(timestamp).toISOString();

    let message = "";

    // 3. Handle Actions
    if (action === 'buy') {
      const cost = parseFloat(amount) || 100; // Default 100 USDT
      const leverage = 10; // Default leverage
      
      // Calculate position size (coins)
      // Amount is Margin. Position Value = Margin * Leverage.
      // Coins = (Margin * Leverage) / Price
      const positionValue = cost * leverage;
      const coinAmount = positionValue / currentPrice;

      const newPosition = {
        id: timestamp.toString(),
        symbol,
        type: 'long', // Manual trades default to long for now as per req "Buy SOL"
        entryPrice: currentPrice,
        amount: coinAmount,
        cost: cost,
        leverage: leverage,
        reason: "Manual Entry",
        openTime: dateStr
      };

      state.positions = state.positions || [];
      state.positions.push(newPosition);
      state.balance -= cost; // Deduct margin from balance

      message = `Opened Long ${symbol} @ ${currentPrice}`;

    } else if (action === 'sell') {
      // Close specific position or last one if not specified
      state.positions = state.positions || [];
      if (state.positions.length === 0) {
        return NextResponse.json({ status: 'error', message: 'No positions to close' }, { status: 400 });
      }

      let posIndex = -1;
      if (positionId) {
        posIndex = state.positions.findIndex((p: any) => p.id === positionId);
      } else {
        // Default to closing the last one? Or finding a matching symbol?
        // Req says "Sell SOL (closes all positions)" actually, wait.
        // Req: "Sell SOL" button (closes all positions) 
        // AND "Close All" emergency button.
        // Implementation detail says: POST { action: "sell", positionId: "..." }
        // Let's support individual close if ID provided, otherwise error.
      }

      if (posIndex === -1 && positionId) {
         return NextResponse.json({ status: 'error', message: 'Position not found' }, { status: 404 });
      }
      
      // If we are here via "sell" action with specific ID
      if (posIndex !== -1) {
        const pos = state.positions[posIndex];
        const revenue = (pos.amount * currentPrice); // Total value now
        const initialValue = (pos.amount * pos.entryPrice);
        const pnl = revenue - initialValue; // For Long. (Short would be different)
        
        // Return margin + pnl to balance
        // revenue includes the borrowed amount? 
        // Logic: 
        // Margin = 100. Leverage = 10. PosVal = 1000. Price = 100. Coins = 10.
        // Price -> 110. PosVal = 1100. PnL = 100. 
        // Balance should get: Margin + PnL = 200.
        // Formula: Balance += Cost + PnL
        
        // Wait, revenue calculation above: 10 coins * 110 = 1100.
        // Initial Value = 1000.
        // PnL = 100.
        // Balance += cost + pnl.
        
        state.balance += pos.cost + pnl;

        const tradeRecord = {
          ...pos,
          exitPrice: currentPrice,
          revenue: revenue, // This is total position value
          profit: pnl,
          profitPercent: (pnl / pos.cost) * 100,
          closeTime: dateStr,
          closeReason: "Manual Exit",
          duration: timestamp - new Date(pos.openTime).getTime()
        };

        state.trades = state.trades || [];
        state.trades.push(tradeRecord);
        
        // Remove from positions
        state.positions.splice(posIndex, 1);
        message = `Closed position ${pos.id} @ ${currentPrice}. PnL: ${pnl.toFixed(2)}`;
      }

    } else if (action === 'close-all') {
      state.positions = state.positions || [];
      if (state.positions.length === 0) {
        return NextResponse.json({ status: 'success', message: 'No positions to close' });
      }

      let closedCount = 0;
      let totalPnL = 0;

      // Process all positions in reverse to safely splice
      for (let i = state.positions.length - 1; i >= 0; i--) {
        const pos = state.positions[i];
        const revenue = (pos.amount * currentPrice);
        const initialValue = (pos.amount * pos.entryPrice);
        const pnl = revenue - initialValue;

        state.balance += pos.cost + pnl;

        const tradeRecord = {
          ...pos,
          exitPrice: currentPrice,
          revenue: revenue,
          profit: pnl,
          profitPercent: (pnl / pos.cost) * 100,
          closeTime: dateStr,
          closeReason: "Manual Close All",
          duration: timestamp - new Date(pos.openTime).getTime()
        };

        state.trades = state.trades || [];
        state.trades.push(tradeRecord);
        state.positions.splice(i, 1);
        
        totalPnL += pnl;
        closedCount++;
      }
      
      message = `Closed ${closedCount} positions. Total PnL: ${totalPnL.toFixed(2)}`;
    } else {
        return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });
    }

    state.lastUpdate = dateStr;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    return NextResponse.json({ status: 'success', message, data: { price: currentPrice, balance: state.balance } });

  } catch (error: any) {
    console.error("Trade API Error:", error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
