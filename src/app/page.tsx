'use client';
import { useState } from 'react';
import { CandlestickChart } from '@/components/Chart/CandlestickChart';
import { TimeframeSelector } from '@/components/common/TimeframeSelector';

export default function Home() {
  const [timeframe, setTimeframe] = useState('1m');
  return (
    <main className="flex flex-col h-screen bg-[#1E222D]">
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart timeframe={timeframe} />
      </div>
      <div className="p-4 border-t border-[#2B2B43]">
        <TimeframeSelector timeframe={timeframe} setTimeframe={setTimeframe} />
      </div>
    </main>
  );
}