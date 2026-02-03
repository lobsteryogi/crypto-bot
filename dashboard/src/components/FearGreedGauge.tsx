'use client';

import { useEffect, useState } from 'react';

interface FearGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

interface ApiResponse {
  data: FearGreedData[];
  metadata?: {
    error?: any;
  };
}

export default function FearGreedGauge() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [history, setHistory] = useState<FearGreedData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fear-greed');
        if (!res.ok) throw new Error('Failed to fetch');
        const json: ApiResponse = await res.json();
        if (json.data && json.data.length > 0) {
          setData(json.data[0]);
          setHistory(json.data.slice(1)); // Store the rest for history
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="animate-pulse h-48 bg-gray-800 rounded-xl border border-gray-700"></div>;
  if (!data) return <div className="h-48 flex items-center justify-center text-red-400 bg-gray-800 rounded-xl border border-gray-700">Failed to load index</div>;

  const value = parseInt(data.value);
  
  // Determine color
  let colorClass = 'text-red-500';
  let stopColor1 = '#ef4444';
  let stopColor2 = '#22c55e';
  
  if (value > 25) { colorClass = 'text-orange-500'; }
  if (value > 45) { colorClass = 'text-yellow-500'; }
  if (value > 55) { colorClass = 'text-lime-500'; }
  if (value > 75) { colorClass = 'text-green-500'; }

  // SVG parameters
  const stroke = 12;
  const radius = 80;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-between h-full">
      <div className="w-full flex justify-between items-start mb-2">
         <h3 className="text-gray-400 text-xs uppercase font-semibold">Fear & Greed</h3>
         <span className={`text-xs font-bold px-2 py-0.5 rounded bg-gray-700 ${colorClass}`}>
           {data.value_classification}
         </span>
      </div>
      
      <div className="relative flex flex-col items-center justify-center mt-2">
        <div className="relative w-40 h-20 overflow-hidden">
           <svg
            height="100%"
            width="100%"
            viewBox="0 0 160 80"
            className="transform"
          >
            {/* Gradient */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Background Track */}
            <path
              d="M 10 80 A 70 70 0 0 1 150 80"
              fill="none"
              stroke="#374151"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            
            {/* Value Arc */}
            <path
              d="M 10 80 A 70 70 0 0 1 150 80"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference} 
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          
          <div className="absolute bottom-0 left-0 right-0 flex justify-center translate-y-1">
            <span className={`text-3xl font-bold ${colorClass}`}>{value}</span>
          </div>
        </div>
      </div>

      <div className="w-full mt-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Yesterday</span>
            <span className={`font-mono ${
                parseInt(history[0]?.value || '0') > 50 ? 'text-green-400' : 'text-red-400'
            }`}>
                {history[0]?.value || '-'}
            </span>
        </div>
        <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Last Week</span>
             <span className={`font-mono ${
                parseInt(history[history.length - 1]?.value || '0') > 50 ? 'text-green-400' : 'text-red-400'
            }`}>
                {history[history.length - 1]?.value || '-'}
            </span>
        </div>
      </div>
    </div>
  );
}
