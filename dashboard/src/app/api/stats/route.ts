import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || 'all';
    const status = searchParams.get('status') || 'all';
    const minProfit = searchParams.get('minProfit');
    const maxProfit = searchParams.get('maxProfit');
    const sortBy = searchParams.get('sortBy') || 'closeTime';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

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

    // --- Global Stats (Unfiltered) ---
    const allWins = trades.filter((t: any) => t.profit > 0);
    const allLosses = trades.filter((t: any) => t.profit <= 0);
    const totalProfit = trades.reduce((sum: number, t: any) => sum + t.profit, 0);
    const winRate = trades.length > 0 ? (allWins.length / trades.length * 100) : 0;
    const roi = ((balance - initialBalance) / initialBalance * 100);

    // --- Filtering ---
    let filteredTrades = [...trades];

    // Date Range
    const now = new Date();
    if (range !== 'all') {
      filteredTrades = filteredTrades.filter((t: any) => {
        const date = new Date(t.closeTime || t.openTime);
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24); 

        if (range === 'today') return diffDays <= 1;
        if (range === 'week') return diffDays <= 7;
        if (range === 'month') return diffDays <= 30;
        return true;
      });
    }

    // Status (Win/Loss)
    if (status !== 'all') {
      filteredTrades = filteredTrades.filter((t: any) => {
        if (status === 'win') return t.profit > 0;
        if (status === 'loss') return t.profit <= 0;
        return true;
      });
    }

    // Profit Range
    if (minProfit) {
      filteredTrades = filteredTrades.filter((t: any) => t.profit >= parseFloat(minProfit));
    }
    if (maxProfit) {
      filteredTrades = filteredTrades.filter((t: any) => t.profit <= parseFloat(maxProfit));
    }

    // Sorting
    filteredTrades.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle dates and numbers
      if (sortBy.toLowerCase().includes('time')) {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else if (typeof valA === 'number') {
        // Numbers are fine
      } else {
        // Strings
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // --- 1.5. Win Rate by Day of Week ---
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats = Array(7).fill(0).map((_, i) => ({ 
        day: daysOfWeek[i], 
        trades: 0, 
        wins: 0,
        winRate: 0
    }));

    trades.forEach((t: any) => {
        if (t.closeTime) {
            const date = new Date(t.closeTime);
            const dayIndex = date.getDay(); // 0 = Sunday
            dayStats[dayIndex].trades++;
            if (t.profit > 0) {
                dayStats[dayIndex].wins++;
            }
        }
    });

    // Calculate percentages
    dayStats.forEach(stat => {
        if (stat.trades > 0) {
            stat.winRate = parseFloat(((stat.wins / stat.trades) * 100).toFixed(1));
        }
    });

    // Rotate to Mon-Sun (Sun is index 0 in getDay(), so move it to end)
    const winRateByDay = [...dayStats.slice(1), dayStats[0]];

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
      // Ignore
    }

    // --- 5. Fetch Strategy Config ---
    let configStr = "";
    try {
      const configPath = path.join(rootDir, 'src', 'config.js');
      if (fs.existsSync(configPath)) {
        const fullContent = fs.readFileSync(configPath, 'utf-8');
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
      trades: filteredTrades,
      allTradesCount: trades.length, 
      positions,
      winRateByDay,
      recentCycles,
      changelog,
      backlog,
      configRaw: configStr,
      stats: {
        totalTrades: trades.length,
        wins: allWins.length,
        losses: allLosses.length,
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
