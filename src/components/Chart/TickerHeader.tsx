import React, { useState, useCallback, useEffect } from 'react';
import { formatPrice } from '@/utils/priceFormat';
import { isBTCPair, DEFAULT_BTC_FORMAT, DEFAULT_USDT_FORMAT } from '@/utils/priceFormat';

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const exchanges = ['CryptoCompare'] as const;

const tradingPairs = [
  // USDT Pairs
  { token: 'BTC', baseToken: 'USDT' },
  { token: 'ETH', baseToken: 'USDT' },
  { token: 'BNB', baseToken: 'USDT' },
  { token: 'SOL', baseToken: 'USDT' },
  { token: 'XRP', baseToken: 'USDT' },
  { token: 'ADA', baseToken: 'USDT' },
  { token: 'DOGE', baseToken: 'USDT' },
  { token: 'MATIC', baseToken: 'USDT' },
  { token: 'DOT', baseToken: 'USDT' },
  { token: 'LTC', baseToken: 'USDT' },
  { token: 'AVAX', baseToken: 'USDT' },
  { token: 'LINK', baseToken: 'USDT' },
  { token: 'UNI', baseToken: 'USDT' },
  { token: 'SHIB', baseToken: 'USDT' },
  
  // BTC Pairs
  { token: 'ETH', baseToken: 'BTC' },
  { token: 'BNB', baseToken: 'BTC' },
  { token: 'SOL', baseToken: 'BTC' },
  { token: 'XRP', baseToken: 'BTC' },
  { token: 'ADA', baseToken: 'BTC' },
  { token: 'DOGE', baseToken: 'BTC' },
  { token: 'MATIC', baseToken: 'BTC' },
  { token: 'DOT', baseToken: 'BTC' },
  { token: 'LTC', baseToken: 'BTC' },
  { token: 'AVAX', baseToken: 'BTC' },
  { token: 'LINK', baseToken: 'BTC' },
  { token: 'UNI', baseToken: 'BTC' }
] as const;

// Add search functionality
function filterPairs(pairs: typeof tradingPairs, searchTerm: string) {
  if (!searchTerm) return pairs;
  const term = searchTerm.toLowerCase();
  return pairs.filter(pair => 
    `${pair.token}/${pair.baseToken}`.toLowerCase().includes(term)
  );
}

interface PriceFormat {
  type: 'price';
  precision: number;
  minMove: number;
  format: (price: number) => string;
}

interface TickerHeaderProps {
  token?: string;
  baseToken?: string;
  exchange?: string;
  currentPrice: string;
  priceStats: {
    change1h: string;
    change24h: string;
    change7d: string;
    high24h: string;
    low24h: string;
  };
  onExchangeChange?: (exchange: string) => void;
  onPairChange: (token: string, baseToken: string) => void;
  isLoading?: boolean;
}

export function TickerHeader({ 
  token = 'BTC', 
  baseToken = 'USDT', 
  exchange = 'CryptoCompare',
  currentPrice,
  priceStats,
  onExchangeChange = () => {}, 
  onPairChange,
  isLoading = false
}: TickerHeaderProps) {
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPairs = filterPairs(tradingPairs, searchTerm);

  // Simply use the provided values, don't try to format them
  const displayPrice = currentPrice || '0.00';
  const displayStats = priceStats || {
    high24h: '0.00',
    low24h: '0.00',
    change1h: '0.00',
    change24h: '0.00',
    change7d: '0.00'
  };

  const getChangeColor = (value: string) => {
    return value.startsWith('-') ? 'text-red-500' : 'text-green-500';
  };

  return (
    <div className="flex items-center justify-between p-4 bg-[#1E222D] border-b border-[#2B2B43]">
      {isLoading && (
        <div className="absolute inset-0 bg-[#1E222D] bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            onClick={() => setShowPairSelector(!showPairSelector)}
            className="flex items-center space-x-2 text-lg font-semibold hover:text-gray-300"
          >
            <span>{`${token}/${baseToken}`}</span>
            <ChevronDownIcon />
          </button>
          {showPairSelector && (
            <div className="absolute z-10 w-64 mt-2 bg-[#1E222D] border border-[#2B2B43] rounded-lg shadow-lg">
              <input
                type="text"
                placeholder="Search pairs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-[#2B2B43] text-white border-b border-[#2B2B43] rounded-t-lg focus:outline-none"
              />
              <div className="max-h-96 overflow-y-auto">
                {filteredPairs.map((pair) => (
                  <button
                    key={`${pair.token}/${pair.baseToken}`}
                    onClick={() => {
                      onPairChange(pair.token, pair.baseToken);
                      setShowPairSelector(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-[#2B2B43] focus:outline-none"
                  >
                    {`${pair.token}/${pair.baseToken}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExchangeSelector(!showExchangeSelector)}
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300"
          >
            <span>{exchange}</span>
            <ChevronDownIcon />
          </button>
          {showExchangeSelector && (
            <div className="absolute z-10 w-48 mt-2 bg-[#1E222D] border border-[#2B2B43] rounded-lg shadow-lg">
              {exchanges.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    onExchangeChange(ex);
                    setShowExchangeSelector(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-[#2B2B43] focus:outline-none flex items-center justify-between"
                >
                  <span>{ex}</span>
                  {ex === exchange && <CheckIcon />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-6">
        <div>
          <span className="text-gray-400 text-sm">Price</span>
          <div className="text-lg font-semibold">{displayPrice}</div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div>
            <span className="text-gray-400">1h</span>
            <div className={getChangeColor(displayStats.change1h)}>
              {displayStats.change1h}%
            </div>
          </div>
          <div>
            <span className="text-gray-400">24h</span>
            <div className={getChangeColor(displayStats.change24h)}>
              {displayStats.change24h}%
            </div>
          </div>
          <div>
            <span className="text-gray-400">7D</span>
            <div className={getChangeColor(displayStats.change7d)}>
              {displayStats.change7d}%
            </div>
          </div>
          <div>
            <span className="text-gray-400">24h High</span>
            <div>{displayStats.high24h}</div>
          </div>
          <div>
            <span className="text-gray-400">24h Low</span>
            <div>{displayStats.low24h}</div>
          </div>
        </div>
      </div>
    </div>
  );
} 