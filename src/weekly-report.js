#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'trades.db');

function loadAllTrades() {
    if (!fs.existsSync(DB_PATH)) {
        return [];
    }
    
    const db = new Database(DB_PATH, { readonly: true });
    
    try {
        const trades = db.prepare(`
            SELECT *, pnl as profit, closed_at as timestamp FROM trades 
            WHERE side IS NOT NULL AND pnl IS NOT NULL
            ORDER BY closed_at ASC
        `).all();
        
        db.close();
        return trades;
    } catch (err) {
        db.close();
        return [];
    }
}

function groupByWeek(trades) {
    const weeks = {};
    
    trades.forEach(trade => {
        const date = new Date(trade.timestamp);
        // Get Monday of the week
        const monday = new Date(date);
        monday.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
        const weekKey = monday.toISOString().split('T')[0];
        
        if (!weeks[weekKey]) {
            weeks[weekKey] = [];
        }
        weeks[weekKey].push(trade);
    });
    
    return weeks;
}

function calculateMetrics(trades) {
    if (trades.length === 0) return null;
    
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const winRate = wins.length / trades.length;
    
    // Side distribution
    const longs = trades.filter(t => t.side === 'LONG');
    const shorts = trades.filter(t => t.side === 'SHORT');
    
    // Hour distribution
    const hourDist = {};
    trades.forEach(t => {
        const hour = new Date(t.timestamp).getHours();
        hourDist[hour] = (hourDist[hour] || 0) + 1;
    });
    
    // Average leverage
    const avgLeverage = trades.reduce((sum, t) => sum + (t.leverage || 10), 0) / trades.length;
    
    return {
        total: trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: (winRate * 100).toFixed(1),
        totalProfit: totalProfit.toFixed(2),
        avgProfit: (totalProfit / trades.length).toFixed(2),
        longs: longs.length,
        shorts: shorts.length,
        avgLeverage: avgLeverage.toFixed(1),
        mostActiveHour: Object.entries(hourDist).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    };
}

function loadRulesHistory() {
    const rulesPath = path.join(__dirname, '..', 'data', 'learned-rules.md');
    if (!fs.existsSync(rulesPath)) return [];
    
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const lines = content.split('\n');
    
    const history = [];
    let currentVersion = null;
    
    lines.forEach(line => {
        if (line.startsWith('## Version')) {
            const match = line.match(/Version (\d+\.\d+) - (.+)/);
            if (match) {
                currentVersion = {
                    version: match[1],
                    date: match[2],
                    rules: []
                };
                history.push(currentVersion);
            }
        } else if (currentVersion && line.trim().startsWith('-')) {
            currentVersion.rules.push(line.trim().substring(2));
        }
    });
    
    return history;
}

function generateReport() {
    console.log('============================================================');
    console.log('📈 WEEKLY STRATEGY EVOLUTION REPORT');
    console.log('============================================================');
    console.log(`Generated: ${new Date().toLocaleString('th-TH')}\n`);
    
    const trades = loadAllTrades();
    
    if (trades.length === 0) {
        console.log('❌ No trading data found.\n');
        return;
    }
    
    const weeks = groupByWeek(trades);
    const weekKeys = Object.keys(weeks).sort();
    
    console.log(`📊 Total trades: ${trades.length}`);
    console.log(`📅 Trading period: ${weekKeys[0]} to ${weekKeys[weekKeys.length - 1]}`);
    console.log(`🗓️  Weeks of trading: ${weekKeys.length}\n`);
    
    console.log('📈 WEEKLY BREAKDOWN');
    console.log('────────────────────────────────────────────────────────────');
    
    weekKeys.forEach((weekKey, idx) => {
        const weekTrades = weeks[weekKey];
        const metrics = calculateMetrics(weekTrades);
        
        if (!metrics) return;
        
        console.log(`\n📅 Week ${idx + 1}: ${weekKey}`);
        console.log(`   Trades: ${metrics.total} (${metrics.wins}W/${metrics.losses}L)`);
        console.log(`   Win Rate: ${metrics.winRate}%`);
        console.log(`   Profit: ${metrics.totalProfit} USDT (avg ${metrics.avgProfit} per trade)`);
        console.log(`   Side: ${metrics.longs} LONG, ${metrics.shorts} SHORT`);
        console.log(`   Avg Leverage: ${metrics.avgLeverage}x`);
        console.log(`   Most Active Hour: ${metrics.mostActiveHour}:00`);
    });
    
    console.log('\n\n🧠 STRATEGY EVOLUTION');
    console.log('────────────────────────────────────────────────────────────');
    
    const rulesHistory = loadRulesHistory();
    
    if (rulesHistory.length === 0) {
        console.log('   ℹ️  No rule evolution history yet.');
    } else {
        rulesHistory.slice(-5).reverse().forEach(version => {
            console.log(`\n📌 v${version.version} (${version.date})`);
            version.rules.forEach(rule => {
                console.log(`   • ${rule}`);
            });
        });
    }
    
    console.log('\n\n📊 OVERALL PERFORMANCE TREND');
    console.log('────────────────────────────────────────────────────────────');
    
    // Compare first half vs second half
    const midPoint = Math.floor(trades.length / 2);
    const firstHalf = trades.slice(0, midPoint);
    const secondHalf = trades.slice(midPoint);
    
    const m1 = calculateMetrics(firstHalf);
    const m2 = calculateMetrics(secondHalf);
    
    if (m1 && m2) {
        console.log(`\n📉 First ${m1.total} trades: ${m1.winRate}% win rate, ${m1.totalProfit} USDT`);
        console.log(`📈 Last ${m2.total} trades: ${m2.winRate}% win rate, ${m2.totalProfit} USDT`);
        
        const winRateDiff = parseFloat(m2.winRate) - parseFloat(m1.winRate);
        const profitDiff = parseFloat(m2.totalProfit) - parseFloat(m1.totalProfit);
        
        console.log(`\n${winRateDiff > 0 ? '✅' : '❌'} Win rate change: ${winRateDiff > 0 ? '+' : ''}${winRateDiff.toFixed(1)}%`);
        console.log(`${profitDiff > 0 ? '✅' : '❌'} Profit change: ${profitDiff > 0 ? '+' : ''}${profitDiff.toFixed(2)} USDT`);
    }
    
    console.log('\n============================================================\n');
    
    // Save report to file
    const reportPath = path.join(DATA_DIR, 'weekly-evolution-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        weeks: Object.fromEntries(
            weekKeys.map(key => [key, calculateMetrics(weeks[key])])
        ),
        rulesHistory,
        overallMetrics: {
            firstHalf: m1,
            secondHalf: m2
        }
    }, null, 2));
    
    console.log(`✅ Report saved to: ${reportPath}`);
}

generateReport();
