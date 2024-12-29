'use client';
import { Time, IChartApi, ChartOptions, DeepPartial, LineWidth, BusinessDay, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice, Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy } from '@/services/strategies';
import { calculateEMA } from '@/services/strategies/ema-crossover';
import { calculateSMA } from '@/services/strategies/sma-crossover';

interface CandlestickChartProps {
  timeframe: Timeframe;
  strategy: StrategyId;
  token: string;
  exchange: 'uniswap' | 'raydium' | 'coinbase';
}

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function CandlestickChart({ timeframe, strategy, token, exchange }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<Map<string, any>>(new Map());
  const markerSeriesRef = useRef<any>(null);
  const historicalDataRef = useRef<any[]>([]);
  const currentCandleRef = useRef<any>(null);
  const lastSignalRef = useRef<{ time: number, type: 'buy' | 'sell' } | null>(null);

  // Function to get interval in seconds
  const getIntervalSeconds = (tf: Timeframe): number => {
    switch (tf) {
      case '1m': return 60;
      case '5m': return 300;
      case '15m': return 900;
      case '30m': return 1800;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1d': return 86400;
      default: return 60;
    }
  };

  // Function to safely remove a series
  const safelyRemoveSeries = (chart: IChartApi, series: any) => {
    try {
      if (series && chart) {
        chart.removeSeries(series);
      }
    } catch (e) {
      console.error('Error removing series:', e);
    }
  };

  // Function to check for crossover signals
  const checkForSignal = (
    prevFast: number,
    prevSlow: number,
    currFast: number,
    currSlow: number,
    candle: any,
    data: any[]
  ) => {
    if (!isNaN(prevFast) && !isNaN(prevSlow) && !isNaN(currFast) && !isNaN(currSlow)) {
      // Calculate average price and range for better positioning
      const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
      const priceRange = data.reduce((range, d) => Math.max(range, Math.abs(d.high - d.low)), 0);
      const offset = priceRange * 0.75; // Use a percentage of the price range for consistent spacing

      // Buy signal: Fast crosses above Slow
      if (prevFast <= prevSlow && currFast > currSlow) {
        return {
          time: candle.time,
          position: 'belowBar',
          color: '#26a69a',
          shape: 'arrowUp',
          text: `Buy ${candle.close.toFixed(2)}`,
          size: 2,
          value: Math.min(...data.slice(-10).map(d => d.low)) - offset, // Position below recent lows
        };
      }
      // Sell signal: Fast crosses below Slow
      else if (prevFast >= prevSlow && currFast < currSlow) {
        return {
          time: candle.time,
          position: 'aboveBar',
          color: '#ef5350',
          shape: 'arrowDown',
          text: `Sell ${candle.close.toFixed(2)}`,
          size: 2,
          value: Math.max(...data.slice(-10).map(d => d.high)) + offset, // Position above recent highs
        };
      }
    }
    return null;
  };

  // Function to add strategy indicators
  const addStrategyIndicators = (chart: IChartApi, data: any[]) => {
    console.log('Adding strategy indicators');
    
    // Clear any existing indicators
    indicatorSeriesRefs.current.forEach(series => safelyRemoveSeries(chart, series));
    indicatorSeriesRefs.current.clear();
    
    if (markerSeriesRef.current) {
      safelyRemoveSeries(chart, markerSeriesRef.current);
      markerSeriesRef.current = null;
    }

    if (strategy === 'none') return;

    const prices = data.map(d => d.close);
    const fastPeriod = 9;
    const slowPeriod = 21;

    // Calculate MAs
    const fastMA = strategy === 'ema_crossover' 
      ? calculateEMA(prices, fastPeriod)
      : calculateSMA(prices, fastPeriod);
    const slowMA = strategy === 'ema_crossover'
      ? calculateEMA(prices, slowPeriod)
      : calculateSMA(prices, slowPeriod);

    // Add MA lines
    const fastSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'Fast MA',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    const slowSeries = chart.addLineSeries({
      color: '#FF6B6B',
      lineWidth: 2,
      title: 'Slow MA',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Store refs
    indicatorSeriesRefs.current.set('Fast MA', fastSeries);
    indicatorSeriesRefs.current.set('Slow MA', slowSeries);

    // Create marker series
    markerSeriesRef.current = chart.addLineSeries({
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      lineVisible: false,
      lineWidth: 1 as LineWidth,
      color: 'rgba(0, 0, 0, 0)',
    });

    // Set MA data
    const maData = data.map((candle, i) => ({
      time: candle.time,
      value: fastMA[i]
    })).filter(d => !isNaN(d.value));
    
    const slowData = data.map((candle, i) => ({
      time: candle.time,
      value: slowMA[i]
    })).filter(d => !isNaN(d.value));

    fastSeries.setData(maData);
    slowSeries.setData(slowData);

    // Find and set signals
    const signals = [];
    for (let i = 1; i < data.length; i++) {
      const signal = checkForSignal(
        fastMA[i - 1],
        slowMA[i - 1],
        fastMA[i],
        slowMA[i],
        data[i],
        data.slice(Math.max(0, i - 10), i + 1) // Pass last 10 candles for context
      );
      if (signal) {
        signals.push(signal);
        console.log(`${signal.text} signal at ${new Date(signal.time * 1000).toLocaleString()}`);
      }
    }

    if (signals.length > 0) {
      console.log(`Setting ${signals.length} historical signals`);
      markerSeriesRef.current.setMarkers(signals);
      
      // Set a data point for each signal to ensure proper positioning
      markerSeriesRef.current.setData(signals.map(signal => ({
        time: signal.time,
        value: signal.value
      })));
    }
  };

  // Modify the real-time signal check
  const checkRealTimeSignal = (data: any[]) => {
    if (!markerSeriesRef.current || data.length < 2) return;

    const prices = data.map(d => d.close);
    const fastPeriod = 9;
    const slowPeriod = 21;

    const fastMA = strategy === 'ema_crossover' 
      ? calculateEMA(prices, fastPeriod)
      : calculateSMA(prices, fastPeriod);
    const slowMA = strategy === 'ema_crossover'
      ? calculateEMA(prices, slowPeriod)
      : calculateSMA(prices, slowPeriod);

    const signal = checkForSignal(
      fastMA[fastMA.length - 2],
      slowMA[slowMA.length - 2],
      fastMA[fastMA.length - 1],
      slowMA[slowMA.length - 1],
      data[data.length - 1],
      data.slice(-10) // Pass last 10 candles for context
    );

    if (signal) {
      const existingMarkers = markerSeriesRef.current.markers() || [];
      console.log(`Adding real-time ${signal.text} signal`);
      markerSeriesRef.current.setMarkers([...existingMarkers, signal]);
    }
  };

  // Effect for strategy changes
  useEffect(() => {
    if (chartRef.current && historicalDataRef.current.length > 0) {
      addStrategyIndicators(chartRef.current, historicalDataRef.current);
    }
  }, [strategy]);

  // Main chart initialization effect
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1E222D' },
        textColor: '#DDD',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
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
    chartRef.current = chart;

    // Remove TradingView logo elements
    const removeTradingViewLogo = () => {
      const logoElement = document.getElementById('tv-attr-logo');
      if (logoElement) {
        logoElement.remove();
      }

      const headerLogo = document.querySelector('.tv-header__link');
      if (headerLogo) {
        headerLogo.remove();
      }
    };

    // Run logo removal after chart is created and after a delay
    removeTradingViewLogo();
    const logoTimeoutId = setTimeout(removeTradingViewLogo, 100);

    // Load initial data
    const loadData = async () => {
      try {
        const data = await getHistoricalData(timeframe);
        historicalDataRef.current = data;
        
        candlestickSeries.setData(data);

        if (strategy !== 'none') {
          addStrategyIndicators(chart, data);
        }

        // Initialize current candle from last historical candle
        if (data.length > 0) {
          const lastCandle = data[data.length - 1];
          currentCandleRef.current = {
            time: lastCandle.time,
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close
          };
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();

    // Real-time updates
    const unsubscribe = subscribeToPrice((data) => {
      if (!candlestickSeriesRef.current) return;

      const intervalSeconds = getIntervalSeconds(timeframe);
      const candleTimestamp = Math.floor(data.time / intervalSeconds) * intervalSeconds;

      // If this is a new candle
      if (!currentCandleRef.current || candleTimestamp !== currentCandleRef.current.time) {
        // If we had a previous candle, add it to historical data and check for signals
        if (currentCandleRef.current) {
          historicalDataRef.current = [...historicalDataRef.current, currentCandleRef.current];
          
          // Update strategies with the new historical data
          if (strategy !== 'none' && chartRef.current) {
            addStrategyIndicators(chartRef.current, historicalDataRef.current);
          }
        }

        // Start new candle
        currentCandleRef.current = {
          time: candleTimestamp,
          open: data.value,
          high: data.value,
          low: data.value,
          close: data.value
        };
      } else {
        // Update current candle
        currentCandleRef.current.high = Math.max(currentCandleRef.current.high, data.value);
        currentCandleRef.current.low = Math.min(currentCandleRef.current.low, data.value);
        currentCandleRef.current.close = data.value;

        // Check for real-time signals with current candle
        if (strategy !== 'none' && chartRef.current && historicalDataRef.current.length > 0) {
          const updatedData = [...historicalDataRef.current, currentCandleRef.current];
          checkRealTimeSignal(updatedData);
        }
      }

      // Update the chart with current candle
      candlestickSeriesRef.current.update(currentCandleRef.current);
    }, timeframe);

    // Handle window resize
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
      clearTimeout(logoTimeoutId);
      unsubscribe();
      chart.remove();
    };
  }, [timeframe]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
} 