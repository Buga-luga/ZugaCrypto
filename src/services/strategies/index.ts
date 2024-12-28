import { Time } from 'lightweight-charts';

export type StrategyId = 'none' | 'ema_crossover' | 'sma_crossover';

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
  indicators: Indicator[];
  analyze: (data: any[]) => StrategySignal | null;
}

class StrategyRegistry {
  private strategies: Map<StrategyId, Strategy> = new Map();

  registerStrategy(strategy: Strategy) {
    this.strategies.set(strategy.id, strategy);
  }

  getStrategy(id: StrategyId): Strategy | undefined {
    return this.strategies.get(id);
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }
}

const registry = new StrategyRegistry();

export function registerStrategy(strategy: Strategy) {
  registry.registerStrategy(strategy);
}

export function getStrategy(id: StrategyId): Strategy | undefined {
  return registry.getStrategy(id);
}

export function getAllStrategies(): Strategy[] {
  return registry.getAllStrategies();
} 