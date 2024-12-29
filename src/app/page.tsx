'use client';
import { useState } from 'react';
import { CandlestickChart } from '@/components/Chart/CandlestickChart';
import { TimeframeSelector } from '@/components/Common/TimeframeSelector';
import { StrategySelector } from '@/components/Common/StrategySelector';
import { StrategyId } from '@/services/strategies';
import { Timeframe } from '@/services/api/cryptoCompareAPI';
import '@/services/strategies/registry';

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [strategy, setStrategy] = useState<StrategyId>('none');
  const [token, setToken] = useState<string>('BTC');
  const [baseToken, setBaseToken] = useState<string>('USDT');
  const [exchange] = useState<'cryptocompare'>('cryptocompare');

  const handlePairChange = (newToken: string, newBaseToken: string) => {
    setToken(newToken);
    setBaseToken(newBaseToken);
  };

  return (
    <main className="flex flex-col h-screen bg-[#1E222D]">
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart 
          timeframe={timeframe} 
          strategy={strategy}
          token={token}
          baseToken={baseToken}
          exchange={exchange}
          onPairChange={handlePairChange}
        />
      </div>
      <div className="p-4 border-t border-[#2B2B43] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
          <StrategySelector value={strategy} onChange={setStrategy} />
        </div>
      </div>
    </main>
  );
}