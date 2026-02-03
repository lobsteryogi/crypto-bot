import React, { useState } from 'react';

interface ManualTradePanelProps {
  currentPrice: number;
  onTradeExecuted?: () => void;
}

export const ManualTradePanel: React.FC<ManualTradePanelProps> = ({ currentPrice, onTradeExecuted }) => {
  const [amount, setAmount] = useState<string>("100");
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'buy' | 'close-all' | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleOpenModal = (type: 'buy' | 'close-all') => {
    setActionType(type);
    setShowModal(true);
    setStatusMsg(null);
  };

  const executeTrade = async () => {
    if (!actionType) return;
    
    setLoading(true);
    setStatusMsg(null);

    try {
      const payload = {
        action: actionType,
        amount: actionType === 'buy' ? parseFloat(amount) : undefined,
        symbol: 'SOL/USDT'
      };

      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMsg({ type: 'success', text: data.message });
        if (onTradeExecuted) onTradeExecuted();
        setTimeout(() => setShowModal(false), 1500);
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Trade failed' });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: 'Network error executing trade' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 h-full flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        🎮 Manual Control
      </h2>

      <div className="flex-1 flex flex-col justify-center space-y-6">
        
        {/* Price Display */}
        <div className="text-center">
           <div className="text-gray-400 text-xs uppercase mb-1">Current Price</div>
           <div className="text-3xl font-mono font-bold text-white">
             ${currentPrice ? currentPrice.toFixed(2) : '---'}
           </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs text-gray-400 mb-1 ml-1">Position Size (USDT)</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 pl-7 pr-3 text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleOpenModal('buy')}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex flex-col items-center justify-center gap-1"
          >
            <span>BUY SOL</span>
            <span className="text-[10px] font-normal opacity-75">Open Long</span>
          </button>

          <button 
             onClick={() => handleOpenModal('close-all')}
             className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex flex-col items-center justify-center gap-1"
          >
            <span>SELL SOL</span>
            <span className="text-[10px] font-normal opacity-75">Close Positions</span>
          </button>
        </div>
        
        <button 
           onClick={() => handleOpenModal('close-all')}
           className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          <span>⚠️ CLOSE ALL (EMERGENCY)</span>
        </button>

      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-2xl w-full max-w-sm overflow-hidden">
            
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Confirm {actionType === 'buy' ? 'Buy Order' : 'Close All'}
              </h3>
              
              <div className="space-y-3 mb-6 text-sm text-gray-300">
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span>Action</span>
                  <span className={`font-bold uppercase ${actionType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                    {actionType === 'buy' ? 'OPEN LONG' : 'CLOSE ALL POSITIONS'}
                  </span>
                </div>
                
                {actionType === 'buy' && (
                  <>
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span>Amount</span>
                      <span className="font-mono text-white">${parseFloat(amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span>Leverage</span>
                      <span className="font-mono text-white">10x</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between pt-1">
                  <span>Est. Price</span>
                  <span className="font-mono text-white">${currentPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Status Message */}
              {statusMsg && (
                <div className={`mb-4 p-3 rounded text-sm ${statusMsg.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'}`}>
                  {statusMsg.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeTrade}
                  disabled={loading}
                  className={`py-2 rounded-lg font-bold text-white transition-colors flex items-center justify-center ${
                    actionType === 'buy' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Confirm Execution'
                  )}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};
