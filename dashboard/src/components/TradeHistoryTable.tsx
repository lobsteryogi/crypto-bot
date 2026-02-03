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
    if (filters.sortBy !== field) return <span className="text-gray-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Filter Bar */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-10">
        <div className="flex flex-wrap gap-3 items-center">
          
          {/* Range Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase font-bold">Time</label>
            <select 
              value={filters.range}
              onChange={(e) => onFilterChange({ ...filters, range: e.target.value })}
              className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase font-bold">Status</label>
            <select 
              value={filters.status}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
              className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="win">Wins Only</option>
              <option value="loss">Losses Only</option>
            </select>
          </div>

          {/* Profit Range Filter */}
          <div className="flex items-center gap-2">
             <label className="text-xs text-gray-400 uppercase font-bold">Profit</label>
             <input 
               type="number" 
               placeholder="Min" 
               value={filters.minProfit}
               onChange={(e) => onFilterChange({ ...filters, minProfit: e.target.value })}
               className="w-16 bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
             />
             <span className="text-gray-500">-</span>
             <input 
               type="number" 
               placeholder="Max" 
               value={filters.maxProfit}
               onChange={(e) => onFilterChange({ ...filters, maxProfit: e.target.value })}
               className="w-16 bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
             />
          </div>

        </div>

        <button 
          onClick={handleExportCSV}
          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors border border-gray-600"
        >
          <span>📥</span> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/80 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-800" onClick={() => handleSort('openTime')}>
                Time <SortIcon field="openTime" />
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-800" onClick={() => handleSort('symbol')}>
                Symbol <SortIcon field="symbol" />
              </th>
              <th scope="col" className="px-4 py-3 text-right">Entry</th>
              <th scope="col" className="px-4 py-3 text-right">Exit</th>
              <th scope="col" className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('profit')}>
                P/L ($) <SortIcon field="profit" />
              </th>
              <th scope="col" className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('profitPercent')}>
                P/L (%) <SortIcon field="profitPercent" />
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-800 hidden md:table-cell" onClick={() => handleSort('reason')}>
                Entry Reason <SortIcon field="reason" />
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-800 hidden lg:table-cell" onClick={() => handleSort('closeReason')}>
                Exit Reason <SortIcon field="closeReason" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {isLoading ? (
               <tr>
                 <td colSpan={8} className="text-center py-10 text-gray-500 animate-pulse">Loading data...</td>
               </tr>
            ) : trades.length === 0 ? (
               <tr>
                 <td colSpan={8} className="text-center py-10 text-gray-500">No trades found matching filters</td>
               </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-700/30 transition-colors group">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-400">
                    <div>{new Date(trade.openTime).toLocaleDateString()}</div>
                    <div>{new Date(trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {trade.symbol}
                    <span className={`ml-2 text-[10px] px-1 rounded ${trade.type === 'long' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {trade.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{trade.entryPrice}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{trade.exitPrice}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${trade.profitPercent > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.profitPercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate hidden md:table-cell" title={trade.reason}>
                    {trade.reason}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate hidden lg:table-cell" title={trade.closeReason}>
                    {trade.closeReason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-900/50 p-2 text-center text-xs text-gray-500 border-t border-gray-700">
        Showing {trades.length} trades
      </div>
    </div>
  );
};
