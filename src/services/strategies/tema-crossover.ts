import { Strategy } from './index';
import { calculateTEMA } from './moving-averages';

const temaCrossoverStrategy: Strategy = {
  id: 'tema_crossover',
  name: 'Triple EMA Crossover',
  description: 'Triple EMA fast (7) crosses Triple EMA slow (21)',
  indicators: [
    { name: 'Fast TEMA' },
    { name: 'Slow TEMA' },
  ],
};

export default temaCrossoverStrategy; 