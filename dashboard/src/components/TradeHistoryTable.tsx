import React from 'react';

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

interface FilterState {
  range: string;
  status: string;
  minProfit: string;
  maxProfit: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface Props {
  trades: Trade[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  isLoading: boolean;
}

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

export const TradeHistoryTable: React.FC<Props> = ({ trades, filters, onFilterChange, isLoading }) => {
  
  const handleSort = (field: string) => {
    const isSameField = filters.sortBy === field;
    const newOrder = isSameField && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    onFilterChange({ ...filters, sortBy: field, sortOrder: newOrder });
  };

  const handleExportCSV = () => {
    if (!trades.length) return;
    
    const headers = ['ID', 'Symbol', 'Type', 'Open Time', 'Close Time', 'Entry', 'Exit', 'P/L (USDT)', 'P/L (%)', 'Reason', 'Close Reason'];
    const csvContent = [
      headers.join(','),
      ...trades.map(t => [
        t.id,
        t.symbol,
        t.type,
        new Date(t.openTime).toISOString(),
        t.closeTime ? new Date(t.closeTime).toISOString() : '',
        t.entryPrice,
        t.exitPrice,
        t.profit.toFixed(2),
        t.profitPercent.toFixed(2),
        `"${t.reason.replace(/"/g, '""')}"`,
        `"${t.closeReason?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trade_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (filters.sortBy !== field) return <span className="text-[var(--muted-foreground)] opacity-30 ml-1">↕</span>;
    return <span className="text-info ml-1">{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // Mobile Trade Card
  const TradeCard = ({ trade }: { trade: Trade }) => {
    const isProfitable = trade.profit > 0;
    const isLong = trade.type === 'long';
    
    return (
      <div className="bg-[var(--secondary)] rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{trade.symbol}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              isLong ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
            )}>
              {trade.type.toUpperCase()}
            </span>
          </div>
          <div className="text-right">
            <div className={cn("font-bold tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
              {isProfitable ? '+' : ''}{trade.profit.toFixed(2)}
            </div>
            <div className={cn("text-xs tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
              {isProfitable ? '+' : ''}{trade.profitPercent.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Entry</span>
            <span className="tabular-nums">${trade.entryPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Exit</span>
            <span className="tabular-nums">${trade.exitPrice}</span>
          </div>
        </div>
        
        <div className="text-[10px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]">
          {new Date(trade.openTime).toLocaleString([], { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Bar */}
      <div className="p-3 sm:p-4 border-b border-[var(--border)] bg-[var(--card)] flex flex-wrap gap-2 sm:gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          {/* Range Filter */}
          <select 
            value={filters.range}
            onChange={(e) => onFilterChange({ ...filters, range: e.target.value })}
            className="bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:ring-1 focus:ring-info focus:border-info appearance-none cursor-pointer min-h-[36px]"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          {/* Status Filter */}
          <select 
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:ring-1 focus:ring-info focus:border-info appearance-none cursor-pointer min-h-[36px]"
          >
            <option value="all">All</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
          </select>

          {/* Profit Range - Desktop only */}
          <div className="hidden sm:flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Min" 
              value={filters.minProfit}
              onChange={(e) => onFilterChange({ ...filters, minProfit: e.target.value })}
              className="w-16 bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-info tabular-nums"
            />
            <span className="text-[var(--muted-foreground)]">-</span>
            <input 
              type="number" 
              placeholder="Max" 
              value={filters.maxProfit}
              onChange={(e) => onFilterChange({ ...filters, maxProfit: e.target.value })}
              className="w-16 bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-info tabular-nums"
            />
          </div>
        </div>

        <button 
          onClick={handleExportCSV}
          className="bg-[var(--secondary)] hover:bg-[var(--accent)] text-[var(--foreground)] text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-[var(--border)] min-h-[36px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Mobile: Card View */}
      <div className="sm:hidden flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-10 text-[var(--muted-foreground)]">
            <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-10 text-[var(--muted-foreground)]">
            No trades found
          </div>
        ) : (
          trades.slice(0, 20).map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))
        )}
        {trades.length > 20 && (
          <div className="text-center py-2 text-xs text-[var(--muted-foreground)]">
            Showing 20 of {trades.length} trades
          </div>
        )}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden sm:block flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-xs text-[var(--muted-foreground)] uppercase bg-[var(--card)] sticky top-0 z-10">
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-[var(--secondary)] transition-colors text-left" onClick={() => handleSort('openTime')}>
                Time <SortIcon field="openTime" />
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-[var(--secondary)] transition-colors text-left" onClick={() => handleSort('symbol')}>
                Symbol <SortIcon field="symbol" />
              </th>
              <th scope="col" className="px-4 py-3 text-right">Entry</th>
              <th scope="col" className="px-4 py-3 text-right">Exit</th>
              <th scope="col" className="px-4 py-3 text-right cursor-pointer hover:bg-[var(--secondary)] transition-colors" onClick={() => handleSort('profit')}>
                P/L <SortIcon field="profit" />
              </th>
              <th scope="col" className="px-4 py-3 text-right cursor-pointer hover:bg-[var(--secondary)] transition-colors" onClick={() => handleSort('profitPercent')}>
                P/L % <SortIcon field="profitPercent" />
              </th>
              <th scope="col" className="px-4 py-3 text-left hidden lg:table-cell">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[var(--muted-foreground)]">
                  <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[var(--muted-foreground)]">No trades found</td>
              </tr>
            ) : (
              trades.map((trade) => {
                const isProfitable = trade.profit > 0;
                const isLong = trade.type === 'long';
                
                return (
                  <tr key={trade.id} className="hover:bg-[var(--secondary)]/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-[var(--muted-foreground)]">
                      <div>{new Date(trade.openTime).toLocaleDateString()}</div>
                      <div>{new Date(trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {trade.symbol}
                      <span className={cn(
                        "ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        isLong ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
                      )}>
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--muted-foreground)]">{trade.entryPrice}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--muted-foreground)]">{trade.exitPrice}</td>
                    <td className={cn("px-4 py-3 text-right font-mono tabular-nums font-bold", isProfitable ? 'text-success' : 'text-error')}>
                      {isProfitable ? '+' : ''}{trade.profit.toFixed(2)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono tabular-nums", isProfitable ? 'text-success' : 'text-error')}>
                      {isProfitable ? '+' : ''}{trade.profitPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] max-w-[200px] truncate hidden lg:table-cell" title={trade.reason}>
                      {trade.reason}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="bg-[var(--card)] p-2 text-center text-xs text-[var(--muted-foreground)] border-t border-[var(--border)]">
        {trades.length} trades
      </div>
    </div>
  );
};
