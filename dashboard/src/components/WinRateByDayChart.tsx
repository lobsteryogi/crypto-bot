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

export const WinRateByDayChart: React.FC<WinRateByDayChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[160px] flex items-center justify-center text-gray-500 text-xs">
        No data available
      </div>
    );
  }

  const getColor = (rate: number) => {
    if (rate >= 60) return 'bg-green-500/60';
    if (rate >= 40) return 'bg-yellow-500/60';
    return 'bg-red-500/60';
  };

  return (
    <div className="w-full">
       <h3 className="text-sm font-semibold text-gray-400 mb-2">Win Rate by Day</h3>
       <div className="h-[160px] bg-gray-900/50 rounded-lg p-2 flex items-end justify-between gap-1">
          {data.map((stat, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
               {/* Bar */}
               <div 
                 className={`w-full rounded-t-sm transition-all relative ${stat.trades === 0 ? 'bg-gray-800' : getColor(stat.winRate)}`}
                 style={{ height: `${stat.trades === 0 ? 5 : Math.max(10, stat.winRate)}%` }}
               >
                  {/* Tooltip */}
                  {stat.trades > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black border border-gray-700 text-white text-xs p-2 rounded z-20 whitespace-nowrap shadow-xl">
                      <div className="font-bold mb-1">{stat.day}</div>
                      <div>Win Rate: <span className={stat.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>{stat.winRate}%</span></div>
                      <div className="text-gray-400">{stat.wins} wins / {stat.trades} trades</div>
                    </div>
                  )}
               </div>
               
               {/* Label */}
               <div className="text-[10px] text-gray-500 mt-2 font-mono">{stat.day}</div>
            </div>
          ))}
       </div>
    </div>
  );
};
