import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rootDir = path.join(process.cwd(), '..');
    const dataDir = path.join(rootDir, 'data');
    const statePath = path.join(dataDir, 'paper_state.json');
    
    // --- 1. Fetch Bot State ---
    let state: any = {};
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }

    const trades = state.trades || [];
    const positions = state.positions || [];
    const balance = state.balance || 10000;
    const initialBalance = 10000;

    const wins = trades.filter((t: any) => t.profit > 0);
    const losses = trades.filter((t: any) => t.profit <= 0);
    const totalProfit = trades.reduce((sum: number, t: any) => sum + t.profit, 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length * 100) : 0;
    const roi = ((balance - initialBalance) / initialBalance * 100);

    // --- 2. Fetch Recent Cycles ---
    const logsDir = path.join(rootDir, 'logs');
    const cycleLogPath = path.join(logsDir, 'cycles.jsonl');
    let recentCycles: any[] = [];
    
    if (fs.existsSync(cycleLogPath)) {
      const lines = fs.readFileSync(cycleLogPath, 'utf-8').trim().split('\n');
      recentCycles = lines.slice(-20).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean).reverse();
    }

    // --- 3. Fetch Changelog (Git) ---
    let changelog: string[] = [];
    try {
      const logOutput = execSync('git log -n 5 --pretty=format:"%h - %s (%cr)"', { cwd: rootDir }).toString();
      changelog = logOutput.split('\n').filter(Boolean);
    } catch (e) {
      changelog = ['Could not fetch git log.'];
    }

    // --- 4. Fetch Backlog ---
    let backlog = { todo: [] as string[], done: [] as string[] };
    try {
      const backlogPath = path.join(rootDir, 'BACKLOG.md');
      if (fs.existsSync(backlogPath)) {
        const content = fs.readFileSync(backlogPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.includes('- [ ]')) backlog.todo.push(line.replace('- [ ]', '').trim());
          else if (line.includes('- [x]')) backlog.done.push(line.replace('- [x]', '').trim());
        });
      }
    } catch (e) {
      console.error("Backlog error", e);
    }

    // --- 5. Fetch Strategy Config ---
    let configStr = "";
    try {
      const configPath = path.join(rootDir, 'src', 'config.js');
      if (fs.existsSync(configPath)) {
        // Read file and try to extract the config object text roughly
        // We'll send the raw text or a cleaner version. sending raw text is safer than eval for now unless we need structured data.
        // Actually, let's try to extract JSON-like parts or just send the whole useful block.
        // For display purposes, sending the relevant sections of the file is enough.
        const fullContent = fs.readFileSync(configPath, 'utf-8');
        
        // Extract the object inside export const config = { ... };
        const match = fullContent.match(/export const config = ({[\s\S]*?});/);
        if (match) {
            configStr = match[1];
        } else {
            configStr = "Could not parse config.js";
        }
      }
    } catch (e) {
      configStr = "Config file not found";
    }

    return NextResponse.json({
      status: 'running',
      lastUpdate: state.lastUpdate,
      balance,
      initialBalance,
      trades: trades.reverse(), // Send all trades for charting, reversed for list
      positions,
      recentCycles,
      changelog,
      backlog,
      configRaw: configStr,
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
