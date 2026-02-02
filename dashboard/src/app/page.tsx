"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: string;
  totalProfit: string;
  roi: string;
  avgProfit: string;
}

interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  closeTime: string;
  closeReason: string;
}

interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  amount: number;
  cost: number;
  openTime: string;
  reason: string;
}

interface Cycle {
  timestamp: string;
  price: number;
  signal: { signal: string; reason: string };
}

interface BotData {
  status: string;
  message?: string;
  lastUpdate?: string;
  balance: number;
  initialBalance: number;
  trades: Trade[];
  positions: Position[];
  recentCycles?: Cycle[];
  stats: Stats;
}

export default function Dashboard() {
  const [data, setData] = useState<BotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">🤖 Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-xl">❌ Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const profitColor = parseFloat(data.stats.totalProfit) >= 0 ? "text-green-400" : "text-red-400";
  const roiColor = parseFloat(data.stats.roi) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <main className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🤖 Crypto Trading Bot</h1>
        <p className="text-gray-400 text-lg">Build → Trade → Evaluate → Repeat</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${data.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
          <span className="text-sm text-gray-400">
            {data.status === 'running' ? 'Bot Running' : data.message || 'Starting...'}
          </span>
          {data.lastUpdate && (
            <span className="text-sm text-gray-500 ml-4">
              Last update: {new Date(data.lastUpdate).toLocaleTimeString('th-TH')}
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Balance</div>
          <div className="text-2xl font-bold">${data.balance.toFixed(2)}</div>
          <div className="text-gray-500 text-xs">Initial: ${data.initialBalance}</div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total P/L</div>
          <div className={`text-2xl font-bold ${profitColor}`}>
            {parseFloat(data.stats.totalProfit) >= 0 ? '+' : ''}{data.stats.totalProfit} USDT
          </div>
          <div className={`text-sm ${roiColor}`}>
            ROI: {parseFloat(data.stats.roi) >= 0 ? '+' : ''}{data.stats.roi}%
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Win Rate</div>
          <div className="text-2xl font-bold">{data.stats.winRate}%</div>
          <div className="text-gray-500 text-xs">
            {data.stats.wins}W / {data.stats.losses}L
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Trades</div>
          <div className="text-2xl font-bold">{data.stats.totalTrades}</div>
          <div className="text-gray-500 text-xs">
            Avg: ${data.stats.avgProfit}/trade
          </div>
        </div>
      </div>

      {/* Open Positions */}
      {data.positions.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="text-xl font-bold mb-4">📦 Open Positions</h2>
          <div className="space-y-2">
            {data.positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                <div>
                  <span className="font-semibold">{p.symbol}</span>
                  <span className="text-gray-400 ml-2">{p.amount.toFixed(6)} @ ${p.entryPrice.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">${p.cost.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{new Date(p.openTime).toLocaleString('th-TH')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Signals */}
      {data.recentCycles && data.recentCycles.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="text-xl font-bold mb-4">📈 Recent Signals</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentCycles.slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${
                    c.signal.signal === 'buy' ? '🟢' : 
                    c.signal.signal === 'sell' ? '🔴' : '⚪'
                  }`}>
                    {c.signal.signal === 'buy' ? '🟢' : c.signal.signal === 'sell' ? '🔴' : '⚪'}
                  </span>
                  <div>
                    <div className="font-semibold uppercase">{c.signal.signal}</div>
                    <div className="text-sm text-gray-400">{c.signal.reason}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono">${c.price.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.timestamp).toLocaleTimeString('th-TH')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      {data.trades.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-xl font-bold mb-4">📋 Recent Trades</h2>
          <div className="space-y-2">
            {data.trades.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.profit > 0 ? '🟢' : '🔴'}</span>
                  <div>
                    <div className="font-semibold">{t.symbol}</div>
                    <div className="text-sm text-gray-400">
                      ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${t.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.profit > 0 ? '+' : ''}{t.profit.toFixed(2)} USDT
                  </div>
                  <div className={`text-sm ${t.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.profitPercent > 0 ? '+' : ''}{t.profitPercent.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(t.closeTime).toLocaleString('th-TH')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.trades.length === 0 && data.positions.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🔄</div>
          <h3 className="text-xl font-bold mb-2">Waiting for signals...</h3>
          <p className="text-gray-400">
            Bot is analyzing the market. Trades will appear here when signals are triggered.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>🦞 Powered by เฮียรอบ | Paper Trading Mode</p>
        <p className="mt-1">Auto-refresh every 10 seconds</p>
      </div>
    </main>
  );
}
