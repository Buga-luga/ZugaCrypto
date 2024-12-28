'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, DeepPartial, ChartOptions, LineWidth, Time, BusinessDay } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice, Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy } from '@/services/strategies';

// Import the calculateEMA function from the strategy file
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA uses SMA as initial value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    ema.push(NaN); // Fill initial values with NaN
  }
  ema[period - 1] = sum / period;

  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    const currentValue = data[i];
    const previousEMA = ema[i - 1];
    const currentEMA = (currentValue - previousEMA) * multiplier + previousEMA;
    ema.push(currentEMA);
  }

  return ema;
}

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
  const historicalDataRef = useRef<any[]>([]);

  // Function to update strategy indicators
  const updateStrategyIndicators = (data: any[], chart: IChartApi) => {
    try {
      console.log('Updating strategy indicators:', {
        strategy,
        dataLength: data.length,
        hasChart: !!chart
      });

      if (!chart || !data.length) {
        console.log('Chart or data not ready, skipping update');
        return;
      }

      if (strategy === 'none') {
        console.log('No strategy selected, clearing indicators');
        // Clear indicators when no strategy is selected
        indicatorSeriesRefs.current.forEach(series => {
          try {
            chart.removeSeries(series);
          } catch (e) {
            console.error('Error removing series:', e);
          }
        });
        indicatorSeriesRefs.current.clear();
        return;
      }

      const selectedStrategy = getStrategy(strategy);
      console.log('Selected strategy:', {
        id: selectedStrategy?.id,
        name: selectedStrategy?.name,
        hasIndicators: selectedStrategy?.indicators?.length
      });

      if (!selectedStrategy) return;

      // Clear previous indicators
      console.log('Clearing previous indicators:', indicatorSeriesRefs.current.size);
      indicatorSeriesRefs.current.forEach(series => {
        try {
          chart.removeSeries(series);
        } catch (e) {
          console.error('Error removing series:', e);
        }
      });
      indicatorSeriesRefs.current.clear();

      // Run strategy analysis and update indicators
      const prices = data.map(d => d.close);
      if (selectedStrategy.id === 'ema_crossover') {
        console.log('Calculating EMAs for crossover strategy');
        const fastPeriod = 9;
        const slowPeriod = 21;
        const fastEMA = calculateEMA(prices, fastPeriod);
        const slowEMA = calculateEMA(prices, slowPeriod);

        // Update indicator data
        if (selectedStrategy.indicators) {
          selectedStrategy.indicators[0].data = fastEMA.map((value, index) => ({
            time: data[index].time,
            value: value
          }));
          selectedStrategy.indicators[1].data = slowEMA.map((value, index) => ({
            time: data[index].time,
            value: value
          }));
          console.log('Updated EMA indicators:', {
            fastEMALength: fastEMA.length,
            slowEMALength: slowEMA.length
          });
        }
      }

      // Run strategy analysis
      const signal = selectedStrategy.analyze(data);
      if (signal) {
        console.log('Strategy Signal:', signal);
      }

      // Add strategy indicators if any
      if (selectedStrategy.indicators) {
        console.log('Adding indicator series to chart');
        selectedStrategy.indicators.forEach((indicator, index) => {
          try {
            const colors = ['#2962FF', '#FF6B6B']; // Blue for fast, Red for slow
            const lineSeries = chart.addLineSeries({
              color: colors[index],
              lineWidth: 2,
              title: indicator.name,
              priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              },
            });
            indicatorSeriesRefs.current.set(indicator.name, lineSeries);
            if (indicator.data.length > 0) {
              console.log(`Setting data for ${indicator.name}:`, indicator.data.length);
              lineSeries.setData(indicator.data);
            }
          } catch (e) {
            console.error(`Error adding indicator series ${indicator.name}:`, e);
          }
        });
      }
    } catch (e) {
      console.error('Error in updateStrategyIndicators:', e);
    }
  };

  // Add an effect specifically for strategy changes
  useEffect(() => {
    console.log('Strategy changed:', strategy);
    // Add a small delay to ensure chart is ready
    const timeoutId = setTimeout(() => {
      if (chartRef.current && historicalDataRef.current.length > 0) {
        updateStrategyIndicators(historicalDataRef.current, chartRef.current);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [strategy]); // Only run when strategy changes

  useEffect(() => {
    if (!chartContainerRef.current) return;
    console.log('Initializing chart with timeframe:', timeframe);

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
        console.log('Loaded historical data:', historicalData.length);
        historicalDataRef.current = historicalData;
        candlestickSeries.setData(historicalData.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));

        // Update strategy indicators with initial data
        updateStrategyIndicators(historicalData, chart);
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
            const newCandle = {
              time: currentCandle.time,
              open: currentCandle.open,
              high: currentCandle.high,
              low: currentCandle.low,
              close: currentCandle.close,
            };
            candlestickSeriesRef.current.update(newCandle);
            
            // Update historical data and strategy indicators
            historicalDataRef.current = [...historicalDataRef.current.slice(1), newCandle];
            if (chartRef.current) {
              updateStrategyIndicators(historicalDataRef.current, chartRef.current);
            }
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