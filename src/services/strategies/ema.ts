import { Strategy, Candle, StrategyResult } from './types';

export const EMAStrategy: Strategy = {
  name: 'ema',
  label: 'EMA (20)',
  color: '#2962FF',
  calculate: (data: Candle[]): StrategyResult[] => {
    const period = 20;
    const multiplier = 2 / (period + 1);
    const results: StrategyResult[] = [];
    
    if (data.length === 0) return results;
    
    let ema = data[0].close;
    results.push({
      time: data[0].time,
      value: ema
    });

    for (let i = 1; i < data.length; i++) {
      const candle = data[i];
      ema = (candle.close - ema) * multiplier + ema;
      results.push({
        time: candle.time,
        value: ema
      });
    }

    return results;
  }
}; 