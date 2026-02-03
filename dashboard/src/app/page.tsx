"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import FearGreedGauge from '../components/FearGreedGauge';
import { TradeHistoryTable } from '../components/TradeHistoryTable';
import { TradingViewChart, ChartData } from '../components/TradingViewChart';
import { WinRateByDayChart } from '../components/WinRateByDayChart';
import { AlertSettingsPanel, AlertSettings, defaultSettings } from '../components/AlertSettingsPanel';
import { useNotifications } from '../hooks/useNotifications';

// --- Types ---
interface DayStat {
  day: string;
  trades: number;
  wins: number;
  winRate: number;
}

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
  leverage?: number;
  currentPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
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
  totalUnrealizedPnL?: number;
  recentCycles?: Cycle[];
  winRateByDay?: DayStat[];
  stats: Stats;
  changelog: string[];
  backlog: Backlog;
  configRaw: string;
}

// --- Utility Functions ---
const formatCurrency = (value: number, decimals = 2) => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}$${value.toFixed(decimals)}`;
};

const formatPercent = (value: number, decimals = 2) => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
};

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

// --- Components ---

// Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === 'running';
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
      isRunning ? "bg-success-muted text-success" : "bg-warning-muted text-warning"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        isRunning ? "bg-success animate-pulse" : "bg-warning"
      )} />
      {status}
    </span>
  );
};

// KPI Card Component
const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  valueClass = '',
  icon 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  valueClass?: string;
  icon?: React.ReactNode;
}) => (
  <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 transition-all hover:border-[oklch(1_0_0/20%)]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[var(--muted-foreground)] text-xs uppercase tracking-wider font-medium">{title}</span>
      {icon}
    </div>
    <div className={cn("text-2xl sm:text-3xl font-bold tabular-nums", valueClass)}>{value}</div>
    {subtitle && <div className="text-xs text-[var(--muted-foreground)] mt-1">{subtitle}</div>}
  </div>
);

// Alert Bar
const AlertBar = ({ changelog }: { changelog: string[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!changelog || changelog.length === 0) return null;

  return (
    <div className="bg-info-muted border-b border-[var(--border)]">
      <div 
        className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm text-info flex-1 min-w-0">
          <span className="bg-info text-white text-xs px-2 py-0.5 rounded-full font-medium shrink-0">NEW</span>
          <span className="font-mono truncate opacity-90">{changelog[0]}</span>
        </div>
        <span className="text-info text-xs ml-2 shrink-0">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="max-w-7xl mx-auto px-4 pb-4 animate-slide-up">
          <ul className="space-y-1.5 mt-2">
            {changelog.slice(1, 6).map((log, i) => (
              <li key={i} className="text-xs text-info/80 font-mono border-l-2 border-info/30 pl-3">
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// P/L Chart
const PLChart = ({ trades }: { trades: Trade[] }) => {
  const dataPoints = useMemo(() => {
    let cumulative = 0;
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.closeTime || a.openTime).getTime() - new Date(b.closeTime || b.openTime).getTime()
    );
    
    const points = sortedTrades.map((t, i) => {
      cumulative += t.profit;
      return { index: i + 1, value: cumulative, date: t.closeTime };
    });
    
    return [{ index: 0, value: 0, date: '' }, ...points];
  }, [trades]);

  if (dataPoints.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
        Not enough data
      </div>
    );
  }

  const min = Math.min(...dataPoints.map(p => p.value));
  const max = Math.max(...dataPoints.map(p => p.value));
  const range = max - min || 1;
  const height = 120;
  const width = dataPoints.length * 6;
  
  const pointsStr = dataPoints.map((p, i) => {
    const x = (i / (dataPoints.length - 1)) * width;
    const y = height - ((p.value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = dataPoints[dataPoints.length - 1].value >= 0;

  return (
    <div className="w-full">
      <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">P/L Curve</h3>
      <div className="h-[120px] w-full bg-[var(--background)] rounded-lg p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
          {min < 0 && max > 0 && (
            <line 
              x1="0" 
              y1={height - ((0 - min) / range) * height} 
              x2={width} 
              y2={height - ((0 - min) / range) * height} 
              stroke="var(--muted-foreground)" 
              strokeDasharray="4" 
              strokeWidth="1" 
              opacity="0.3"
            />
          )}
          <polyline
            fill="none"
            stroke={isPositive ? "var(--success)" : "var(--error)"}
            strokeWidth="2"
            points={pointsStr}
          />
        </svg>
      </div>
    </div>
  );
};

// Hourly Win Rate Chart
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
      <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Win Rate by Hour</h3>
      <div className="h-[120px] bg-[var(--background)] rounded-lg p-2 flex items-end justify-between gap-px">
        {hourlyStats.map((stat) => (
          <div key={stat.hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            <div 
              className={cn(
                "w-full rounded-t transition-all",
                stat.total === 0 ? 'bg-[var(--muted)]' : 
                stat.winRate >= 50 ? 'bg-success/60 hover:bg-success/80' : 'bg-error/60 hover:bg-error/80'
              )}
              style={{ height: `${stat.total === 0 ? 4 : Math.max(8, stat.winRate)}%` }}
            />
            <div className="text-[6px] sm:text-[8px] text-[var(--muted-foreground)] mt-1 tabular-nums">{stat.hour}</div>
            
            {stat.total > 0 && (
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[var(--popover)] border border-[var(--border)] text-[var(--foreground)] text-xs p-2 rounded-lg z-20 whitespace-nowrap shadow-lg animate-slide-up">
                <div className="font-medium">{stat.hour}:00</div>
                <div className={stat.winRate >= 50 ? 'text-success' : 'text-error'}>{stat.winRate.toFixed(0)}%</div>
                <div className="text-[var(--muted-foreground)]">{stat.total} trades</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Position Card for Mobile
const PositionCard = ({ position }: { position: Position }) => {
  const isLong = position.type === 'long';
  const pnl = position.unrealizedPnL || 0;
  const pnlPercent = position.unrealizedPnLPercent || 0;
  const isProfitable = pnl >= 0;
  
  return (
    <div className="bg-[var(--secondary)] rounded-lg p-3 space-y-3 animate-slide-up">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--foreground)]">{position.symbol}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full font-medium",
            isLong ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
          )}>
            {isLong ? 'LONG' : 'SHORT'} {position.leverage ? `${position.leverage}x` : ''}
          </span>
        </div>
        <div className="text-right">
          <div className={cn("font-bold tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
            {formatCurrency(pnl)}
          </div>
          <div className={cn("text-xs tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
            {formatPercent(pnlPercent)}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Entry</span>
          <span className="tabular-nums">${position.entryPrice?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Current</span>
          <span className="tabular-nums text-warning">${position.currentPrice?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">TP</span>
          <span className="tabular-nums text-success">${position.takeProfit?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">SL</span>
          <span className="tabular-nums text-error">${position.stopLoss?.toFixed(2)}</span>
        </div>
      </div>
      
      <div className="text-xs text-[var(--muted-foreground)] truncate pt-1 border-t border-[var(--border)]" title={position.reason}>
        {position.reason}
      </div>
    </div>
  );
};

// Open Positions Section
const OpenPositionsSection = ({ positions, totalUnrealizedPnL }: { positions: Position[]; totalUnrealizedPnL?: number }) => {
  if (positions.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-base font-semibold mb-4">Open Positions</h2>
        <div className="text-[var(--muted-foreground)] text-sm text-center py-8">
          No open positions
        </div>
      </div>
    );
  }
  
  const totalPnL = totalUnrealizedPnL || 0;
  const isProfitable = totalPnL >= 0;
  
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
          Open Positions ({positions.length})
        </h2>
        <div className={cn("text-sm font-bold tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
          Unrealized: {formatCurrency(totalPnL)}
        </div>
      </div>
      
      {/* Mobile: Cards */}
      <div className="sm:hidden space-y-3">
        {positions.map(p => (
          <PositionCard key={p.id} position={p} />
        ))}
      </div>
      
      {/* Desktop: Table */}
      <div className="hidden sm:block overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Symbol</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Type</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Entry</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Current</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">TP</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">SL</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Size</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">P/L</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">P/L %</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-[var(--muted-foreground)] uppercase">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {positions.map(p => {
              const isLong = p.type === 'long';
              const pnl = p.unrealizedPnL || 0;
              const pnlPercent = p.unrealizedPnLPercent || 0;
              const isProfitable = pnl >= 0;
              
              return (
                <tr key={p.id} className="hover:bg-[var(--secondary)]/50 transition-colors">
                  <td className="py-3 px-2 font-semibold">{p.symbol}</td>
                  <td className="py-3 px-2">
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-medium",
                      isLong ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
                    )}>
                      {isLong ? 'LONG' : 'SHORT'} {p.leverage ? `${p.leverage}x` : ''}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums font-mono">${p.entryPrice?.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right tabular-nums font-mono text-warning">${p.currentPrice?.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right tabular-nums font-mono text-success">${p.takeProfit?.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right tabular-nums font-mono text-error">${p.stopLoss?.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right tabular-nums text-[var(--muted-foreground)]">{p.amount?.toFixed(4)}</td>
                  <td className={cn("py-3 px-2 text-right tabular-nums font-bold", isProfitable ? 'text-success' : 'text-error')}>
                    {formatCurrency(pnl)}
                  </td>
                  <td className={cn("py-3 px-2 text-right tabular-nums font-bold", isProfitable ? 'text-success' : 'text-error')}>
                    {formatPercent(pnlPercent)}
                  </td>
                  <td className="py-3 px-2 text-xs text-[var(--muted-foreground)] max-w-[200px] truncate" title={p.reason}>
                    {p.reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Signal Log with Real-time Updates
const SignalLog = ({ cycles }: { cycles: Cycle[] }) => {
  const [displayCycles, setDisplayCycles] = useState<Cycle[]>([]);
  const prevCyclesRef = useRef<string>('');
  
  // Update display with animation when new cycles arrive
  useEffect(() => {
    const cyclesKey = JSON.stringify(cycles.slice(0, 8));
    if (cyclesKey !== prevCyclesRef.current) {
      prevCyclesRef.current = cyclesKey;
      setDisplayCycles(cycles.slice(0, 8));
    }
  }, [cycles]);
  
  if (!displayCycles || displayCycles.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
          Signal Log
        </h2>
        <div className="text-[var(--muted-foreground)] text-sm text-center py-6">
          Waiting for signals...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
          Signal Log
        </h2>
        <span className="text-xs text-[var(--muted-foreground)]">Live</span>
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
        {displayCycles.map((c, i) => {
          const signalType = c.signal.signal;
          const isBuy = signalType === 'buy';
          const isSell = signalType === 'sell';
          
          return (
            <div 
              key={`${c.timestamp}-${i}`} 
              className={cn(
                "border-l-2 pl-3 py-2 transition-all",
                isBuy ? 'border-success bg-success-muted/50' : 
                isSell ? 'border-error bg-error-muted/50' : 
                'border-[var(--border)] bg-[var(--secondary)]/50'
              )}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--muted-foreground)] tabular-nums">
                  {new Date(c.timestamp).toLocaleTimeString()}
                </span>
                <span className="tabular-nums font-mono">${c.price}</span>
              </div>
              <div className={cn(
                "font-semibold text-sm mt-1",
                isBuy ? 'text-success' : isSell ? 'text-error' : 'text-[var(--muted-foreground)]'
              )}>
                {signalType.toUpperCase()}
              </div>
              {c.signal.reason && (
                <div className="text-xs text-[var(--muted-foreground)] mt-1 truncate" title={c.signal.reason}>
                  {c.signal.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Strategy Configuration Card (Fixed)
const StrategyCard = ({ configRaw }: { configRaw: string }) => {
  // Show a user-friendly message if config loading failed
  const hasError = !configRaw || configRaw.includes('Could not parse') || configRaw.includes('not found');
  
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Strategy Config
      </h2>
      {hasError ? (
        <div className="bg-[var(--secondary)] rounded-lg p-4 text-sm">
          <p className="text-[var(--muted-foreground)] mb-2">Configuration loaded from database.</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Use the API at <code className="bg-[var(--background)] px-1.5 py-0.5 rounded">/api/config</code> to view or update settings.
          </p>
        </div>
      ) : (
        <pre className="bg-[var(--background)] rounded-lg p-3 text-[10px] sm:text-xs font-mono text-success overflow-x-auto max-h-48 custom-scrollbar">
          {configRaw}
        </pre>
      )}
    </div>
  );
};

// Backlog Section
const BacklogSection = ({ backlog }: { backlog: Backlog }) => {
  if (!backlog || (!backlog.todo.length && !backlog.done.length)) return null;

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Backlog
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-medium text-warning uppercase tracking-wider mb-2">To Do</h3>
          <ul className="space-y-1.5">
            {backlog.todo.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--foreground)]">
                <span className="w-4 h-4 rounded border border-[var(--border)] shrink-0 mt-0.5" />
                <span className="opacity-80">{item}</span>
              </li>
            ))}
            {backlog.todo.length > 5 && (
              <li className="text-xs text-[var(--muted-foreground)]">+ {backlog.todo.length - 5} more</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-medium text-success uppercase tracking-wider mb-2">Completed</h3>
          <ul className="space-y-1.5">
            {backlog.done.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <span className="w-4 h-4 rounded border border-success bg-success-muted shrink-0 mt-0.5 flex items-center justify-center">
                  <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="line-through opacity-60">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Chart Section
const ChartSection = () => {
  const [data, setData] = useState<ChartData[]>([]);
  const [symbol, setSymbol] = useState('SOL/USDT');
  
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/chart');
        const json = await res.json();
        if (json.data) setData(json.data);
        if (json.symbol) setSymbol(json.symbol);
      } catch (e) { console.error("Chart load error:", e); }
    };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const currentRsi = data.length > 0 ? data[data.length - 1].rsi : null;

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            {symbol}
            <span className="text-xs text-[var(--muted-foreground)] font-normal">1m</span>
          </h2>
          <div className="flex flex-wrap gap-3 text-[10px] mt-2 text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-success rounded" />Up</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-error rounded" />Down</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-warning rounded" />MA5</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-info rounded" />MA13</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">${currentPrice.toFixed(2)}</div>
          {currentRsi !== null && currentRsi !== undefined && (
            <div className={cn(
              "text-xs font-mono tabular-nums mt-1",
              currentRsi > 70 ? 'text-error' : currentRsi < 30 ? 'text-success' : 'text-[var(--muted-foreground)]'
            )}>
              RSI: {currentRsi.toFixed(1)}
            </div>
          )}
        </div>
      </div>
      
      <div className="min-h-[300px]">
        <TradingViewChart data={data} />
      </div>
    </div>
  );
};

// Main Dashboard
export default function Dashboard() {
  const [data, setData] = useState<BotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Alert State
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(defaultSettings);
  const { notify } = useNotifications();
  
  // Refs for tracking notification state
  const lastTradeIdRef = useRef<string | null>(null);
  const notifiedWinRateDateRef = useRef<string | null>(null);
  const notifiedDailyDateRef = useRef<string | null>(null);

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
    
    // Load alert settings
    const saved = localStorage.getItem('cryptoBotAlertSettings');
    if (saved) {
      try {
        setAlertSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) { console.error(e); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Background polling - more frequent for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000); // 5 seconds for more real-time updates
    return () => clearInterval(interval);
  }, [fetchData]);

  // Alert Logic
  useEffect(() => {
    if (!data) return;

    const currentPrice = data.recentCycles && data.recentCycles.length > 0 ? data.recentCycles[0].price : 0;
    const today = new Date().toDateString();

    // Price Alerts
    if (alertSettings.priceAlerts.length > 0 && currentPrice > 0) {
      let settingsChanged = false;
      const newAlerts = alertSettings.priceAlerts.map(alert => {
        if (!alert.enabled) return alert;

        const triggered = (alert.direction === 'above' && currentPrice >= alert.price) ||
                          (alert.direction === 'below' && currentPrice <= alert.price);
        
        if (triggered) {
          notify(`Price Alert: ${alert.direction} ${alert.price}`, {
            body: `SOL price has reached ${currentPrice}`,
            icon: '/favicon.ico'
          });
          settingsChanged = true;
          return { ...alert, enabled: false };
        }
        return alert;
      });

      if (settingsChanged) {
        const newSettings = { ...alertSettings, priceAlerts: newAlerts };
        setAlertSettings(newSettings);
        localStorage.setItem('cryptoBotAlertSettings', JSON.stringify(newSettings));
      }
    }

    // Trade Alerts
    if (alertSettings.tradeAlerts && data.trades.length > 0) {
      const latestTrade = data.trades.reduce((prev, current) => {
        const prevTime = new Date(prev.closeTime || prev.openTime).getTime();
        const currTime = new Date(current.closeTime || current.openTime).getTime();
        return currTime > prevTime ? current : prev;
      }, data.trades[0]);

      if (latestTrade && lastTradeIdRef.current && latestTrade.id !== lastTradeIdRef.current) {
        const type = latestTrade.profit >= 0 ? 'Winning Trade 🟢' : 'Losing Trade 🔴';
        notify(type, {
          body: `${latestTrade.symbol}: ${latestTrade.type.toUpperCase()} P/L: ${latestTrade.profit.toFixed(2)}`,
        });
      }
      if (latestTrade) {
        lastTradeIdRef.current = latestTrade.id;
      }
    }

    // Win Rate Alerts
    if (alertSettings.winRateAlerts && notifiedWinRateDateRef.current !== today) {
      const currentWinRate = parseFloat(data.stats.winRate);
      if (!isNaN(currentWinRate) && currentWinRate < alertSettings.winRateThreshold) {
        notify(`Win Rate Warning ⚠️`, {
          body: `Win rate has dropped to ${currentWinRate}% (Threshold: ${alertSettings.winRateThreshold}%)`
        });
        notifiedWinRateDateRef.current = today;
      }
    }

    // Daily Summary
    if (alertSettings.dailySummary && notifiedDailyDateRef.current !== today) {
      notify(`Daily Summary 📅`, {
        body: `P/L: ${data.stats.totalProfit} | Win Rate: ${data.stats.winRate}% | Trades: ${data.stats.totalTrades}`
      });
      notifiedDailyDateRef.current = today;
    }

  }, [data, alertSettings, notify]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-error-muted border border-error/30 rounded-xl p-6 max-w-md text-center">
          <div className="text-error text-xl mb-2">⚠️</div>
          <p className="text-error font-medium mb-2">Connection Error</p>
          <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const profitValue = parseFloat(data.stats.totalProfit);
  const roiValue = parseFloat(data.stats.roi);
  const isProfitable = profitValue >= 0;

  return (
    <div className="min-h-screen pb-10">
      <AlertSettingsPanel 
        isOpen={isAlertSettingsOpen} 
        onClose={() => setIsAlertSettingsOpen(false)}
        onSettingsChange={setAlertSettings}
        currentPrice={data.recentCycles && data.recentCycles.length > 0 ? data.recentCycles[0].price : 0}
      />
      <AlertBar changelog={data.changelog} />
      
      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              Crypto Bot
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={data.status} />
              <span className="text-xs text-[var(--muted-foreground)]">
                {data.lastUpdate ? `Updated ${new Date(data.lastUpdate).toLocaleTimeString()}` : ''}
              </span>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-bold tabular-nums">${data.balance.toFixed(2)}</div>
              <div className={cn("text-sm tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
                {formatPercent(roiValue)} ({formatCurrency(profitValue)})
              </div>
            </div>
            <button
              onClick={() => setIsAlertSettingsOpen(true)}
              className="bg-[var(--secondary)] hover:bg-[var(--accent)] p-2.5 rounded-lg border border-[var(--border)] transition-colors"
              title="Alert Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </div>

        {/* KPI Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="sm:col-span-1">
            <FearGreedGauge />
          </div>
          <KPICard 
            title="Win Rate" 
            value={`${data.stats.winRate}%`} 
            subtitle={`${data.stats.wins}W / ${data.stats.losses}L`}
          />
          <KPICard 
            title="Total Trades" 
            value={data.stats.totalTrades} 
            subtitle={`Avg ${data.stats.avgProfit}`}
          />
          <KPICard 
            title="Total P/L" 
            value={`$${data.stats.totalProfit}`} 
            valueClass={isProfitable ? 'text-success' : 'text-error'}
          />
          <KPICard 
            title="Open Positions" 
            value={data.positions.length} 
            subtitle={data.totalUnrealizedPnL ? `${formatCurrency(data.totalUnrealizedPnL)} unrealized` : 'No positions'}
            valueClass="text-info"
          />
        </div>

        {/* Chart Section */}
        <div className="mb-6">
          <ChartSection />
        </div>

        {/* Analytics Charts Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <PLChart trades={data.trades} />
          </div>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <HourlyWinRateChart trades={data.trades} />
          </div>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 sm:col-span-2 lg:col-span-1">
            <WinRateByDayChart data={data.winRateByDay || []} />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: Positions & Trades */}
          <div className="lg:col-span-2 space-y-4">
            <OpenPositionsSection positions={data.positions} totalUnrealizedPnL={data.totalUnrealizedPnL} />
            
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <h2 className="text-base font-semibold">Trade History</h2>
              </div>
              <div className="h-[400px] sm:h-[500px]">
                <TradeHistoryTable 
                  trades={data.trades} 
                  filters={filters} 
                  onFilterChange={setFilters} 
                  isLoading={loading}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Signals & Config */}
          <div className="space-y-4">
            <SignalLog cycles={data.recentCycles || []} />
            <BacklogSection backlog={data.backlog} />
            <StrategyCard configRaw={data.configRaw} />
          </div>
        </div>
      </main>
    </div>
  );
}
