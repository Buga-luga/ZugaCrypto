import { CandlestickData } from 'lightweight-charts';
import { Strategy, StrategySignal, registerStrategy } from './index';

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    sma.push(sum / period);
  }
  return sma;
}

// Create the strategy object
const smaCrossoverStrategy: Strategy = {
  id: 'sma_crossover',
  name: 'SMA Crossover',
  description: 'Generates signals based on crossovers between short-term and long-term SMAs',
  analyze: (data: CandlestickData[]) => {
    const prices = data.map(d => d.close);
    const shortPeriod = 10;
    const longPeriod = 20;

    const shortSMA = calculateSMA(prices, shortPeriod);
    const longSMA = calculateSMA(prices, longPeriod);

    // Need at least two points to compare crossover
    if (shortSMA.length < 2 || longSMA.length < 2) return null;

    const last = shortSMA.length - 1;
    const prev = last - 1;

    // Check for crossover
    const isCrossUp = shortSMA[prev] <= longSMA[prev] && shortSMA[last] > longSMA[last];
    const isCrossDown = shortSMA[prev] >= longSMA[prev] && shortSMA[last] < longSMA[last];

    if (isCrossUp) {
      return {
        type: 'buy',
        price: data[last].close,
        time: data[last].time as number,
      };
    }

    if (isCrossDown) {
      return {
        type: 'sell',
        price: data[last].close,
        time: data[last].time as number,
      };
    }

    return null;
  },
  indicators: [
    {
      name: 'Short SMA',
      data: [], // This will be populated when the strategy runs
    },
    {
      name: 'Long SMA',
      data: [], // This will be populated when the strategy runs
    },
  ],
};

// Register the strategy
registerStrategy(smaCrossoverStrategy);

// Export the strategy object
export default smaCrossoverStrategy; 