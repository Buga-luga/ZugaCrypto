'use client';
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, LineWidth, UTCTimestamp, SeriesType, LineSeries } from 'lightweight-charts';
import { subscribeToPrice, subscribeToTrades, getHistoricalData, Timeframe } from '../../services/api/cryptoCompareAPI';
import { StrategySelector } from '../common/StrategySelector';
import { getStrategy } from '../../services/strategies';
import type { Candle as StrategyCandle } from '../../services/strategies';

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlestickChartProps {
  timeframe: Timeframe;
}

export function CandlestickChart({ timeframe }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('none');
  const candleSeriesRef = useRef<any>(null);
  const currentCandleRef = useRef<Candle | null>(null);
  const strategySeriesRef = useRef<LineSeries | null>(null);

  // Update strategy overlay
  const updateStrategyOverlay = (candles: Candle[]) => {
    if (!chartRef.current) return;

    // Remove existing strategy series if it exists
    if (strategySeriesRef.current) {
      chartRef.current.removeSeries(strategySeriesRef.current);
      strategySeriesRef.current = null;
    }

    const strategy = getStrategy(selectedStrategy);
    if (strategy) {
      const strategySeries = chartRef.current.addLineSeries({
        color: strategy.color,
        lineWidth: 2,
        priceLineVisible: false,
      });
      
      const strategyData = strategy.calculate(candles as StrategyCandle[]);
      strategySeries.setData(strategyData);
      strategySeriesRef.current = strategySeries;
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
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
        fixLeftEdge: true,
        rightOffset: 12,
        barSpacing: 6,
        minBarSpacing: 2,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          if (timeframe === '1d' || timeframe === '1w') {
            return date.toLocaleDateString();
          }
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
        autoScale: true,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
        entireTextOnly: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
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
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    
    candleSeriesRef.current = candlestickSeries;
    chartRef.current = chart;

    // Fetch historical data first
    getHistoricalData(timeframe).then(data => {
      if (data) {
        const candles = data.map((d: any) => ({
          time: d.time as UTCTimestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
        
        candlestickSeries.setData(candles);
        updateStrategyOverlay(candles);
        
        // Set up the current candle
        const lastCandle = candles[candles.length - 1];
        const currentTime = Math.floor(Date.now() / 1000);
        const interval = timeframe === '1w' ? 604800 : 
                        timeframe === '1d' ? 86400 :
                        timeframe === '4h' ? 14400 :
                        timeframe === '1h' ? 3600 :
                        timeframe === '30m' ? 1800 :
                        timeframe === '15m' ? 900 :
                        timeframe === '5m' ? 300 : 60;
                        
        const currentInterval = Math.floor(currentTime / interval) * interval as UTCTimestamp;
        
        currentCandleRef.current = {
          time: currentInterval,
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close,
        };
        
        // Set visible range based on timeframe
        const timeScale = chart.timeScale();
        const visibleBars = timeframe === '1w' ? 52 : // 1 year
                           timeframe === '1d' ? 90 : // 3 months
                           timeframe === '4h' ? 180 : // 30 days
                           timeframe === '1h' ? 168 : // 1 week
                           240; // 4 hours for smaller timeframes
        
        const timeRange = interval * visibleBars;
        const fromTime = currentTime - timeRange;
        const toTime = currentTime + interval * 2;
        
        timeScale.setVisibleRange({
          from: fromTime as UTCTimestamp,
          to: toTime as UTCTimestamp,
        });

        timeScale.fitContent();
      }
    }).catch(console.error);

    // Subscribe to real-time price updates
    const unsubscribePrice = subscribeToPrice(({ time, value }) => {
      // Update current price display immediately
      setCurrentPrice(value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));

      // Update or create new candle
      if (!currentCandleRef.current) {
        const interval = timeframe === '1w' ? 604800 : 
                        timeframe === '1d' ? 86400 :
                        timeframe === '4h' ? 14400 :
                        timeframe === '1h' ? 3600 :
                        timeframe === '30m' ? 1800 :
                        timeframe === '15m' ? 900 :
                        timeframe === '5m' ? 300 : 60;
        const currentInterval = Math.floor(time / interval) * interval as UTCTimestamp;
        
        currentCandleRef.current = {
          time: currentInterval,
          open: value,
          high: value,
          low: value,
          close: value,
        };
      } else {
        const interval = timeframe === '1w' ? 604800 : 
                        timeframe === '1d' ? 86400 :
                        timeframe === '4h' ? 14400 :
                        timeframe === '1h' ? 3600 :
                        timeframe === '30m' ? 1800 :
                        timeframe === '15m' ? 900 :
                        timeframe === '5m' ? 300 : 60;
        const currentInterval = Math.floor(time / interval) * interval as UTCTimestamp;
        const candleInterval = Math.floor(currentCandleRef.current.time / interval) * interval;
        
        if (currentInterval > candleInterval) {
          // Save the completed candle
          const completedCandle = { ...currentCandleRef.current };
          candleSeriesRef.current.update(completedCandle);
          
          // Create new candle
          currentCandleRef.current = {
            time: currentInterval,
            open: value,
            high: value,
            low: value,
            close: value,
          };
        } else {
          // Update current candle
          currentCandleRef.current.high = Math.max(currentCandleRef.current.high, value);
          currentCandleRef.current.low = Math.min(currentCandleRef.current.low, value);
          currentCandleRef.current.close = value;
          
          // Update the candlestick immediately
          candleSeriesRef.current.update(currentCandleRef.current);
        }
      }
      
      // Auto-scroll if we're at the right edge
      const timeScale = chartRef.current?.timeScale();
      if (timeScale) {
        const logicalRange = timeScale.getVisibleLogicalRange();
        if (logicalRange && logicalRange.to >= (currentCandleRef.current.time as number) - 5) {
          timeScale.scrollToPosition(1, false);
        }
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
      if (chartRef.current) {
        chartRef.current.remove();
      }
      unsubscribePrice();
    };
  }, [timeframe]);

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      {currentPrice && (
        <div className="absolute top-4 left-4 bg-[#2B2B43] px-4 py-2 rounded-lg shadow-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">BTC/USD</span>
              <span className="text-2xl font-semibold text-white">${currentPrice}</span>
            </div>
            <StrategySelector
              value={selectedStrategy}
              onChange={(value) => {
                setSelectedStrategy(value);
                if (candleSeriesRef.current) {
                  const data = candleSeriesRef.current.data();
                  updateStrategyOverlay(data);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}