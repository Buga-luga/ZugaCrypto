import { Strategy, StrategySignal, registerStrategy } from './index';
import { Time, BusinessDay } from 'lightweight-charts';

// Calculate Simple Moving Average (SMA)
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  
  // Fill initial values with NaN until we have enough data
  for (let i = 0; i < period - 1; i++) {
    sma.push(NaN);
  }

  // Calculate SMA for each point after the initial period
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    sma.push(sum / period);
  }

  return sma;
}

// Convert any time format to Unix timestamp
function getUnixTime(time: Time): number {
  if (typeof time === 'number') {
    return time;
  }
  if (typeof time === 'string') {
    return Math.floor(new Date(time).getTime() / 1000);
  }
  // Handle BusinessDay format
  const { year, month, day } = time as BusinessDay;
  return Math.floor(new Date(year, month - 1, day).getTime() / 1000);
}

export const smaCrossoverStrategy: Strategy = {
  id: 'sma_crossover',
  name: 'SMA Crossover',
  description: 'Fast SMA (9) crossing Slow SMA (21)',
  indicators: [
    {
      name: 'Fast SMA (9)',
      data: []
    },
    {
      name: 'Slow SMA (21)',
      data: []
    }
  ],
  analyze: (data) => {
    const prices = data.map(d => d.close);
    const fastSMA = calculateSMA(prices, 9);
    const slowSMA = calculateSMA(prices, 21);

    // Need at least two points to detect a crossover
    if (fastSMA.length < 2) return null;

    const last = fastSMA.length - 1;
    const prev = last - 1;

    // Check for crossovers
    if (!isNaN(fastSMA[prev]) && !isNaN(slowSMA[prev]) && 
        !isNaN(fastSMA[last]) && !isNaN(slowSMA[last])) {
      
      // Buy signal: Fast SMA crosses above Slow SMA
      if (fastSMA[prev] <= slowSMA[prev] && fastSMA[last] > slowSMA[last]) {
        return {
          type: 'buy',
          price: data[last].close,
          time: getUnixTime(data[last].time),
          message: `Buy Signal: Fast SMA (${fastSMA[last].toFixed(2)}) crossed above Slow SMA (${slowSMA[last].toFixed(2)})`
        };
      }
      
      // Sell signal: Fast SMA crosses below Slow SMA
      if (fastSMA[prev] >= slowSMA[prev] && fastSMA[last] < slowSMA[last]) {
        return {
          type: 'sell',
          price: data[last].close,
          time: getUnixTime(data[last].time),
          message: `Sell Signal: Fast SMA (${fastSMA[last].toFixed(2)}) crossed below Slow SMA (${slowSMA[last].toFixed(2)})`
        };
      }
    }

    return null;
  }
};

// Register the strategy
registerStrategy(smaCrossoverStrategy); 