"use client";

import { useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, ISeriesApi, Time, UTCTimestamp, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

export interface ChartData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma13?: number;
  rsi?: number;
}

interface Props {
  data: ChartData[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

export const TradingViewChart = ({ data, colors = {} }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ReturnType<typeof createChart> | null>(null);
  
  // Series refs
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Series = useRef<ISeriesApi<"Line"> | null>(null);
  const ma13Series = useRef<ISeriesApi<"Line"> | null>(null);
  
  // RSI Chart Refs
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartInstance = useRef<ReturnType<typeof createChart> | null>(null);
  const rsiSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOverboughtLine = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOversoldLine = useRef<ISeriesApi<"Line"> | null>(null);

  const {
    backgroundColor = '#1f2937', // gray-800
    textColor = '#d1d5db', // gray-300
  } = colors;

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return;

    // --- Main Chart ---
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { color: '#374151' }, // gray-700
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstance.current = chart;

    // Candlesticks (v5 API)
    candleSeries.current = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', // green-500
      downColor: '#ef4444', // red-500
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume (v5 API)
    volumeSeries.current = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on same chart but different scale
    });
    volumeSeries.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // Push to bottom
        bottom: 0,
      },
    });

    // Moving Averages (v5 API)
    ma5Series.current = chart.addSeries(LineSeries, {
      color: '#facc15', // yellow
      lineWidth: 2,
      priceLineVisible: false,
      title: 'SMA 5',
    });

    ma13Series.current = chart.addSeries(LineSeries, {
      color: '#3b82f6', // blue
      lineWidth: 2,
      priceLineVisible: false,
      title: 'SMA 13',
    });

    // --- RSI Chart ---
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: rsiContainerRef.current.clientWidth,
      height: 100,
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        visible: false,
      },
      handleScale: false,
      handleScroll: false,
    });
    
    rsiChartInstance.current = rsiChart;

    rsiSeries.current = rsiChart.addSeries(LineSeries, {
      color: '#c084fc', // purple
      lineWidth: 2,
    });
    
    // RSI Levels (v5 API)
    const overbought = rsiChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2, title: '70' });
    const oversold = rsiChart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, lineStyle: 2, title: '30' });
    rsiOverboughtLine.current = overbought;
    rsiOversoldLine.current = oversold;

    // --- Synchronization (Basic) ---
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range && range.from && range.to && rsiChartInstance.current) {
            try {
                rsiChartInstance.current.timeScale().setVisibleRange(range);
            } catch (e) {
                // Ignore sync errors
            }
        }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (rsiContainerRef.current && rsiChartInstance.current) {
        rsiChartInstance.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      rsiChart.remove();
    };
  }, [backgroundColor, textColor]);

  // Update Data
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Filter out any null/undefined values in data
    const validData = data.filter(d => 
      d && d.time != null && d.open != null && d.high != null && d.low != null && d.close != null
    );
    
    if (validData.length === 0) return;

    // Convert data to TradingView format
    const candles = validData.map(d => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes = validData
      .filter(d => d.volume != null)
      .map(d => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? '#22c55e80' : '#ef444480',
      }));

    const ma5Data = validData
        .filter(d => d.ma5 != null)
        .map(d => ({ time: d.time as Time, value: d.ma5! }));
    
    const ma13Data = validData
        .filter(d => d.ma13 != null)
        .map(d => ({ time: d.time as Time, value: d.ma13! }));

    const rsiData = validData
        .filter(d => d.rsi != null)
        .map(d => ({ time: d.time as Time, value: d.rsi! }));

    // Update Series
    if (candleSeries.current) candleSeries.current.setData(candles);
    if (volumeSeries.current) volumeSeries.current.setData(volumes);
    if (ma5Series.current) ma5Series.current.setData(ma5Data);
    if (ma13Series.current) ma13Series.current.setData(ma13Data);
    
    if (rsiSeries.current) rsiSeries.current.setData(rsiData);
    
    // Constant lines for RSI
    if (rsiOverboughtLine.current && rsiData.length > 0) {
        rsiOverboughtLine.current.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
    }
    if (rsiOversoldLine.current && rsiData.length > 0) {
        rsiOversoldLine.current.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    }

  }, [data]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div ref={chartContainerRef} className="w-full h-[300px] border border-gray-700 rounded-lg overflow-hidden relative" />
      <div ref={rsiContainerRef} className="w-full h-[100px] border border-gray-700 rounded-lg overflow-hidden relative" />
    </div>
  );
};
