import React, { useState } from 'react';

const exchanges = [
  { id: 'cryptocompare', name: 'CryptoCompare' },
  { id: 'binance', name: 'Binance' },
  { id: 'coinbase', name: 'Coinbase' },
] as const;

const tradingPairs = [
  { token: 'BTC', baseToken: 'USDT' },
  { token: 'ETH', baseToken: 'USDT' },
  { token: 'SOL', baseToken: 'USDT' },
  { token: 'BTC', baseToken: 'USD' },
  { token: 'ETH', baseToken: 'USD' },
] as const;

interface TickerHeaderProps {
  token?: string;
  baseToken?: string;
  exchange?: typeof exchanges[number]['id'];
  onExchangeChange?: (exchange: typeof exchanges[number]['id']) => void;
  onPairChange: (token: string, baseToken: string) => void;
}

export function TickerHeader({ 
  token = 'BTC', 
  baseToken = 'USDT', 
  exchange = 'cryptocompare',
  onExchangeChange = () => {}, 
  onPairChange 
}: TickerHeaderProps) {
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);

  return (
    <div className="flex items-center gap-2 p-2 bg-[#1E222D] text-white border-b border-[#2B2B43]">
      <div className="flex items-center gap-2">
        {/* Trading Pair Selector */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 px-2 py-1 text-xl font-semibold hover:bg-[#2B2B43] rounded transition-colors"
            onClick={() => setShowPairSelector(!showPairSelector)}
          >
            <span>{token}/{baseToken}</span>
            <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Trading Pair Dropdown */}
          {showPairSelector && (
            <div className="absolute z-50 w-[200px] mt-1 bg-[#2B2B43] rounded shadow-lg">
              <div className="p-2">
                <input
                  type="text"
                  placeholder="Search pair..."
                  className="w-full px-2 py-1 text-sm bg-[#363A45] rounded border border-[#4A4D57] focus:outline-none focus:border-[#5A5D67]"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {tradingPairs.map((pair) => (
                  <button
                    key={`${pair.token}/${pair.baseToken}`}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-[#363A45] transition-colors flex items-center justify-between"
                    onClick={() => {
                      onPairChange(pair.token, pair.baseToken);
                      setShowPairSelector(false);
                    }}
                  >
                    <span>{pair.token}/{pair.baseToken}</span>
                    {pair.token === token && pair.baseToken === baseToken && (
                      <span className="text-[#26a69a]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Data Source Selector */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-[#363A45] bg-[#2B2B43] rounded transition-colors"
            onClick={() => setShowExchangeSelector(!showExchangeSelector)}
          >
            <span>{exchanges.find(e => e.id === exchange)?.name}</span>
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Exchange Dropdown */}
          {showExchangeSelector && (
            <div className="absolute z-50 w-full min-w-[120px] mt-1 bg-[#2B2B43] rounded shadow-lg">
              {exchanges.map((e) => (
                <button
                  key={e.id}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#363A45] transition-colors flex items-center justify-between"
                  onClick={() => {
                    onExchangeChange(e.id);
                    setShowExchangeSelector(false);
                  }}
                >
                  <span>{e.name}</span>
                  {e.id === exchange && (
                    <span className="text-[#26a69a]">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Current Price */}
      <div className="ml-4">
        <span className="text-lg font-medium" id="current-price">
          Loading...
        </span>
      </div>
      
      {/* 24h Change */}
      <div className="ml-4 text-sm">
        <span className="text-neutral-400">24h Change</span>
        <span className="ml-2" id="price-change">—</span>
      </div>
      
      {/* 24h High */}
      <div className="ml-4 text-sm">
        <span className="text-neutral-400">24h High</span>
        <span className="ml-2" id="24h-high">—</span>
      </div>
      
      {/* 24h Low */}
      <div className="ml-4 text-sm">
        <span className="text-neutral-400">24h Low</span>
        <span className="ml-2" id="24h-low">—</span>
      </div>
    </div>
  );
} 