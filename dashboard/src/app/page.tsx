"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { TradeHistoryTable } from '../components/TradeHistoryTable';
import { TradingViewChart, ChartData } from '../components/TradingViewChart';

// --- Types ---

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
  openTime: string;
  closeTime: string;
  closeReason: string;
  reason: string;
  type: 'long' | 'short';
}

interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  amount: number;
  cost: number;
  openTime: string;
  reason: string;
  type: 'long' | 'short';
}

interface Cycle {
  timestamp: string;
  price: number;
  signal: { signal: string; reason: string };
}

interface Backlog {
  todo: string[];
  done: string[];
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
  changelog: string[];
  backlog: Backlog;
  configRaw: string;
}

// --- Components ---

const AlertBar = ({ changelog }: { changelog: string[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!changelog || changelog.length === 0) return null;

  return (
    <div className="bg-blue-900/30 border-b border-blue-800">
      <div 
        className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-sm text-blue-200">
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">NEW</span>
          <span className="font-mono">{changelog[0]}</span>
        </div>
        <div className="text-blue-400 text-xs hover:text-white transition-colors">
          {isOpen ? '▲ Hide History' : '▼ Show History'}
        </div>
      </div>
      {isOpen && (
        <div className="max-w-7xl mx-auto px-6 pb-4">
          <ul className="space-y-1 mt-2">
            {changelog.slice(1).map((log, i) => (
              <li key={i} className="text-xs text-blue-300 font-mono border-l-2 border-blue-700 pl-2">
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const PLChart = ({ trades }: { trades: Trade[] }) => {
  // Calculate cumulative P/L
  const dataPoints = useMemo(() => {
    let cumulative = 0;
    // Trades need to be sorted by date for the chart
    const sortedTrades = [...trades].sort((a, b) => new Date(a.closeTime || a.openTime).getTime() - new Date(b.closeTime || b.openTime).getTime());
    
    const points = sortedTrades.map((t, i) => {
      cumulative += t.profit;
      return { index: i + 1, value: cumulative, date: t.closeTime };
    });
    
    // Add start point
    return [{ index: 0, value: 0, date: '' }, ...points];
  }, [trades]);

  if (dataPoints.length < 2) return <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Not enough data for chart</div>;

  const min = Math.min(...dataPoints.map(p => p.value));
  const max = Math.max(...dataPoints.map(p => p.value));
  const range = max - min || 1;
  const height = 150;
  
  // Normalize points to SVG coordinates
  const pointsStr = dataPoints.map((p, i) => {
    const x = (i / (dataPoints.length - 1)) * 100 * 4; // Scale width roughly
    const y = height - ((p.value - min) / range) * height; // Invert Y
    return `${x},${y}`;
  }).join(' ');

  const isPositive = dataPoints[dataPoints.length - 1].value >= 0;

  return (
    <div className="w-full overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-400 mb-2">Profit/Loss Curve (Cumulative)</h3>
      <div className="relative h-[160px] w-full bg-gray-900/50 rounded-lg p-2 overflow-x-auto">
         <svg viewBox={`0 0 ${dataPoints.length * 4} ${height}`} className="h-full w-full min-w-full" preserveAspectRatio="none">
           {/* Zero line */}
           {min < 0 && max > 0 && (
             <line 
               x1="0" 
               y1={height - ((0 - min) / range) * height} 
               x2={dataPoints.length * 4} 
               y2={height - ((0 - min) / range) * height} 
               stroke="#4b5563" 
               strokeDasharray="4" 
               strokeWidth="1" 
             />
           )}
           <polyline
             fill="none"
             stroke={isPositive ? "#34d399" : "#f87171"}
             strokeWidth="2"
             points={pointsStr}
           />
         </svg>
      </div>
    </div>
  );
};

const HourlyWinRateChart = ({ trades }: { trades: Trade[] }) => {
  const hourlyStats = useMemo(() => {
    const hours = Array(24).fill(0).map(() => ({ wins: 0, total: 0 }));
    
    trades.forEach(t => {
      const time = t.closeTime || t.openTime;
      const hour = new Date(time).getHours();
      hours[hour].total++;
      if (t.profit > 0) hours[hour].wins++;
    });

    return hours.map((h, i) => ({
      hour: i,
      winRate: h.total > 0 ? (h.wins / h.total) * 100 : 0,
      total: h.total
    }));
  }, [trades]);

  return (
    <div className="w-full">
       <h3 className="text-sm font-semibold text-gray-400 mb-2">Win Rate by Hour (0-23h)</h3>
       <div className="h-[160px] bg-gray-900/50 rounded-lg p-2 flex items-end justify-between gap-0.5">
          {hourlyStats.map((stat) => (
            <div key={stat.hour} className="flex-1 flex flex-col items-center group relative">
               <div 
                 className={`w-full rounded-t-sm transition-all ${stat.total === 0 ? 'bg-gray-800' : stat.winRate >= 50 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                 style={{ height: `${stat.total === 0 ? 5 : Math.max(10, stat.winRate)}%` }}
               ></div>
               <div className="text-[8px] text-gray-500 mt-1">{stat.hour}</div>
               
               {/* Tooltip */}
               {stat.total > 0 && (
                 <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black text-white text-xs p-1 rounded z-10 whitespace-nowrap">
                   {stat.hour}:00 - {stat.winRate.toFixed(0)}% ({stat.total} trades)
                 </div>
               )}
            </div>
          ))}
       </div>
    </div>
  );
};

const BacklogSection = ({ backlog }: { backlog: Backlog }) => {
  if (!backlog || (!backlog.todo.length && !backlog.done.length)) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 mt-6">
      <h2 className="text-xl font-bold mb-4">🚀 Development Backlog</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-yellow-400 mb-2 uppercase tracking-wider">To Do</h3>
          <ul className="space-y-2">
            {backlog.todo.slice(0, 8).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <input type="checkbox" disabled className="mt-1 bg-gray-700 border-gray-600 rounded" />
                <span>{item}</span>
              </li>
            ))}
            {backlog.todo.length > 8 && <li className="text-xs text-gray-500 italic">+ {backlog.todo.length - 8} more...</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-2 uppercase tracking-wider">Completed</h3>
          <ul className="space-y-2">
            {backlog.done.slice(0, 8).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400 line-through">
                <input type="checkbox" checked disabled className="mt-1 bg-gray-700 border-gray-600 rounded accent-green-500" />
                <span>{item}</span>
              </li>
            ))}
             {backlog.done.length > 8 && <li className="text-xs text-gray-500 italic">+ {backlog.done.length - 8} more...</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

const StrategyCard = ({ configRaw }: { configRaw: string }) => {
  if (!configRaw) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 mt-6">
       <h2 className="text-xl font-bold mb-4">⚙️ Strategy Configuration</h2>
       <pre className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-300 overflow-x-auto max-h-64">
         {configRaw}
       </pre>
    </div>
  );
}

const ChartSection = () => {
  const [data, setData] = useState<ChartData[]>([]);
  
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/chart');
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch (e) { console.error("Chart load error:", e); }
    };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const currentRsi = data.length > 0 ? data[data.length - 1].rsi : null;

  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-8">
      <div className="flex justify-between items-start mb-4">
        <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
            📊 SOL/USDT Real-time (1m Candles)
            </h2>
            <div className="flex gap-4 text-xs mt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500"></span> Up</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500"></span> Down</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400"></span> MA(5)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400"></span> MA(13)</span>
            </div>
        </div>
        <div className="text-right">
           <div className="text-3xl font-mono font-bold text-white">${currentPrice.toFixed(2)}</div>
           {currentRsi !== null && currentRsi !== undefined && (
               <div className={`text-sm font-mono font-bold ${currentRsi > 70 ? 'text-red-400' : currentRsi < 30 ? 'text-green-400' : 'text-purple-400'}`}>
               RSI: {currentRsi.toFixed(1)}
               </div>
           )}
        </div>
      </div>
      
      <TradingViewChart data={data} />
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState<BotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    range: 'all',
    status: 'all',
    minProfit: '',
    maxProfit: '',
    sortBy: 'closeTime',
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('range', filters.range);
      params.append('status', filters.status);
      if (filters.minProfit) params.append('minProfit', filters.minProfit);
      if (filters.maxProfit) params.append('maxProfit', filters.maxProfit);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const res = await fetch(`/api/stats?${params.toString()}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [filters]);

  // Initial load and filter changes
  useEffect(() => {
    fetchData(false);
  }, [fetchData]); // fetchData depends on filters

  // Background polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-2xl animate-pulse text-blue-400">🤖 Loading Dashboard...</div>
      </div>
    );
  }

  if (error && !data) return <div className="text-red-500 p-10">Error: {error}</div>;
  if (!data) return null;

  const profitColor = parseFloat(data.stats.totalProfit) >= 0 ? "text-green-400" : "text-red-400";
  const roiColor = parseFloat(data.stats.roi) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-10">
      <AlertBar changelog={data.changelog} />
      
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
             <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
               Crypto Bot Dashboard
             </h1>
             <p className="text-gray-400 text-sm mt-1">
               Status: <span className={data.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>{data.status}</span>
               <span className="mx-2">•</span>
               Last Update: {data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : 'N/A'}
             </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-3xl font-mono font-bold">${data.balance.toFixed(2)}</div>
            <div className={`text-sm ${roiColor}`}>
               ROI: {data.stats.roi}% (${data.stats.totalProfit})
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-gray-400 text-xs uppercase">Win Rate (All)</div>
              <div className="text-2xl font-bold text-white">{data.stats.winRate}%</div>
              <div className="text-xs text-gray-500">{data.stats.wins}W - {data.stats.losses}L</div>
           </div>
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-gray-400 text-xs uppercase">Total Trades</div>
              <div className="text-2xl font-bold text-white">{data.stats.totalTrades}</div>
              <div className="text-xs text-gray-500">Avg {data.stats.avgProfit}</div>
           </div>
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-gray-400 text-xs uppercase">Total P/L</div>
              <div className={`text-2xl font-bold ${profitColor}`}>{data.stats.totalProfit}</div>
              <div className="text-xs text-gray-500">USDT</div>
           </div>
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 md:hidden">
              <div className="text-gray-400 text-xs uppercase">Balance</div>
              <div className="text-2xl font-bold text-white">${data.balance.toFixed(2)}</div>
           </div>
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-gray-400 text-xs uppercase">Active Positions</div>
              <div className="text-2xl font-bold text-blue-400">{data.positions.length}</div>
              <div className="text-xs text-gray-500">Open trades</div>
           </div>
        </div>

        <ChartSection />

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <PLChart trades={data.trades} />
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <HourlyWinRateChart trades={data.trades} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Trades & Signals */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Positions */}
            {data.positions.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Open Positions
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-2">Symbol</th>
                        <th className="px-4 py-2">Entry</th>
                        <th className="px-4 py-2">Size</th>
                        <th className="px-4 py-2">Reason</th>
                        <th className="px-4 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {data.positions.map(p => (
                        <tr key={p.id} className="hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-semibold text-white">{p.symbol}</td>
                          <td className="px-4 py-3">${p.entryPrice}</td>
                          <td className="px-4 py-3 text-gray-300">{p.amount.toFixed(4)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate" title={p.reason}>{p.reason}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.openTime).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trade History Table */}
            <div className="h-[600px] flex flex-col">
               <h2 className="text-lg font-bold mb-3">Trade History</h2>
               <TradeHistoryTable 
                  trades={data.trades} 
                  filters={filters} 
                  onFilterChange={setFilters} 
                  isLoading={loading}
                />
            </div>

          </div>

          {/* Right Column: Backlog & Config */}
          <div className="space-y-6">
             <BacklogSection backlog={data.backlog} />
             
             {/* Recent Signals Log */}
             {data.recentCycles && data.recentCycles.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <h2 className="text-lg font-bold mb-3">Signal Log</h2>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {data.recentCycles.slice(0, 8).map((c, i) => (
                      <div key={i} className="text-xs border-l-2 border-gray-600 pl-2 py-1">
                         <div className="flex justify-between text-gray-400">
                           <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
                           <span>${c.price}</span>
                         </div>
                         <div className={`font-semibold ${
                           c.signal.signal === 'buy' ? 'text-green-400' : 
                           c.signal.signal === 'sell' ? 'text-red-400' : 'text-gray-500'
                         }`}>
                           {c.signal.signal.toUpperCase()}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
             )}

             <StrategyCard configRaw={data.configRaw} />
          </div>
        </div>

      </main>
    </div>
  );
}
