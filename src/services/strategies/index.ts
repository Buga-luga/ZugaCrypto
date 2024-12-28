import { Strategy } from './types';
import { EMAStrategy } from './ema';

export const strategies: Strategy[] = [
  EMAStrategy,
];

export const getStrategy = (name: string): Strategy | undefined => {
  return strategies.find(s => s.name === name);
};

export * from './types'; 