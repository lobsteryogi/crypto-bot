import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface ChartPoint {
  timestamp: string;
  price: number;
  rsi: number | null;
  maFast: number | null;
  maSlow: number | null;
  signal?: string;
}

function calculateSMA(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null as any); // Or handle initial undefined
      continue;
    }
    const slice = data.slice(i - window + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
}

export async function GET() {
  try {
    const rootDir = path.join(process.cwd(), '..');
    const logsDir = path.join(rootDir, 'logs');
    const cycleLogPath = path.join(logsDir, 'cycles.jsonl');
    
    let chartData: ChartPoint[] = [];
    
    if (fs.existsSync(cycleLogPath)) {
      // Read file
      const content = fs.readFileSync(cycleLogPath, 'utf-8');
      const lines = content.trim().split('\n');
      
      // Take last 100 lines for the chart
      // We need a bit more history to calculate MAs correctly for the visible part if we were calculating strictly on this slice,
      // but since we are just visualizing the "recent window", calculating on the last 150 and returning 100 is safer.
      const sliceSize = 150; 
      const rawData = lines.slice(-sliceSize).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);

      const prices = rawData.map(d => d.price);
      
      // Calculate MAs locally based on the prices in the log
      // This ensures they match the chart visual exactly
      const ma5 = calculateSMA(prices, 5);
      const ma13 = calculateSMA(prices, 13);

      chartData = rawData.map((d, i) => {
        // Try to get RSI from log, otherwise null (or could calc, but log has the "bot's view")
        // Log path: signal.indicators.rsi1m or signal.reason parsing if needed
        let rsi = null;
        if (d.signal?.indicators?.rsi1m) {
          rsi = d.signal.indicators.rsi1m;
        } else if (d.signal?.reason && d.signal.reason.includes('RSI')) {
             // Fallback: try to extract RSI from reason string "RSI overbought (84.75)"
             const match = d.signal.reason.match(/RSI.*?([\d.]+)/);
             if (match) rsi = parseFloat(match[1]);
        }

        return {
          timestamp: d.timestamp,
          price: d.price,
          rsi: rsi,
          maFast: ma5[i], // 5
          maSlow: ma13[i], // 13
          signal: d.signal?.signal // buy/sell for markers
        };
      });

      // Trim to the requested display size (last 100 max)
      if (chartData.length > 100) {
        chartData = chartData.slice(chartData.length - 100);
      }
    }

    return NextResponse.json({
      data: chartData
    });

  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
