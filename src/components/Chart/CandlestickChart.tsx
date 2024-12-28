'use client';
import { Time, IChartApi, ChartOptions, DeepPartial, LineWidth, BusinessDay } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { getHistoricalData, subscribeToPrice } from '@/services/api/cryptoCompareAPI';
import { Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId, getStrategy } from '@/services/strategies';
import { calculateEMA } from '@/services/strategies/ema-crossover';
import { calculateSMA } from '@/services/strategies/sma-crossover';

interface CandlestickChartProps {
  timeframe: Timeframe;
  strategy: StrategyId;
}

export function CandlestickChart({ timeframe, strategy }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<Map<string, any>>(new Map());
  const historicalDataRef = useRef<any[]>([]);
  const markerSeriesRef = useRef<any>(null);

  // Function to detect signals from EMA data
  const detectEMASignals = (data: any[], fastEMA: number[], slowEMA: number[]): any[] => {
    const markers: any[] = [];
    for (let i = 1; i < Math.min(data.length, fastEMA.length, slowEMA.length); i++) {
      const prevFast = fastEMA[i - 1];
      const prevSlow = slowEMA[i - 1];
      const currFast = fastEMA[i];
      const currSlow = slowEMA[i];

      // Debug crossover conditions
      console.log('Checking crossover:', {
        time: new Date(data[i].time * 1000).toLocaleString(),
        prevFast: prevFast?.toFixed(2),
        prevSlow: prevSlow?.toFixed(2),
        currFast: currFast?.toFixed(2),
        currSlow: currSlow?.toFixed(2),
        isBuy: prevFast <= prevSlow && currFast > currSlow,
        isSell: prevFast >= prevSlow && currFast < currSlow
      });

      // Only add signals if we have valid EMA values
      if (!isNaN(prevFast) && !isNaN(prevSlow) && !isNaN(currFast) && !isNaN(currSlow)) {
        // Buy signal: Fast EMA crosses above Slow EMA
        if (prevFast <= prevSlow && currFast > currSlow) {
          markers.push({
            time: data[i].time,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: `BUY\n$${data[i].close.toFixed(2)}`,
            size: 2,
          });
          console.log('🟢 Buy Signal Detected:', {
            price: data[i].close,
            time: new Date(data[i].time * 1000).toLocaleString(),
            fastEMA: currFast.toFixed(2),
            slowEMA: currSlow.toFixed(2),
            diff: (currFast - currSlow).toFixed(2)
          });
        }
        // Sell signal: Fast EMA crosses below Slow EMA
        else if (prevFast >= prevSlow && currFast < currSlow) {
          markers.push({
            time: data[i].time,
            position: 'aboveBar',
            color: '#ef5350',
            shape: 'arrowDown',
            text: `SELL\n$${data[i].close.toFixed(2)}`,
            size: 2,
          });
          console.log('🔴 Sell Signal Detected:', {
            price: data[i].close,
            time: new Date(data[i].time * 1000).toLocaleString(),
            fastEMA: currFast.toFixed(2),
            slowEMA: currSlow.toFixed(2),
            diff: (currFast - currSlow).toFixed(2)
          });
        }
      }
    }
    return markers;
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

  // Function to update strategy indicators
  const updateStrategyIndicators = (data: any[], chart: IChartApi) => {
    try {
      if (!chart || !data.length) {
        console.log('Chart or data not ready, skipping update');
        return;
      }

      // Clear existing markers and indicators
      safelyRemoveSeries(chart, markerSeriesRef.current);
      markerSeriesRef.current = null;

      indicatorSeriesRefs.current.forEach(series => {
        safelyRemoveSeries(chart, series);
      });
      indicatorSeriesRefs.current.clear();

      if (strategy === 'none') {
        console.log('No strategy selected, clearing indicators');
        return;
      }

      const selectedStrategy = getStrategy(strategy);
      if (!selectedStrategy?.indicators) {
        console.log('No indicators found for strategy:', strategy);
        return;
      }

      console.log('Setting up strategy:', selectedStrategy.id);

      // Create marker series for signals
      markerSeriesRef.current = candlestickSeriesRef.current;  // Use the candlestick series for markers

      // Run strategy analysis and update indicators
      const prices = data.map(d => d.close);
      
      if (selectedStrategy.id === 'ema_crossover' || selectedStrategy.id === 'sma_crossover') {
        console.log(`Calculating ${selectedStrategy.id === 'ema_crossover' ? 'EMAs' : 'SMAs'} for crossover strategy`);
        const fastPeriod = 9;
        const slowPeriod = 21;
        const fastLine = selectedStrategy.id === 'ema_crossover' 
          ? calculateEMA(prices, fastPeriod)
          : calculateSMA(prices, fastPeriod);
        const slowLine = selectedStrategy.id === 'ema_crossover'
          ? calculateEMA(prices, slowPeriod)
          : calculateSMA(prices, slowPeriod);

        // Add indicator lines
        selectedStrategy.indicators.forEach((indicator, index) => {
          console.log(`Adding indicator: ${indicator.name}`);
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
            lineStyle: 1, // Solid line
          });
          indicatorSeriesRefs.current.set(indicator.name, lineSeries);

          // Update indicator data with proper types
          const lineData = (index === 0 ? fastLine : slowLine).map((value: number, idx: number) => ({
            time: data[idx].time,
            value: value
          }));
          lineSeries.setData(lineData);
        });

        // Get historical signals
        const markers = [];
        for (let i = 1; i < data.length; i++) {
          const prevFast = fastLine[i - 1];
          const prevSlow = slowLine[i - 1];
          const currFast = fastLine[i];
          const currSlow = slowLine[i];

          if (!isNaN(prevFast) && !isNaN(prevSlow) && !isNaN(currFast) && !isNaN(currSlow)) {
            if (prevFast <= prevSlow && currFast > currSlow) {
              // Buy signal
              markers.push({
                time: data[i].time,
                position: 'belowBar',
                color: '#26a69a',
                shape: 'arrowUp',
                text: 'BUY',
                size: 2,
              });
              console.log('Buy Signal at:', {
                time: new Date(data[i].time * 1000).toLocaleString(),
                price: data[i].close,
                fastLine: currFast.toFixed(2),
                slowLine: currSlow.toFixed(2)
              });
            } else if (prevFast >= prevSlow && currFast < currSlow) {
              // Sell signal
              markers.push({
                time: data[i].time,
                position: 'aboveBar',
                color: '#ef5350',
                shape: 'arrowDown',
                text: 'SELL',
                size: 2,
              });
              console.log('Sell Signal at:', {
                time: new Date(data[i].time * 1000).toLocaleString(),
                price: data[i].close,
                fastLine: currFast.toFixed(2),
                slowLine: currSlow.toFixed(2)
              });
            }
          }
        }

        if (markers.length > 0) {
          console.log('Setting markers:', markers);
          markerSeriesRef.current.setMarkers(markers);
        }
      }
    } catch (e) {
      console.error('Error in updateStrategyIndicators:', e);
    }
  };

  // Update the strategy change effect
  useEffect(() => {
    console.log('Strategy changed:', strategy);
    
    if (chartRef.current) {
      // Clear existing indicators and markers
      safelyRemoveSeries(chartRef.current, markerSeriesRef.current);
      markerSeriesRef.current = null;

      indicatorSeriesRefs.current.forEach(series => {
        safelyRemoveSeries(chartRef.current!, series);
      });
      indicatorSeriesRefs.current.clear();

      // Reinitialize strategy indicators
      if (historicalDataRef.current.length > 0) {
        console.log('Reinitializing strategy indicators with data length:', historicalDataRef.current.length);
        updateStrategyIndicators(historicalDataRef.current, chartRef.current);
      }
    }
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
            
            // Update historical data with the new candle
            historicalDataRef.current = [...historicalDataRef.current.slice(1), newCandle];
          }
          
          // Start a new candle
          currentCandle = {
            time: candleTimestamp,
            open: data.value,
            high: data.value,
            low: data.value,
            close: data.value,
          };

          // Update candlestick series with the new candle
          candlestickSeriesRef.current.update(currentCandle);
        } else {
          // Update existing candle
          if (data.value > currentCandle.high) currentCandle.high = data.value;
          if (data.value < currentCandle.low) currentCandle.low = data.value;
          currentCandle.close = data.value;

          // Update candlestick series with the current state
          candlestickSeriesRef.current.update(currentCandle);
        }

        // Update strategy indicators if we have a strategy selected
        if (strategy !== 'none' && chartRef.current && indicatorSeriesRefs.current.size > 0) {
          const selectedStrategy = getStrategy(strategy);
          if (selectedStrategy && selectedStrategy.id === 'ema_crossover') {
            // Include the current candle in the calculations
            const updatedData = [...historicalDataRef.current.slice(1), currentCandle];
            const prices = updatedData.map(d => d.close);
            const fastPeriod = 9;
            const slowPeriod = 21;
            const fastEMA = calculateEMA(prices, fastPeriod);
            const slowEMA = calculateEMA(prices, slowPeriod);

            // Update the line series with new data
            indicatorSeriesRefs.current.forEach((series, name) => {
              const emaData = (name === 'Fast EMA (9)' ? fastEMA : slowEMA).map((value, index) => ({
                time: updatedData[index].time,
                value: value
              }));
              series.setData(emaData);
            });

            // Check for new signal
            const last = fastEMA.length - 1;
            const prev = last - 1;
            if (prev >= 0 && !isNaN(fastEMA[prev]) && !isNaN(slowEMA[prev]) && 
                !isNaN(fastEMA[last]) && !isNaN(slowEMA[last])) {
              
              // Debug real-time crossover conditions
              const crossingUp = fastEMA[prev] <= slowEMA[prev] && fastEMA[last] > slowEMA[last];
              const crossingDown = fastEMA[prev] >= slowEMA[prev] && fastEMA[last] < slowEMA[last];
              
              if (crossingUp || crossingDown) {
                console.log('Real-time EMA Status:', {
                  time: new Date(currentCandle.time * 1000).toLocaleString(),
                  price: currentCandle.close,
                  prevFastEMA: fastEMA[prev].toFixed(2),
                  prevSlowEMA: slowEMA[prev].toFixed(2),
                  currFastEMA: fastEMA[last].toFixed(2),
                  currSlowEMA: slowEMA[last].toFixed(2),
                  signal: crossingUp ? 'BUY' : 'SELL'
                });
              }

              let newMarker = null;
              if (crossingUp) {
                // Buy signal
                newMarker = {
                  time: currentCandle.time,
                  position: 'belowBar',
                  color: '#26a69a',
                  shape: 'arrowUp',
                  text: 'BUY',
                  size: 2,
                };
                console.log('🟢 Real-time Buy Signal:', {
                  price: currentCandle.close,
                  time: new Date(currentCandle.time * 1000).toLocaleString(),
                  fastEMA: fastEMA[last].toFixed(2),
                  slowEMA: slowEMA[last].toFixed(2),
                  diff: (fastEMA[last] - slowEMA[last]).toFixed(2)
                });
              } else if (crossingDown) {
                // Sell signal
                newMarker = {
                  time: currentCandle.time,
                  position: 'aboveBar',
                  color: '#ef5350',
                  shape: 'arrowDown',
                  text: 'SELL',
                  size: 2,
                };
                console.log('🔴 Real-time Sell Signal:', {
                  price: currentCandle.close,
                  time: new Date(currentCandle.time * 1000).toLocaleString(),
                  fastEMA: fastEMA[last].toFixed(2),
                  slowEMA: slowEMA[last].toFixed(2),
                  diff: (fastEMA[last] - slowEMA[last]).toFixed(2)
                });
              }

              // Add new marker if signal detected
              if (newMarker && candlestickSeriesRef.current) {
                const currentMarkers = candlestickSeriesRef.current.markers() || [];
                const signalExists = currentMarkers.some(
                  (m: any) => m.time === newMarker.time && m.text === newMarker.text
                );
                
                if (!signalExists) {
                  candlestickSeriesRef.current.setMarkers([...currentMarkers, newMarker]);
                }
              }
            }
          }
        }
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