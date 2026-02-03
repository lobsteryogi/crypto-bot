import React from 'react';

interface DayStat {
  day: string;
  trades: number;
  wins: number;
  winRate: number;
}

interface WinRateByDayChartProps {
  data: DayStat[];
}

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

export const WinRateByDayChart: React.FC<WinRateByDayChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Win Rate by Day</h3>
        <div className="h-[120px] flex items-center justify-center text-[var(--muted-foreground)] text-sm bg-[var(--background)] rounded-lg">
          No data available
        </div>
      </div>
    );
  }

  const getColor = (rate: number, hasData: boolean) => {
    if (!hasData) return 'bg-[var(--muted)]';
    if (rate >= 60) return 'bg-success/70 hover:bg-success/90';
    if (rate >= 40) return 'bg-warning/70 hover:bg-warning/90';
    return 'bg-error/70 hover:bg-error/90';
  };

  return (
    <div className="w-full">
      <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Win Rate by Day</h3>
      <div className="h-[120px] bg-[var(--background)] rounded-lg p-2 flex items-end justify-between gap-1">
        {data.map((stat, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            {/* Bar */}
            <div 
              className={cn(
                "w-full rounded-t transition-all cursor-default",
                getColor(stat.winRate, stat.trades > 0)
              )}
              style={{ height: `${stat.trades === 0 ? 4 : Math.max(10, stat.winRate)}%` }}
            >
              {/* Tooltip */}
              {stat.trades > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[var(--popover)] border border-[var(--border)] text-[var(--foreground)] text-xs p-2.5 rounded-lg z-20 whitespace-nowrap shadow-lg animate-slide-up">
                  <div className="font-semibold mb-1">{stat.day}</div>
                  <div className={cn("font-bold", stat.winRate >= 50 ? 'text-success' : 'text-error')}>
                    {stat.winRate}%
                  </div>
                  <div className="text-[var(--muted-foreground)] mt-1">
                    {stat.wins} / {stat.trades} trades
                  </div>
                </div>
              )}
            </div>
            
            {/* Label */}
            <div className="text-[9px] sm:text-[10px] text-[var(--muted-foreground)] mt-2 font-mono">
              {stat.day}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
