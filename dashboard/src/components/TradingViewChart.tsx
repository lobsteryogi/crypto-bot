"use client";

import { useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, ISeriesApi, Time, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

export interface ChartData {
  time: number;
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
}

export const TradingViewChart = ({ data }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ReturnType<typeof createChart> | null>(null);
  
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Series = useRef<ISeriesApi<"Line"> | null>(null);
  const ma13Series = useRef<ISeriesApi<"Line"> | null>(null);
  
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartInstance = useRef<ReturnType<typeof createChart> | null>(null);
  const rsiSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOverboughtLine = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOversoldLine = useRef<ISeriesApi<"Line"> | null>(null);

  // Colors using CSS variables compatible values
  const backgroundColor = '#1a1a1a';
  const textColor = '#a1a1aa';
  const gridColor = '#27272a';
  const upColor = '#22c55e';
  const downColor = '#ef4444';
  const yellowColor = '#eab308';
  const blueColor = '#3b82f6';
  const purpleColor = '#a855f7';

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return;

    const container = chartContainerRef.current;
    const rsiContainer = rsiContainerRef.current;

    // Main Chart
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: container.clientWidth,
      height: 250,
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: gridColor,
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
    });

    chartInstance.current = chart;

    // Candlesticks
    candleSeries.current = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    // Volume
    volumeSeries.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.current.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Moving Averages
    ma5Series.current = chart.addSeries(LineSeries, {
      color: yellowColor,
      lineWidth: 1,
      priceLineVisible: false,
      title: 'MA5',
    });

    ma13Series.current = chart.addSeries(LineSeries, {
      color: blueColor,
      lineWidth: 1,
      priceLineVisible: false,
      title: 'MA13',
    });

    // RSI Chart
    const rsiChart = createChart(rsiContainer, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: rsiContainer.clientWidth,
      height: 80,
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: { visible: false },
      rightPriceScale: {
        borderColor: gridColor,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      handleScale: false,
      handleScroll: false,
    });
    
    rsiChartInstance.current = rsiChart;

    rsiSeries.current = rsiChart.addSeries(LineSeries, {
      color: purpleColor,
      lineWidth: 2,
    });
    
    rsiOverboughtLine.current = rsiChart.addSeries(LineSeries, { 
      color: downColor, 
      lineWidth: 1, 
      lineStyle: 2,
    });
    rsiOversoldLine.current = rsiChart.addSeries(LineSeries, { 
      color: upColor, 
      lineWidth: 1, 
      lineStyle: 2,
    });

    // Synchronization
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (range && range.from && range.to && rsiChartInstance.current) {
        try {
          rsiChartInstance.current.timeScale().setVisibleRange(range);
        } catch (e) {
          // Ignore sync errors
        }
      }
    });

    // Resize handler
    const handleResize = () => {
      if (container && chartInstance.current) {
        chartInstance.current.applyOptions({ width: container.clientWidth });
      }
      if (rsiContainer && rsiChartInstance.current) {
        rsiChartInstance.current.applyOptions({ width: rsiContainer.clientWidth });
      }
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      rsiChart.remove();
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (!data || data.length === 0) return;

    const validData = data.filter(d => 
      d && d.time != null && d.open != null && d.high != null && d.low != null && d.close != null
    );
    
    if (validData.length === 0) return;

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
        color: d.close >= d.open ? '#22c55e60' : '#ef444460',
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

    if (candleSeries.current) candleSeries.current.setData(candles);
    if (volumeSeries.current) volumeSeries.current.setData(volumes);
    if (ma5Series.current) ma5Series.current.setData(ma5Data);
    if (ma13Series.current) ma13Series.current.setData(ma13Data);
    
    if (rsiSeries.current) rsiSeries.current.setData(rsiData);
    
    if (rsiOverboughtLine.current && rsiData.length > 0) {
      rsiOverboughtLine.current.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
    }
    if (rsiOversoldLine.current && rsiData.length > 0) {
      rsiOversoldLine.current.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    }

  }, [data]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div 
        ref={chartContainerRef} 
        className="w-full h-[250px] rounded-lg overflow-hidden bg-[#1a1a1a]" 
      />
      <div 
        ref={rsiContainerRef} 
        className="w-full h-[80px] rounded-lg overflow-hidden bg-[#1a1a1a]" 
      />
    </div>
  );
};
