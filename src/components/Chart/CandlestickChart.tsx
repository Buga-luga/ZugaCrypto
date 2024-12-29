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
import { 
  getChartPriceFormat, 
  getScaleFormat, 
  formatPrice, 
  isBTCPair,
  DEFAULT_BTC_FORMAT,
  DEFAULT_USDT_FORMAT
} from '@/utils/priceFormat';

interface CandlestickChartProps {
  timeframe: Timeframe;
  strategy: StrategyId;
  token?: string;
  baseToken?: string;
  exchange?: string;
  onPairChange?: (token: string, baseToken: string) => void;
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
  baseToken = 'USDT',
  exchange = 'CryptoCompare',
  onPairChange = () => {} 
}: CandlestickChartProps) {
  // Function to get default price format based on base token
  const getDefaultPrice = (baseToken: string) => {
    return isBTCPair(baseToken) ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
  };

  const [selectedExchange, setSelectedExchange] = useState(exchange);
  const [currentBaseToken, setCurrentBaseToken] = useState(baseToken);
  const [currentPrice, setCurrentPrice] = useState<string>(() => getDefaultPrice(baseToken));
  const [priceStats, setPriceStats] = useState(() => ({
    change1h: getDefaultPrice(baseToken),
    change24h: getDefaultPrice(baseToken),
    change7d: getDefaultPrice(baseToken),
    high24h: getDefaultPrice(baseToken),
    low24h: getDefaultPrice(baseToken)
  }));
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

  // Function to get appropriate decimal places based on base token
  const getDecimalPlaces = (baseToken: string): number => {
    return isBTCPair(baseToken) ? 8 : 2;
  };

  // Function to get appropriate min move based on base token
  const getMinMove = (baseToken: string): number => {
    return isBTCPair(baseToken) ? 0.00000001 : 0.01;
  };

  // Function to format price based on base token
  const formatPrice = (price: number, baseToken: string): string => {
    if (typeof price !== 'number' || isNaN(price)) {
      return isBTCPair(baseToken) ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
    }
    return price.toFixed(isBTCPair(baseToken) ? 8 : 2);
  };

  // Function to format signal text
  const formatSignalText = (type: string, price: number, baseToken: string): string => {
    return `${type} ${formatPrice(price, baseToken)}`;
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
        const prevHistogram = prevFast - prevSlow;
        const currHistogram = currFast - currSlow;
        
        if (prevHistogram <= 0 && currHistogram > 0) {
          return {
            time: candle.time,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: formatSignalText('Buy', candle.close, baseToken),
            size: 2,
            value: candle.low * 0.999,
          };
        }
        else if (prevHistogram >= 0 && currHistogram < 0) {
          return {
            time: candle.time,
            position: 'aboveBar',
            color: '#ef5350',
            shape: 'arrowDown',
            text: formatSignalText('Sell', candle.close, baseToken),
            size: 2,
            value: candle.high * 1.001,
          };
        }
      } else {
        const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
        const priceRange = data.reduce((range, d) => Math.max(range, Math.abs(d.high - d.low)), 0);
        const offset = priceRange * 0.75;

        if (prevFast <= prevSlow && currFast > currSlow) {
          return {
            time: candle.time,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: formatSignalText('Buy', candle.close, baseToken),
            size: 2,
            value: Math.min(...data.slice(-10).map(d => d.low)) - offset,
          };
        }
        else if (prevFast >= prevSlow && currFast < currSlow) {
          return {
            time: candle.time,
            position: 'aboveBar',
            color: '#ef5350',
            shape: 'arrowDown',
            text: formatSignalText('Sell', candle.close, baseToken),
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
          precision: getDecimalPlaces(baseToken),
          minMove: getMinMove(baseToken),
        },
        priceScaleId: 'overlay',
      });

      const signalSeries = chart.addLineSeries({
        color: '#FF6B6B',
        lineWidth: 2,
        title: 'Signal',
        priceFormat: {
          type: 'price',
          precision: getDecimalPlaces(baseToken),
          minMove: getMinMove(baseToken),
        },
        priceScaleId: 'overlay',
      });

      const histogramSeries = chart.addHistogramSeries({
        color: '#26a69a',
        title: 'Histogram',
        priceFormat: {
          type: 'price',
          precision: getDecimalPlaces(baseToken),
          minMove: getMinMove(baseToken),
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
              precision: getDecimalPlaces(baseToken),
              minMove: getMinMove(baseToken),
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

  // Price format configuration
  const getPriceFormat = useCallback((baseToken: string) => {
    const btcPair = isBTCPair(baseToken);
    return {
      type: 'price' as const,
      precision: btcPair ? 8 : 2,
      minMove: btcPair ? 0.00000001 : 0.01,
      format: (price: number) => {
        if (typeof price !== 'number' || isNaN(price)) {
          return btcPair ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
        }
        return price.toFixed(btcPair ? 8 : 2);
      }
    };
  }, []);

  // Function to update price stats
  const updatePriceStats = useCallback((data: any[]) => {
    if (data.length < 2) return;

    const currentPrice = data[data.length - 1].close;
    
    // Calculate different time period changes
    const last1h = data.slice(-1); // Last hour
    const last24h = data.slice(-24); // Last 24 hours
    const last7d = data.slice(-168); // Last 7 days (24 * 7)
    
    const high24h = Math.max(...last24h.map(d => d.high));
    const low24h = Math.min(...last24h.map(d => d.low));
    
    // Calculate percentage changes
    const getPercentChange = (periodData: any[]) => {
      if (periodData.length < 2) return 0;
      const oldPrice = periodData[0].close;
      return ((currentPrice - oldPrice) / oldPrice) * 100;
    };

    const change1h = getPercentChange(last1h);
    const change24h = getPercentChange(last24h);
    const change7d = getPercentChange(last7d);
    
    // Format prices using the price format utility
    const formatPriceWithCurrentBase = (price: number) => formatPrice(price, currentBaseToken);

    // Update state with formatted values
    const formattedCurrentPrice = formatPriceWithCurrentBase(currentPrice);
    const formattedHigh = formatPriceWithCurrentBase(high24h);
    const formattedLow = formatPriceWithCurrentBase(low24h);

    setCurrentPrice(formattedCurrentPrice);
    setPriceStats({
      change1h: change1h.toFixed(2),
      change24h: change24h.toFixed(2),
      change7d: change7d.toFixed(2),
      high24h: formattedHigh,
      low24h: formattedLow
    });
  }, [currentBaseToken]);

  // Effect for strategy changes
  useEffect(() => {
    if (chartRef.current && historicalDataRef.current.length > 0) {
      addStrategyIndicators(chartRef.current, historicalDataRef.current);
    }
  }, [strategy]);

  // Create series with price format
  const createSeriesWithFormat = useCallback((
    chart: IChartApi,
    options: any,
    priceFormat: any
  ) => {
    return chart.addCandlestickSeries({
      ...options,
      priceFormat: {
        type: priceFormat.type,
        precision: priceFormat.precision,
        minMove: priceFormat.minMove,
      },
    });
  }, []);

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
          bottom: 0.4,
        },
        autoScale: true,
        mode: 0,
        alignLabels: true,
        borderVisible: true,
        entireTextOnly: true,
        ticksVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      localization: {
        priceFormatter: (price: number) => formatPrice(price, currentBaseToken),
      },
    };

    const chart = createChart(chartContainerRef.current, chartOptions);

    // Create candlestick series with price format
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: getDecimalPlaces(currentBaseToken),
        minMove: getMinMove(currentBaseToken),
      },
    });

    candlestickSeriesRef.current = candlestickSeries;
    chartRef.current = chart;

    // Load initial data
    const loadData = async () => {
      try {
        const data = await getHistoricalData(timeframe, token, currentBaseToken);
        historicalDataRef.current = data;
        
        candlestickSeries.setData(data);
        updatePriceStats(data);

        if (strategy !== 'none') {
          addStrategyIndicators(chart, data);
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
      }

      // Update the chart with current candle
      candlestickSeriesRef.current.update(currentCandleRef.current);

      // Update price stats with the latest data
      if (historicalDataRef.current.length > 0) {
        updatePriceStats([...historicalDataRef.current, currentCandleRef.current]);
      }
    }, timeframe, token, currentBaseToken);

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

    // Function to create indicator series with correct price format
    const createIndicatorSeries = (
      type: 'line' | 'histogram',
      options: any
    ) => {
      const priceConfig = getPriceFormat(baseToken);
      const seriesOptions = {
        ...options,
        priceFormat: {
          type: 'price',
          precision: priceConfig.precision,
          minMove: priceConfig.minMove,
        },
      };

      return type === 'line' 
        ? chart.addLineSeries(seriesOptions)
        : chart.addHistogramSeries(seriesOptions);
    };

    // Add MACD series with proper price formatting
    if (strategy === 'macd_crossover') {
      const macdSeries = createIndicatorSeries('line', {
        color: '#2962FF',
        lineWidth: 2,
        title: 'MACD',
        priceScaleId: 'overlay',
      });

      const signalSeries = createIndicatorSeries('line', {
        color: '#FF6B6B',
        lineWidth: 2,
        title: 'Signal',
        priceScaleId: 'overlay',
      });

      const histogramSeries = createIndicatorSeries('histogram', {
        color: '#26a69a',
        title: 'Histogram',
        priceScaleId: 'overlay',
        base: 0,
      });

      indicatorSeriesRefs.current.set('MACD', macdSeries);
      indicatorSeriesRefs.current.set('Signal', signalSeries);
      indicatorSeriesRefs.current.set('Histogram', histogramSeries);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(logoTimeoutId);
      unsubscribe();
      chart.remove();
    };
  }, [timeframe, currentBaseToken]);

  // Handle trading pair change
  const handlePairChange = useCallback((newToken: string, newBaseToken: string) => {
    onPairChange(newToken, newBaseToken);
    setCurrentBaseToken(newBaseToken);
    
    // Reset price states with correct format for the new base token
    const defaultPrice = isBTCPair(newBaseToken) ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
    
    setCurrentPrice(defaultPrice);
    setPriceStats({
      change1h: '0.00',
      change24h: '0.00',
      change7d: '0.00',
      high24h: defaultPrice,
      low24h: defaultPrice
    });
  }, [onPairChange]);

  return (
    <div className="flex flex-col w-full h-full">
      <TickerHeader
        token={token}
        baseToken={baseToken}
        exchange={exchange}
        currentPrice={currentPrice}
        priceStats={priceStats}
        onExchangeChange={setSelectedExchange}
        onPairChange={handlePairChange}
      />
      <div ref={chartContainerRef} className="flex-1" />
    </div>
  );
} 