import { Strategy } from './index';
import { calculateEMA } from './moving-averages';

const emaCrossoverStrategy: Strategy = {
  id: 'ema_crossover',
  name: 'EMA Crossover (9/21)',
  description: 'Fast EMA (9) crosses Slow EMA (21)',
  indicators: [
    { name: 'Fast MA' },
    { name: 'Slow MA' },
  ],
};

export default emaCrossoverStrategy; 