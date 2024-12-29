import { Strategy } from './index';
import { calculateSMA } from './moving-averages';

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