'use client';
import { useState } from 'react';
import { CandlestickChart } from '@/components/Chart/CandlestickChart';
import { TimeframeSelector } from '@/components/common/TimeframeSelector';
import { StrategySelector } from '@/components/common/StrategySelector';
import { Timeframe } from '@/services/api/cryptoCompareAPI';
import { StrategyId } from '@/services/strategies';
import '@/services/strategies/registry';

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [strategy, setStrategy] = useState<StrategyId>('none');

  return (
    <main className="flex flex-col h-screen bg-[#1E222D]">
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart timeframe={timeframe} strategy={strategy} />
      </div>
      <div className="p-4 border-t border-[#2B2B43] flex justify-between items-center">
        <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
        <StrategySelector selectedStrategy={strategy} onStrategyChange={setStrategy} />
      </div>
    </main>
  );
}