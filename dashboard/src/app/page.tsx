"use client";

import { useEffect, useState, useMemo } from "react";

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
  closeTime: string;
  closeReason: string;
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
    // Trades come in reverse chronological order (newest first) from API for the list, 
    // but for the chart we need oldest first.
    const sortedTrades = [...trades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());
    
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
  const width = 100; // percent

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
      const hour = new Date(t.closeTime).getHours();
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

  // Simple clean up to show just the params part if possible, or render nicely
  // We'll just render it in a scrollable code block
  return (
    <div className="bg-gray-800 rounded-xl p-4 mt-6">
       <h2 className="text-xl font-bold mb-4">⚙️ Strategy Configuration</h2>
       <pre className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-300 overflow-x-auto max-h-64">
         {configRaw}
       </pre>
    </div>
  );
}

const PriceChart = () => {
  const [data, setData] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        const res = await fetch('/api/chart');
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch (e) { console.error(e); }
    };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  if (!mounted || data.length < 5) return null;

  const prices = data.map(d => d.price);
  const ma5s = data.map(d => d.maFast);
  const ma13s = data.map(d => d.maSlow);
  
  // Filter out nulls for min/max calc
  const validPrices = prices.filter((n): n is number => typeof n === 'number');
  const validMa5 = ma5s.filter((n): n is number => typeof n === 'number');
  const validMa13 = ma13s.filter((n): n is number => typeof n === 'number');

  const allValues = [...validPrices, ...validMa5, ...validMa13];
  if (allValues.length === 0) return null;

  const minPrice = Math.min(...allValues);
  const maxPrice = Math.max(...allValues);
  const priceRange = maxPrice - minPrice || 1;
  
  // SVG Dimensions
  const width = 800;
  const height = 300;
  const padding = 0; 
  // We'll use full width and overlay labels to save space or just standard padding
  // Let's use slight padding for lines not to hit edge
  
  const getX = (i: number) => (i / (data.length - 1)) * width;
  const getY = (val: number) => height - ((val - minPrice) / priceRange) * height;

  // Lines
  const pricePoints = data.map((d, i) => `${getX(i)},${getY(d.price)}`).join(' ');
  const ma5Points = data.map((d, i) => d.maFast ? `${getX(i)},${getY(d.maFast)}` : null).filter(Boolean).join(' ');
  const ma13Points = data.map((d, i) => d.maSlow ? `${getX(i)},${getY(d.maSlow)}` : null).filter(Boolean).join(' ');

  // RSI
  const rsiHeight = 80;
  const rsiPoints = data.map((d, i) => {
    if (d.rsi === null || d.rsi === undefined) return null;
    // RSI 0-100. Invert Y.
    const y = rsiHeight - (d.rsi / 100) * rsiHeight;
    return `${getX(i)},${y}`; 
  }).filter(Boolean).join(' ');

  const currentPrice = data[data.length-1].price;
  const currentRsi = data[data.length-1].rsi;

  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-8">
      <div className="flex justify-between items-start mb-4">
        <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
            📊 SOL/USDT Real-time
            </h2>
            <div className="flex gap-4 text-xs mt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-200"></span> Price</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400"></span> MA(5)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400"></span> MA(13)</span>
            </div>
        </div>
        <div className="text-right">
           <div className="text-3xl font-mono font-bold text-white">${currentPrice.toFixed(2)}</div>
           {currentRsi !== null && (
               <div className={`text-sm font-mono font-bold ${currentRsi > 70 ? 'text-red-400' : currentRsi < 30 ? 'text-green-400' : 'text-purple-400'}`}>
               RSI: {currentRsi.toFixed(1)}
               </div>
           )}
        </div>
      </div>
      
      {/* Price Chart */}
      <div className="relative h-[300px] w-full bg-gray-900/50 rounded-lg overflow-hidden mb-1 border border-gray-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
           {/* Grid lines */}
           <line x1="0" y1={getY(minPrice + priceRange*0.25)} x2={width} y2={getY(minPrice + priceRange*0.25)} stroke="#374151" strokeDasharray="4" opacity="0.5" />
           <line x1="0" y1={getY(minPrice + priceRange*0.5)} x2={width} y2={getY(minPrice + priceRange*0.5)} stroke="#374151" strokeDasharray="4" opacity="0.5" />
           <line x1="0" y1={getY(minPrice + priceRange*0.75)} x2={width} y2={getY(minPrice + priceRange*0.75)} stroke="#374151" strokeDasharray="4" opacity="0.5" />
           
           {/* MA Lines */}
           <polyline points={ma13Points} fill="none" stroke="#60a5fa" strokeWidth="2" strokeOpacity="0.8" />
           <polyline points={ma5Points} fill="none" stroke="#facc15" strokeWidth="2" strokeOpacity="0.8" />
           
           {/* Price Line */}
           <polyline points={pricePoints} fill="none" stroke="#e5e7eb" strokeWidth="2" />
           
           {/* Current Price Dot */}
           <circle cx={getX(data.length-1)} cy={getY(currentPrice)} r="3" fill="#fff" />
        </svg>
        
        {/* Y Axis Labels Overlay */}
        <div className="absolute right-1 top-1 text-[10px] text-gray-500 bg-gray-900/80 px-1 rounded">{maxPrice.toFixed(2)}</div>
        <div className="absolute right-1 bottom-1 text-[10px] text-gray-500 bg-gray-900/80 px-1 rounded">{minPrice.toFixed(2)}</div>
      </div>

      {/* RSI Chart */}
      <div className="relative h-[80px] w-full bg-gray-900/30 rounded-lg overflow-hidden border border-gray-800">
        <div className="absolute top-0.5 left-1 text-[9px] text-gray-500 font-bold">RSI (14)</div>
        <svg viewBox={`0 0 ${width} ${rsiHeight}`} className="w-full h-full" preserveAspectRatio="none">
           {/* Zones */}
           <rect x="0" y={(1 - 70/100)*rsiHeight} width={width} height={(40/100)*rsiHeight} fill="rgba(192, 132, 252, 0.05)" />
           <line x1="0" y1={(1 - 70/100)*rsiHeight} x2={width} y2={(1 - 70/100)*rsiHeight} stroke="#4b5563" strokeDasharray="2" strokeWidth="0.5" />
           <line x1="0" y1={(1 - 30/100)*rsiHeight} x2={width} y2={(1 - 30/100)*rsiHeight} stroke="#4b5563" strokeDasharray="2" strokeWidth="0.5" />

           <polyline points={rsiPoints} fill="none" stroke="#c084fc" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-2xl animate-pulse text-blue-400">🤖 Loading Dashboard...</div>
      </div>
    );
  }

  if (error) return <div className="text-red-500 p-10">Error: {error}</div>;
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
              <div className="text-gray-400 text-xs uppercase">Win Rate</div>
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

        <PriceChart />

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

            {/* Recent Trades */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
               <h2 className="text-lg font-bold mb-3">Recent History</h2>
               <div className="space-y-2">
                 {data.trades.slice(0, 5).map(t => (
                   <div key={t.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className={`text-lg ${t.profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                           {t.profit > 0 ? '↗' : '↘'}
                         </div>
                         <div>
                           <div className="font-semibold text-white">{t.symbol}</div>
                           <div className="text-xs text-gray-500">{new Date(t.closeTime).toLocaleString()}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className={`font-mono font-bold ${t.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                           {t.profit > 0 ? '+' : ''}{t.profit.toFixed(2)}
                         </div>
                         <div className="text-xs text-gray-400">{t.closeReason}</div>
                      </div>
                   </div>
                 ))}
                 {data.trades.length === 0 && <div className="text-center text-gray-500 py-4">No trades yet</div>}
               </div>
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
