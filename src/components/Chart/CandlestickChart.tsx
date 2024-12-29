'use client';
import { Time, IChartApi, ChartOptions, DeepPartial, LineWidth, BusinessDay, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice, Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy } from '@/services/strategies';
import { 
  calculateEMA,
  calculateSMA,
  calculateTEMA,
  calculateHMA,
  calculateMACD
} from '@/services/strategies/moving-averages';
import { TickerHeader } from './TickerHeader';

interface CandlestickChartProps {
  timeframe: Timeframe;
  strategy: StrategyId;
  token?: string;
  baseToken?: string;
  exchange?: 'cryptocompare' | 'binance' | 'coinbase';
}

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function CandlestickChart({ 
  timeframe, 
  strategy, 
  token = 'BTC', 
  baseToken: initialBaseToken = 'USDT', 
  exchange: initialExchange = 'cryptocompare' 
}: CandlestickChartProps) {
  const [exchange, setExchange] = useState(initialExchange);
  const [baseToken, setBaseToken] = useState(initialBaseToken);
  const [currentPrice, setCurrentPrice] = useState<string>('Loading...');
  const [priceStats, setPriceStats] = useState({
    change24h: '—',
    high24h: '—',
    low24h: '—'
  });
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
      if (strategy === 'macd_crossover') {
        // For MACD, we want signals based on histogram crossovers
        const prevHistogram = prevFast - prevSlow;
        const currHistogram = currFast - currSlow;
        
        // Buy signal: Histogram crosses above zero
        if (prevHistogram <= 0 && currHistogram > 0) {
          return {
            time: candle.time,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: `Buy ${candle.close.toFixed(2)}`,
            size: 2,
            value: candle.low * 0.999, // Just below the candle
          };
        }
        // Sell signal: Histogram crosses below zero
        else if (prevHistogram >= 0 && currHistogram < 0) {
          return {
            time: candle.time,
            position: 'aboveBar',
            color: '#ef5350',
            shape: 'arrowDown',
            text: `Sell ${candle.close.toFixed(2)}`,
            size: 2,
            value: candle.high * 1.001, // Just above the candle
          };
        }
      } else {
        // Calculate average price and range for better positioning
        const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
        const priceRange = data.reduce((range, d) => Math.max(range, Math.abs(d.high - d.low)), 0);
        const offset = priceRange * 0.75;

        // Buy signal: Fast crosses above Slow
        if (prevFast <= prevSlow && currFast > currSlow) {
          return {
            time: candle.time,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: `Buy ${candle.close.toFixed(2)}`,
            size: 2,
            value: Math.min(...data.slice(-10).map(d => d.low)) - offset,
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
            value: Math.max(...data.slice(-10).map(d => d.high)) + offset,
          };
        }
      }
    }
    return null;
  };

  // Function to get histogram scale factor based on timeframe
  const getHistogramScaleFactor = (tf: Timeframe, maxHistogram: number): number => {
    if (maxHistogram === 0) return 1;
    
    switch (tf) {
      case '1h':
      case '4h':
      case '1d':
      case '1w':
        return 100 / maxHistogram; // Much larger scaling for higher timeframes
      default:
        return 20 / maxHistogram; // Original scaling for lower timeframes
    }
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

    // Ensure data is sorted and deduplicated by time
    const uniqueData = Array.from(new Map(data.map(item => [item.time, item])).values())
      .sort((a, b) => (a.time as number) - (b.time as number));

    const prices = uniqueData.map(d => d.close);
    let fastLine: number[] = [];
    let slowLine: number[] = [];
    let histogramData: number[] = [];

    // Calculate indicators based on strategy type
    if (strategy === 'macd_crossover') {
      const macdData = calculateMACD(prices);
      fastLine = macdData.macd;
      slowLine = macdData.signal;
      histogramData = macdData.histogram;
    } else {
      switch (strategy) {
        case 'ema_crossover':
          fastLine = calculateEMA(prices, 9);
          slowLine = calculateEMA(prices, 21);
          break;
        case 'sma_crossover':
          fastLine = calculateSMA(prices, 9);
          slowLine = calculateSMA(prices, 21);
          break;
        case 'tema_crossover':
          fastLine = calculateTEMA(prices, 7);
          slowLine = calculateTEMA(prices, 21);
          break;
        case 'golden_cross':
          fastLine = calculateSMA(prices, 50);
          slowLine = calculateSMA(prices, 200);
          break;
        case 'hull_crossover':
          fastLine = calculateHMA(prices, 9);
          slowLine = calculateHMA(prices, 21);
          break;
        case 'ema_5_13':
          fastLine = calculateEMA(prices, 5);
          slowLine = calculateEMA(prices, 13);
          break;
      }
    }

    // Add indicator lines
    const selectedStrategy = getStrategy(strategy);
    if (!selectedStrategy) return;

    if (strategy === 'macd_crossover') {
      // Create MACD series with separate price scale
      const macdSeries = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        title: 'MACD',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        priceScaleId: 'overlay',
      });

      const signalSeries = chart.addLineSeries({
        color: '#FF6B6B',
        lineWidth: 2,
        title: 'Signal',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        priceScaleId: 'overlay',
      });

      const histogramSeries = chart.addHistogramSeries({
        color: '#26a69a',
        title: 'Histogram',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        priceScaleId: 'overlay',
        base: 0,
      });

      // Configure the price scale for MACD
      const macdScale = chart.priceScale('overlay');
      if (macdScale) {
        macdScale.applyOptions({
          scaleMargins: {
            top: 0.7,
            bottom: 0.1,
          },
          visible: true,
          borderVisible: true,
        });
      }

      indicatorSeriesRefs.current.set('MACD', macdSeries);
      indicatorSeriesRefs.current.set('Signal', signalSeries);
      indicatorSeriesRefs.current.set('Histogram', histogramSeries);

      // Set data for each series
      const macdLineData = fastLine.map((value, idx) => ({
        time: uniqueData[idx].time,
        value: isNaN(value) ? null : value
      })).filter(d => d.value !== null);

      const signalLineData = slowLine.map((value, idx) => ({
        time: uniqueData[idx].time,
        value: isNaN(value) ? null : value
      })).filter(d => d.value !== null);

      // Scale histogram values with dynamic scaling
      const maxHistogram = Math.max(...histogramData.map(Math.abs));
      const scaleFactor = getHistogramScaleFactor(timeframe, maxHistogram);

      const histogramSeriesData = histogramData.map((value, idx) => ({
        time: uniqueData[idx].time,
        value: isNaN(value) ? null : value * scaleFactor,
        color: value >= 0 ? '#26a69a' : '#ef5350'
      })).filter(d => d.value !== null);

      macdSeries.setData(macdLineData);
      signalSeries.setData(signalLineData);
      histogramSeries.setData(histogramSeriesData);

      // Also update the real-time update scaling factor
      if (macdSeries && signalSeries && histogramSeries) {
        const lastMACD = {
          time: uniqueData[uniqueData.length - 1].time,
          value: fastLine[fastLine.length - 1]
        };

        const lastSignal = {
          time: uniqueData[uniqueData.length - 1].time,
          value: slowLine[slowLine.length - 1]
        };

        const lastHistogram = {
          time: uniqueData[uniqueData.length - 1].time,
          value: histogramData[histogramData.length - 1] * scaleFactor,
          color: histogramData[histogramData.length - 1] >= 0 ? '#26a69a' : '#ef5350'
        };

        macdSeries.update(lastMACD);
        signalSeries.update(lastSignal);
        histogramSeries.update(lastHistogram);
      }

    } else {
      // Handle other strategies
      const colors = ['#2962FF', '#FF6B6B'];
      selectedStrategy.indicators.forEach((indicator, index) => {
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

        const lineData = (index === 0 ? fastLine : slowLine)
          .map((value, idx) => ({
            time: uniqueData[idx].time,
            value: isNaN(value) ? null : value
          }))
          .filter(d => d.value !== null)
          .sort((a, b) => (a.time as number) - (b.time as number));

        lineSeries.setData(lineData);
      });
    }

    // Create marker series
    markerSeriesRef.current = chart.addLineSeries({
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      lineVisible: false,
      lineWidth: 1 as LineWidth,
      color: 'rgba(0, 0, 0, 0)',
      priceScaleId: 'right', // Always use right scale for markers
    });

    // Find and set signals
    const signals = [];
    for (let i = 1; i < uniqueData.length; i++) {
      const signal = checkForSignal(
        fastLine[i - 1],
        slowLine[i - 1],
        fastLine[i],
        slowLine[i],
        uniqueData[i],
        uniqueData.slice(Math.max(0, i - 10), i + 1)
      );
      if (signal) {
        signals.push(signal);
      }
    }

    if (signals.length > 0) {
      const sortedSignals = signals.sort((a, b) => (a.time as number) - (b.time as number));
      markerSeriesRef.current.setMarkers(sortedSignals);
      markerSeriesRef.current.setData(sortedSignals.map(signal => ({
        time: signal.time,
        value: signal.value
      })));
    }
  };

  // Modify the real-time signal check
  const checkRealTimeSignal = (data: any[]) => {
    if (!markerSeriesRef.current || data.length < 2) return;

    // Ensure data is sorted and deduplicated
    const uniqueData = Array.from(new Map(data.map(item => [item.time, item])).values())
      .sort((a, b) => (a.time as number) - (b.time as number));

    const prices = uniqueData.map(d => d.close);
    let fastLine: number[] = [];
    let slowLine: number[] = [];
    let histogramData: number[] = [];

    // Calculate indicators based on strategy type
    if (strategy === 'macd_crossover') {
      const macdData = calculateMACD(prices);
      fastLine = macdData.macd;
      slowLine = macdData.signal;
      histogramData = macdData.histogram;

      // Update MACD series if they exist
      const macdSeries = indicatorSeriesRefs.current.get('MACD');
      const signalSeries = indicatorSeriesRefs.current.get('Signal');
      const histogramSeries = indicatorSeriesRefs.current.get('Histogram');

      if (macdSeries && signalSeries && histogramSeries) {
        // Scale histogram values with dynamic scaling
        const maxHistogram = Math.max(...histogramData.map(Math.abs));
        const scaleFactor = getHistogramScaleFactor(timeframe, maxHistogram);

        const lastMACD = {
          time: uniqueData[uniqueData.length - 1].time,
          value: fastLine[fastLine.length - 1]
        };

        const lastSignal = {
          time: uniqueData[uniqueData.length - 1].time,
          value: slowLine[slowLine.length - 1]
        };

        const lastHistogram = {
          time: uniqueData[uniqueData.length - 1].time,
          value: histogramData[histogramData.length - 1] * scaleFactor,
          color: histogramData[histogramData.length - 1] >= 0 ? '#26a69a' : '#ef5350'
        };

        macdSeries.update(lastMACD);
        signalSeries.update(lastSignal);
        histogramSeries.update(lastHistogram);
      }
    } else {
      switch (strategy) {
        case 'ema_crossover':
          fastLine = calculateEMA(prices, 9);
          slowLine = calculateEMA(prices, 21);
          break;
        case 'sma_crossover':
          fastLine = calculateSMA(prices, 9);
          slowLine = calculateSMA(prices, 21);
          break;
        case 'tema_crossover':
          fastLine = calculateTEMA(prices, 7);
          slowLine = calculateTEMA(prices, 21);
          break;
        case 'golden_cross':
          fastLine = calculateSMA(prices, 50);
          slowLine = calculateSMA(prices, 200);
          break;
        case 'hull_crossover':
          fastLine = calculateHMA(prices, 9);
          slowLine = calculateHMA(prices, 21);
          break;
        case 'ema_5_13':
          fastLine = calculateEMA(prices, 5);
          slowLine = calculateEMA(prices, 13);
          break;
      }
    }

    const signal = checkForSignal(
      fastLine[fastLine.length - 2],
      slowLine[slowLine.length - 2],
      fastLine[fastLine.length - 1],
      slowLine[slowLine.length - 1],
      uniqueData[uniqueData.length - 1],
      uniqueData.slice(-10)
    );

    if (signal) {
      const existingMarkers = markerSeriesRef.current.markers() || [];
      const newMarkers = [...existingMarkers, signal]
        .sort((a, b) => (a.time as number) - (b.time as number));
      
      console.log(`Adding real-time ${signal.text} signal`);
      markerSeriesRef.current.setMarkers(newMarkers);
      
      // Update marker series data
      markerSeriesRef.current.setData(newMarkers.map(marker => ({
        time: marker.time,
        value: marker.value
      })));
    }
  };

  // Function to update price stats
  const updatePriceStats = useCallback((data: any[]) => {
    if (data.length < 2) return;

    const last24h = data.slice(-24); // Assuming hourly data
    const currentPrice = last24h[last24h.length - 1].close;
    const openPrice = last24h[0].open;
    const high24h = Math.max(...last24h.map(d => d.high));
    const low24h = Math.min(...last24h.map(d => d.low));
    
    const priceChange = ((currentPrice - openPrice) / openPrice) * 100;
    const changeColor = priceChange >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]';

    setCurrentPrice(currentPrice.toFixed(2));
    setPriceStats({
      change24h: `<span class="${changeColor}">${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%</span>`,
      high24h: high24h.toFixed(2),
      low24h: low24h.toFixed(2)
    });

    // Update DOM elements
    const priceElement = document.getElementById('current-price');
    const changeElement = document.getElementById('price-change');
    const highElement = document.getElementById('24h-high');
    const lowElement = document.getElementById('24h-low');

    if (priceElement) priceElement.textContent = currentPrice.toFixed(2);
    if (changeElement) changeElement.innerHTML = `<span class="${changeColor}">${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%</span>`;
    if (highElement) highElement.textContent = high24h.toFixed(2);
    if (lowElement) lowElement.textContent = low24h.toFixed(2);
  }, []);

  // Effect for strategy changes
  useEffect(() => {
    if (chartRef.current && historicalDataRef.current.length > 0) {
      addStrategyIndicators(chartRef.current, historicalDataRef.current);
    }
  }, [strategy]);

  // Main chart initialization effect
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions: DeepPartial<ChartOptions> = {
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
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.4, // Leave space for MACD
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    };

    const chart = createChart(chartContainerRef.current, chartOptions);

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceScaleId: 'right',
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
        updatePriceStats(data); // Update price stats with historical data

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

      // Update price stats with the latest data
      if (historicalDataRef.current.length > 0) {
        updatePriceStats([...historicalDataRef.current, currentCandleRef.current]);
      }
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

  // Handle trading pair change
  const handlePairChange = useCallback((newToken: string, newBaseToken: string) => {
    setBaseToken(newBaseToken);
    // Reload data for new trading pair
    if (chartRef.current && candlestickSeriesRef.current) {
      const loadNewData = async () => {
        try {
          const data = await getHistoricalData(timeframe);
          historicalDataRef.current = data;
          
          candlestickSeriesRef.current.setData(data);
          updatePriceStats(data);

          if (strategy !== 'none') {
            addStrategyIndicators(chartRef.current!, data);
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

      loadNewData();
    }
  }, [timeframe, strategy, updatePriceStats]);

  return (
    <div className="flex flex-col w-full h-full">
      <TickerHeader
        token={token}
        baseToken={baseToken}
        exchange={exchange}
        onExchangeChange={setExchange}
        onPairChange={handlePairChange}
      />
      <div ref={chartContainerRef} className="flex-1" />
    </div>
  );
} 