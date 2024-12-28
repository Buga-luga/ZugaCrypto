'use client';
import { TimeframeSelector } from '@/components/common/TimeframeSelector';
import { StrategySelector } from '@/components/common/StrategySelector';
import { Dispatch, SetStateAction } from 'react';

interface ChartControlsProps {
  timeframe: string;
  setTimeframe: Dispatch<SetStateAction<string>>;
}

export function ChartControls({ timeframe, setTimeframe }: ChartControlsProps) {
  return (
    <div className="flex gap-4 p-4 bg-[#1E222D] border-t border-[#2B2B43]">
      <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
      <StrategySelector />
    </div>
  );
}