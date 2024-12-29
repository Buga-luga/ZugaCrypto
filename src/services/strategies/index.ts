import { Time } from 'lightweight-charts';

export type StrategyId = 
  | 'none'
  | 'ema_crossover'
  | 'sma_crossover'
  | 'tema_crossover'
  | 'golden_cross'
  | 'hull_crossover'
  | 'ema_5_13';

export interface StrategySignal {
  type: 'buy' | 'sell';
  price: number;
  time: number;
  message: string;
}

export interface Indicator {
  name: string;
  data: Array<{
    time: Time;
    value: number;
  }>;
}

export interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  indicators: { name: string }[];
}

const strategies: Record<StrategyId, Strategy> = {
  none: {
    id: 'none',
    name: 'None',
    description: 'No strategy selected',
    indicators: [],
  },
  ema_crossover: {
    id: 'ema_crossover',
    name: 'EMA Crossover (9/21)',
    description: 'Fast EMA (9) crosses Slow EMA (21)',
    indicators: [
      { name: 'Fast MA' },
      { name: 'Slow MA' },
    ],
  },
  sma_crossover: {
    id: 'sma_crossover',
    name: 'SMA Crossover (9/21)',
    description: 'Fast SMA (9) crosses Slow SMA (21)',
    indicators: [
      { name: 'Fast MA' },
      { name: 'Slow MA' },
    ],
  },
  tema_crossover: {
    id: 'tema_crossover',
    name: 'Triple EMA Crossover',
    description: 'Triple EMA fast (7) crosses Triple EMA slow (21)',
    indicators: [
      { name: 'Fast TEMA' },
      { name: 'Slow TEMA' },
    ],
  },
  golden_cross: {
    id: 'golden_cross',
    name: 'Golden/Death Cross',
    description: 'SMA 50 crosses SMA 200 (longer term trend changes)',
    indicators: [
      { name: 'SMA 50' },
      { name: 'SMA 200' },
    ],
  },
  hull_crossover: {
    id: 'hull_crossover',
    name: 'Hull MA Crossover',
    description: 'Fast Hull MA (9) crosses Slow Hull MA (21)',
    indicators: [
      { name: 'Fast HMA' },
      { name: 'Slow HMA' },
    ],
  },
  ema_5_13: {
    id: 'ema_5_13',
    name: 'EMA 5/13 Crossover',
    description: 'Short-term EMA (5) crosses EMA (13)',
    indicators: [
      { name: 'EMA 5' },
      { name: 'EMA 13' },
    ],
  },
};

export const getStrategy = (id: StrategyId): Strategy | undefined => {
  return strategies[id];
};

export const getAllStrategies = (): Strategy[] => {
  return Object.values(strategies);
}; 