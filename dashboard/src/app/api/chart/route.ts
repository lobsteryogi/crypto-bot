import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface RawLog {
  timestamp: string;
  price: number;
  signal?: {
    indicators?: {
      rsi?: number;
      maFast?: number;
      maSlow?: number;
    };
    reason?: string;
  };
}

interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // using tick count as proxy
  rsi: number | null;
}

function calculateSMA(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
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
    
    if (!fs.existsSync(cycleLogPath)) {
      return NextResponse.json({ data: [] });
    }

    // Read file - taking a larger chunk to ensure we have enough history for candles
    // In production with huge files, readStream or tailing is better. 
    // Here we'll read the whole file if small, or last 500 lines roughly.
    // For simplicity/reliability in this env, reading strict lines.
    const content = fs.readFileSync(cycleLogPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    // We need enough data to build candles and then MAs. 
    // Let's take last 2000 ticks to form minute candles.
    const rawData: RawLog[] = lines.slice(-2000).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);

    if (rawData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Group by minute
    const candlesMap = new Map<number, Candle>();

    rawData.forEach(log => {
      const date = new Date(log.timestamp);
      // Floor to minute (seconds = 0)
      date.setSeconds(0, 0);
      const time = date.getTime() / 1000; // seconds

      if (!candlesMap.has(time)) {
        candlesMap.set(time, {
          time,
          open: log.price,
          high: log.price,
          low: log.price,
          close: log.price,
          volume: 1,
          rsi: null
        });
      } else {
        const c = candlesMap.get(time)!;
        c.high = Math.max(c.high, log.price);
        c.low = Math.min(c.low, log.price);
        c.close = log.price;
        c.volume += 1;
        // Update RSI from the latest tick in the candle if available
        if (log.signal?.indicators?.rsi) {
            c.rsi = log.signal.indicators.rsi;
        } else if (log.signal?.reason) {
            // Fallback parse RSI from reason string if not in indicators
            const match = log.signal.reason.match(/RSI.*?([\d.]+)/);
            if (match) c.rsi = parseFloat(match[1]);
        }
      }
    });

    const candles = Array.from(candlesMap.values()).sort((a, b) => a.time - b.time);

    // Calculate MAs based on Candle Closes
    const closePrices = candles.map(c => c.close);
    const ma5 = calculateSMA(closePrices, 5);
    const ma13 = calculateSMA(closePrices, 13);

    // Merge MAs into response
    const chartData = candles.map((c, i) => ({
      ...c,
      ma5: ma5[i],
      ma13: ma13[i]
    }));

    return NextResponse.json({
      data: chartData
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
