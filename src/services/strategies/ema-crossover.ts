import { CandlestickData } from 'lightweight-charts';
import { Strategy, StrategySignal, registerStrategy } from './index';

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

// Create the strategy object
const emaCrossoverStrategy: Strategy = {
  id: 'ema_crossover',
  name: 'EMA Crossover',
  description: 'Generates signals based on crossovers between fast and slow EMAs',
  analyze: (data: CandlestickData[]) => {
    const prices = data.map(d => d.close);
    const fastPeriod = 9;  // Fast EMA period
    const slowPeriod = 21; // Slow EMA period

    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    // Need at least two points to compare crossover
    if (fastEMA.length < 2 || slowEMA.length < 2) return null;

    const last = fastEMA.length - 1;
    const prev = last - 1;

    // Check for crossover
    const isCrossUp = fastEMA[prev] <= slowEMA[prev] && fastEMA[last] > slowEMA[last];
    const isCrossDown = fastEMA[prev] >= slowEMA[prev] && fastEMA[last] < slowEMA[last];

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
      name: 'Fast EMA (9)',
      data: [], // Will be populated when strategy runs
    },
    {
      name: 'Slow EMA (21)',
      data: [], // Will be populated when strategy runs
    },
  ],
};

// Register the strategy
registerStrategy(emaCrossoverStrategy);

// Export the strategy object
export default emaCrossoverStrategy; 