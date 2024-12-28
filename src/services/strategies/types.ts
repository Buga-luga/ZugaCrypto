import { UTCTimestamp } from 'lightweight-charts';

export interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface StrategyResult {
  time: UTCTimestamp;
  value: number;
}

export interface Strategy {
  name: string;
  label: string;
  color: string;
  calculate: (data: Candle[]) => StrategyResult[];
} 