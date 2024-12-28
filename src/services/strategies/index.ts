import { CandlestickData } from 'lightweight-charts';

export interface StrategySignal {
  type: 'buy' | 'sell';
  price: number;
  time: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  analyze: (data: CandlestickData[]) => StrategySignal | null;
  indicators?: {
    name: string;
    data: any[];
  }[];
}

export type StrategyId = 'none' | 'sma_crossover' | 'ema_crossover' | 'rsi_divergence' | 'macd';

class StrategyRegistry {
  private static instance: StrategyRegistry;
  private strategies: Map<string, Strategy>;

  private constructor() {
    this.strategies = new Map();
  }

  public static getInstance(): StrategyRegistry {
    if (!StrategyRegistry.instance) {
      StrategyRegistry.instance = new StrategyRegistry();
    }
    return StrategyRegistry.instance;
  }

  public register(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public getAll(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  public get(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }
}

// Export singleton instance methods
export const registerStrategy = (strategy: Strategy) => StrategyRegistry.getInstance().register(strategy);
export const getStrategies = () => StrategyRegistry.getInstance().getAll();
export const getStrategy = (id: string) => StrategyRegistry.getInstance().get(id); 