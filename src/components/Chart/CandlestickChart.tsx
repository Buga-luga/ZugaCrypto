'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, DeepPartial, ChartOptions, LineWidth, Time, BusinessDay } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice } from '@/services/api/cryptoCompareAPI';
import { Timeframe } from '@/services/api/cryptoCompareAPI';

export interface CandlestickChartProps {
  timeframe: Timeframe;
}

export function CandlestickChart({ timeframe }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const formatTime = (time: Time) => {
      let date: Date;
      
      if (typeof time === 'number') {
        date = new Date(time * 1000);
      } else if (typeof time === 'string') {
        date = new Date(time);
      } else {
        // Handle BusinessDay format
        const { year, month, day } = time as BusinessDay;
        date = new Date(year, month - 1, day);
      }

      const formatOptions: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };

      // For daily timeframes, don't show time
      if (timeframe === '1d') {
        delete formatOptions.hour;
        delete formatOptions.minute;
      }

      return date.toLocaleString('en-US', formatOptions);
    };

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { color: '#1E222D' },
        textColor: '#DDD',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1 as LineWidth,
          color: '#758696',
          style: 3,
        },
        horzLine: {
          width: 1 as LineWidth,
          color: '#758696',
          style: 3,
        },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
      localization: {
        timeFormatter: formatTime,
      },
    };

    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Fetch and set historical data
    const loadData = async () => {
      try {
        const historicalData = await getHistoricalData(timeframe);
        candlestickSeries.setData(historicalData.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));
      } catch (error) {
        console.error('Error loading historical data:', error);
      }
    };

    loadData();
    chartRef.current = chart;

    // Subscribe to real-time price updates
    const unsubscribe = subscribeToPrice((data) => {
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.update({
          time: data.time,
          open: data.value,
          high: data.value,
          low: data.value,
          close: data.value
        });
      }
    }, timeframe);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [timeframe]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}