'use client';
import { useState } from 'react';
import { CandlestickChart } from '@/components/Chart/CandlestickChart';
import { TimeframeSelector } from '@/components/Common/TimeframeSelector';
import { StrategySelector } from '@/components/Common/StrategySelector';
import { DataSourcesStatus } from '@/components/Status/DataSourcesStatus';
import { StrategyId } from '@/services/strategies';
import { Timeframe } from '@/services/api/cryptoCompareAPI';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import '@/services/strategies/registry';

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [strategy, setStrategy] = useState<StrategyId>('none');
  const [token, setToken] = useState<string>('BTC');
  const [baseToken, setBaseToken] = useState<string>('USDT');
  const [exchange] = useState<'CryptoCompare'>('CryptoCompare');
  const [showDataSources, setShowDataSources] = useState(false);

  const handlePairChange = (newToken: string, newBaseToken: string) => {
    setToken(newToken);
    setBaseToken(newBaseToken);
  };

  return (
    <main className="flex flex-col h-screen bg-[#1E222D]">
      <div className="flex justify-end p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDataSources(!showDataSources)}
          className="flex items-center gap-2 bg-[#2B2B43] hover:bg-[#363853]"
        >
          <Database className="h-4 w-4" />
          Data Sources
        </Button>
      </div>
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
      {showDataSources && (
        <div className="absolute right-4 top-14 z-50">
          <DataSourcesStatus />
        </div>
      )}
      <div className="p-4 border-t border-[#2B2B43] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
          <StrategySelector value={strategy} onChange={setStrategy} />
        </div>
      </div>
    </main>
  );
}