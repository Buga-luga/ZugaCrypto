'use client';
import { Time, IChartApi, ChartOptions, DeepPartial, LineWidth, BusinessDay, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice, Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy, StrategySignal } from '@/services/strategies';
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
  signals?: StrategySignal[];
}

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

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

export function CandlestickChart({ 
  timeframe, 
  strategy, 
  token = 'BTC', 
  baseToken = 'USDT',
  exchange = 'CryptoCompare',
  onPairChange = () => {},
  signals = []
}: CandlestickChartProps) {
  const [selectedExchange, setSelectedExchange] = useState(exchange);
  const [currentBaseToken, setCurrentBaseToken] = useState(baseToken);
  const [currentPrice, setCurrentPrice] = useState<string>(() => formatPrice(0, baseToken));
  const [priceStats, setPriceStats] = useState(() => ({
    change1h: '0.00',
    change24h: '0.00',
    change7d: '0.00',
    high24h: formatPrice(0, baseToken),
    low24h: formatPrice(0, baseToken)
  }));

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<Map<string, any>>(new Map());
  const markerSeriesRef = useRef<any>(null);
  const historicalDataRef = useRef<any[]>([]);
  const currentCandleRef = useRef<any>(null);
  const lastSignalRef = useRef<{ time: number, type: 'buy' | 'sell' } | null>(null);

  // Handle trading pair change
  const handlePairChange = useCallback((newToken: string, newBaseToken: string) => {
    onPairChange(newToken, newBaseToken);
    setCurrentBaseToken(newBaseToken);
  }, [onPairChange]);

  // Function to update price stats
  const updatePriceStats = useCallback(async () => {
    try {
      // Get 1-minute data for accurate time-based calculations
      const minuteData = await getHistoricalData('1m', token, currentBaseToken);
      if (!minuteData.length) return;

      const currentPrice = minuteData[minuteData.length - 1].close;
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      
      // Calculate time thresholds in seconds
      const oneHourAgo = currentTime - (60 * 60);
      const twentyFourHoursAgo = currentTime - (24 * 60 * 60);
      const sevenDaysAgo = currentTime - (7 * 24 * 60 * 60);
      
      // Filter data for each time period
      const last1h = minuteData.filter(d => d.time >= oneHourAgo);
      const last24h = minuteData.filter(d => d.time >= twentyFourHoursAgo);
      const last7d = minuteData.filter(d => d.time >= sevenDaysAgo);
      
      // Calculate high and low for 24h
      const high24h = Math.max(...last24h.map(d => d.high));
      const low24h = Math.min(...last24h.map(d => d.low));
      
      // Calculate percentage changes
      const getPercentChange = (periodData: any[]) => {
        if (periodData.length < 1) return 0;
        const oldPrice = periodData[0].close;
        return ((currentPrice - oldPrice) / oldPrice) * 100;
      };

      const change1h = getPercentChange(last1h);
      const change24h = getPercentChange(last24h);
      const change7d = getPercentChange(last7d);
      
      // Format prices using the price format utility
      const formattedHigh = formatPrice(high24h, currentBaseToken);
      const formattedLow = formatPrice(low24h, currentBaseToken);

      setPriceStats({
        change1h: change1h.toFixed(2),
        change24h: change24h.toFixed(2),
        change7d: change7d.toFixed(2),
        high24h: formattedHigh,
        low24h: formattedLow
      });
    } catch (error) {
      console.error('Error updating price stats:', error);
    }
  }, [token, currentBaseToken]);

  // Function to add strategy indicators
  const addStrategyIndicators = useCallback((chart: IChartApi, data: any[]) => {
    if (!chart) {
      console.error('Chart is not initialized');
      return;
    }

    try {
      // Clear any existing indicators
      indicatorSeriesRefs.current.forEach(series => {
        try {
          if (series && chart) {
            chart.removeSeries(series);
          }
        } catch (e) {
          console.error('Error removing series:', e);
        }
      });
      indicatorSeriesRefs.current.clear();

      if (markerSeriesRef.current) {
        try {
          chart.removeSeries(markerSeriesRef.current);
        } catch (e) {
          console.error('Error removing marker series:', e);
        }
        markerSeriesRef.current = null;
      }

      if (strategy === 'none') return;

      // Calculate indicators based on strategy
      const prices = data.map(d => d.close);
      let fastLine: number[] = [];
      let slowLine: number[] = [];

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

      // Add indicator lines
      const selectedStrategy = getStrategy(strategy);
      if (!selectedStrategy) return;

      const colors = ['#2962FF', '#FF6B6B'];
      selectedStrategy.indicators.forEach((indicator, index) => {
        const lineSeries = chart.addLineSeries({
          color: colors[index],
          lineWidth: 2,
          title: indicator.name,
          priceFormat: {
            type: 'price',
            precision: isBTCPair(currentBaseToken) ? 8 : 2,
            minMove: isBTCPair(currentBaseToken) ? 0.00000001 : 0.01,
          },
        });
        indicatorSeriesRefs.current.set(indicator.name, lineSeries);

        const lineData = (index === 0 ? fastLine : slowLine)
          .map((value, idx) => ({
            time: data[idx].time,
            value: isNaN(value) ? null : value
          }))
          .filter(d => d.value !== null);

        lineSeries.setData(lineData);
      });

      // Add crossover signals with markers, text, and triangle shape
      const markers = [];
      for (let i = 1; i < data.length; i++) {
        const prevFast = fastLine[i - 1];
        const prevSlow = slowLine[i - 1];
        const currFast = fastLine[i];
        const currSlow = slowLine[i];

        if (!isNaN(prevFast) && !isNaN(prevSlow) && !isNaN(currFast) && !isNaN(currSlow)) {
          if (prevFast <= prevSlow && currFast > currSlow) {
            markers.push({
              time: data[i].time,
              position: 'belowBar',
              color: '#26a69a',
              shape: 'arrowUp',
              text: 'Buy',
            });
          } else if (prevFast >= prevSlow && currFast < currSlow) {
            markers.push({
              time: data[i].time,
              position: 'aboveBar',
              color: '#ef5350',
              shape: 'arrowDown',
              text: 'Sell',
            });
          }
        }
      }

      markerSeriesRef.current = markers;
    } catch (error) {
      console.error('Error adding strategy indicators:', error);
    }
  }, [strategy, currentBaseToken]);

  // Effect for strategy changes
  useEffect(() => {
    if (!chartRef.current || historicalDataRef.current.length === 0) {
      return;
    }
    
    try {
      addStrategyIndicators(chartRef.current, historicalDataRef.current);
    } catch (error) {
      console.error('Error in strategy change effect:', error);
    }
  }, [strategy, addStrategyIndicators]);

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
        precision: isBTCPair(currentBaseToken) ? 8 : 2,
        minMove: isBTCPair(currentBaseToken) ? 0.00000001 : 0.01,
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
        updatePriceStats();

        // Set the current candle reference to the last candle
        if (data.length > 0) {
          currentCandleRef.current = data[data.length - 1];
        }

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
      if (!candlestickSeriesRef.current) {
        console.warn('Candlestick series not initialized');
        return;
      }

      // Update current price display immediately
      const formattedPrice = formatPrice(data.value, currentBaseToken);
      setCurrentPrice(formattedPrice);

      const intervalSeconds = getIntervalSeconds(timeframe);
      const candleTimestamp = Math.floor(data.time / intervalSeconds) * intervalSeconds;

      // Update chart candles
      if (!currentCandleRef.current || candleTimestamp !== currentCandleRef.current.time) {
        if (currentCandleRef.current) {
          historicalDataRef.current.push(currentCandleRef.current);
        }

        const newCandle = {
          time: candleTimestamp as UTCTimestamp,
          open: data.value,
          high: data.value,
          low: data.value,
          close: data.value
        };

        currentCandleRef.current = newCandle;
        candlestickSeriesRef.current.update(newCandle);

        if (strategy !== 'none' && chartRef.current) {
          addStrategyIndicators(chartRef.current, historicalDataRef.current);
        }
      } else {
        const updatedCandle = {
          ...currentCandleRef.current,
          high: Math.max(currentCandleRef.current.high, data.value),
          low: Math.min(currentCandleRef.current.low, data.value),
          close: data.value
        };

        currentCandleRef.current = updatedCandle;
        candlestickSeriesRef.current.update(updatedCandle);
      }

      // Update price stats with all available data
      if (historicalDataRef.current.length > 0) {
        const allData = [...historicalDataRef.current];
        if (currentCandleRef.current) {
          allData.push(currentCandleRef.current);
        }
        updatePriceStats();
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

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      
      if (chartRef.current) {
        indicatorSeriesRefs.current.forEach(series => {
          try {
            chartRef.current?.removeSeries(series);
          } catch (e) {
            console.error('Error removing indicator series during cleanup:', e);
          }
        });
        indicatorSeriesRefs.current.clear();
        
        if (markerSeriesRef.current) {
          try {
            chartRef.current.removeSeries(markerSeriesRef.current);
          } catch (e) {
            console.error('Error removing marker series during cleanup:', e);
          }
          markerSeriesRef.current = null;
        }
        
        chart.remove();
      }
    };
  }, [timeframe, currentBaseToken, strategy, token, updatePriceStats, addStrategyIndicators]);

  // Ensure markers are set on the candlestick series
  useEffect(() => {
    if (candlestickSeriesRef.current && markerSeriesRef.current) {
      candlestickSeriesRef.current.setMarkers(markerSeriesRef.current);
    }
  }, [markerSeriesRef.current]);

  // Helper function to calculate indicators
  const calculateIndicator = (prices: number[], type: string, period: number) => {
    switch (type) {
      case 'ema':
        return calculateEMA(prices, period);
      case 'sma':
        return calculateSMA(prices, period);
      case 'tema':
        return calculateTEMA(prices, period);
      case 'hma':
        return calculateHMA(prices, period);
      default:
        return [];
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <TickerHeader
        token={token}
        baseToken={currentBaseToken}
        exchange={selectedExchange}
        currentPrice={currentPrice}
        priceStats={priceStats}
        onExchangeChange={setSelectedExchange}
        onPairChange={handlePairChange}
      />
      <div ref={chartContainerRef} className="flex-1" />
    </div>
  );
} 