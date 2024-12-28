'use client';
import { Dispatch, SetStateAction } from 'react';
import { Timeframe } from '@/services/api/cryptoCompareAPI';

interface TimeframeSelectorProps {
  timeframe: Timeframe;
  setTimeframe: Dispatch<SetStateAction<Timeframe>>;
}

export function TimeframeSelector({ timeframe, setTimeframe }: TimeframeSelectorProps) {
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  return (
    <div className="flex items-center space-x-1 bg-[#2B2B43] rounded-lg p-1">
      {timeframes.map((tf) => (
        <button
          key={tf}
          className={`px-4 py-2 rounded-md transition-colors duration-200 ${
            timeframe === tf
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-300 hover:bg-[#363853] hover:text-white'
          }`}
          onClick={() => setTimeframe(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}