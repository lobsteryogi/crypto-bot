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

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

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
          setHistory(json.data.slice(1));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 h-full flex items-center justify-center">
        <span className="text-[var(--muted-foreground)] text-sm">Failed to load</span>
      </div>
    );
  }

  const value = parseInt(data.value);
  
  // Determine color class
  const getColorClass = (val: number) => {
    if (val <= 25) return 'text-error';
    if (val <= 45) return 'text-warning';
    if (val <= 55) return 'text-[#eab308]';
    if (val <= 75) return 'text-[#84cc16]';
    return 'text-success';
  };

  const colorClass = getColorClass(value);

  // SVG parameters for half-circle gauge
  const stroke = 10;
  const circumference = 70 * Math.PI; // Arc length for half circle
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 h-full flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[var(--muted-foreground)] text-xs uppercase tracking-wider font-medium">Fear & Greed</span>
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
          "bg-[var(--secondary)]",
          colorClass
        )}>
          {data.value_classification}
        </span>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-32 sm:w-36 h-16 sm:h-[72px]">
          <svg viewBox="0 0 160 80" className="w-full h-full">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--error)" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="var(--success)" />
              </linearGradient>
            </defs>

            {/* Background Track */}
            <path
              d="M 10 75 A 70 70 0 0 1 150 75"
              fill="none"
              stroke="var(--secondary)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            
            {/* Value Arc */}
            <path
              d="M 10 75 A 70 70 0 0 1 150 75"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          
          <div className="absolute inset-0 flex items-end justify-center pb-0">
            <span className={cn("text-2xl sm:text-3xl font-bold tabular-nums", colorClass)}>
              {value}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--muted-foreground)]">Yesterday</span>
          <span className={cn(
            "font-mono tabular-nums",
            getColorClass(parseInt(history[0]?.value || '0'))
          )}>
            {history[0]?.value || '-'}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--muted-foreground)]">Last Week</span>
          <span className={cn(
            "font-mono tabular-nums",
            getColorClass(parseInt(history[history.length - 1]?.value || '0'))
          )}>
            {history[history.length - 1]?.value || '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
