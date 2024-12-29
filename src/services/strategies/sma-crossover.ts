import { Strategy, StrategySignal } from './index';
import { calculateSMA } from './moving-averages';

function detectCrosses(fastSMA: number[], slowSMA: number[], prices: number[]): StrategySignal[] {
  const signals: StrategySignal[] = [];

  for (let i = 1; i < fastSMA.length; i++) {
    if (fastSMA[i - 1] < slowSMA[i - 1] && fastSMA[i] > slowSMA[i]) {
      signals.push({
        type: 'buy',
        price: prices[i],
        time: i,
        message: 'Buy signal: Fast SMA crossed above Slow SMA',
      });
    } else if (fastSMA[i - 1] > slowSMA[i - 1] && fastSMA[i] < slowSMA[i]) {
      signals.push({
        type: 'sell',
        price: prices[i],
        time: i,
        message: 'Sell signal: Fast SMA crossed below Slow SMA',
      });
    }
  }

  return signals;
}

const smaCrossoverStrategy: Strategy = {
  id: 'sma_crossover',
  name: 'SMA Crossover (9/21)',
  description: 'Fast SMA (9) crosses Slow SMA (21)',
  indicators: [
    { name: 'Fast MA' },
    { name: 'Slow MA' },
  ],
};

export default smaCrossoverStrategy; 