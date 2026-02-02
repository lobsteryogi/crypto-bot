import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), '..', 'data');
    const statePath = path.join(dataDir, 'paper_state.json');
    
    if (!fs.existsSync(statePath)) {
      return NextResponse.json({
        status: 'waiting',
        message: 'Bot starting up...',
        balance: 10000,
        initialBalance: 10000,
        trades: [],
        positions: [],
        stats: {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalProfit: 0,
          roi: 0,
        }
      });
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const trades = state.trades || [];
    const positions = state.positions || [];
    const balance = state.balance || 10000;
    const initialBalance = 10000;

    const wins = trades.filter((t: any) => t.profit > 0);
    const losses = trades.filter((t: any) => t.profit <= 0);
    const totalProfit = trades.reduce((sum: number, t: any) => sum + t.profit, 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length * 100) : 0;
    const roi = ((balance - initialBalance) / initialBalance * 100);

    // Read recent cycle logs
    const logsDir = path.join(process.cwd(), '..', 'logs');
    const cycleLogPath = path.join(logsDir, 'cycles.jsonl');
    let recentCycles: any[] = [];
    
    if (fs.existsSync(cycleLogPath)) {
      const lines = fs.readFileSync(cycleLogPath, 'utf-8').trim().split('\n');
      recentCycles = lines.slice(-20).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean).reverse();
    }

    return NextResponse.json({
      status: 'running',
      lastUpdate: state.lastUpdate,
      balance,
      initialBalance,
      trades: trades.slice(-10).reverse(),
      positions,
      recentCycles,
      stats: {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: winRate.toFixed(1),
        totalProfit: totalProfit.toFixed(2),
        roi: roi.toFixed(2),
        avgProfit: trades.length > 0 ? (totalProfit / trades.length).toFixed(2) : '0.00',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
