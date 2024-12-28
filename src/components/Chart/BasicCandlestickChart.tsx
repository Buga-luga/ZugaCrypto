'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, DeepPartial, ChartOptions, LineWidth, Time, BusinessDay } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice, Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy } from '@/services/strategies';

// WARNING: This component uses the CryptoCompare API for real-time Bitcoin price data.
// DO NOT replace this with sample data or modify the data feed implementation.
// The price feed is working correctly and should remain connected to CryptoCompare.

export interface CandlestickChartProps {
  timeframe: Timeframe;
  strategy: StrategyId;
}

export function CandlestickChart({ timeframe, strategy }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<Map<string, any>>(new Map());

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
        fontSize: 12,
        fontFamily: 'Roboto, sans-serif',
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
      watermark: {
        visible: false,
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

    // Fetch historical data
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

        // Apply strategy analysis if a strategy is selected
        if (strategy !== 'none') {
          const selectedStrategy = getStrategy(strategy);
          if (selectedStrategy) {
            // Clear previous indicators
            indicatorSeriesRefs.current.forEach(series => {
              chart.removeSeries(series);
            });
            indicatorSeriesRefs.current.clear();

            // Run strategy analysis
            const signal = selectedStrategy.analyze(historicalData);
            if (signal) {
              console.log('Strategy Signal:', signal);
            }

            // Add strategy indicators if any
            if (selectedStrategy.indicators) {
              selectedStrategy.indicators.forEach(indicator => {
                const lineSeries = chart.addLineSeries({
                  color: '#2962FF',
                  lineWidth: 2,
                });
                indicatorSeriesRefs.current.set(indicator.name, lineSeries);
                if (indicator.data.length > 0) {
                  lineSeries.setData(indicator.data);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading historical data:', error);
      }
    };

    loadData();
    chartRef.current = chart;

    // Subscribe to real-time price updates with improved candle formation
    let currentCandle = {
      open: 0,
      high: -Infinity,
      low: Infinity,
      close: 0,
      time: 0,
    };

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

    const unsubscribe = subscribeToPrice((data) => {
      if (candlestickSeriesRef.current) {
        const intervalSeconds = getIntervalSeconds(timeframe);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const candleTimestamp = Math.floor(currentTimestamp / intervalSeconds) * intervalSeconds;
        
        // If this is a new candle
        if (candleTimestamp !== currentCandle.time) {
          // If there was a previous candle, finalize it
          if (currentCandle.time !== 0) {
            candlestickSeriesRef.current.update({
              time: currentCandle.time,
              open: currentCandle.open,
              high: currentCandle.high,
              low: currentCandle.low,
              close: currentCandle.close,
            });
          }
          
          // Start a new candle
          currentCandle = {
            time: candleTimestamp,
            open: data.value,
            high: data.value,
            low: data.value,
            close: data.value,
          };
        } else {
          // Update existing candle
          if (data.value > currentCandle.high) currentCandle.high = data.value;
          if (data.value < currentCandle.low) currentCandle.low = data.value;
          currentCandle.close = data.value;
        }

        // Update the chart with the current candle state
        candlestickSeriesRef.current.update({
          time: currentCandle.time,
          open: currentCandle.open,
          high: currentCandle.high,
          low: currentCandle.low,
          close: currentCandle.close,
        });
      }
    }, timeframe);

    // Remove TradingView logo elements if they exist
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

    // Run logo removal after chart is created
    removeTradingViewLogo();
    // Also run after a short delay to catch dynamically added elements
    const logoTimeoutId = setTimeout(removeTradingViewLogo, 100);

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
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [timeframe, strategy]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
} 