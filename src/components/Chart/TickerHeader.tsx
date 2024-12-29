import React, { useState, useCallback } from 'react';

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

interface TickerHeaderProps {
  token?: string;
  baseToken?: string;
  exchange?: string;
  onExchangeChange?: (exchange: string) => void;
  onPairChange: (token: string, baseToken: string) => void;
}

export function TickerHeader({ 
  token = 'BTC', 
  baseToken = 'USDT', 
  exchange = 'CryptoCompare',
  onExchangeChange = () => {}, 
  onPairChange 
}: TickerHeaderProps) {
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPairs = filterPairs(tradingPairs, searchTerm);

  // Function to get appropriate decimal places based on base token
  const getDecimalPlaces = (baseToken: string): number => {
    if (baseToken.toUpperCase() === 'BTC') return 8;
    return 2;
  };

  // Function to format price based on base token
  const formatPrice = (price: string | number, baseToken: string): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (baseToken === 'BTC') {
      return numPrice.toFixed(8);  // Show 8 decimal places for BTC pairs (e.g., ADA/BTC)
    }
    return numPrice.toFixed(2);    // Show 2 decimal places for other pairs (e.g., ADA/USDT)
  };

  // Function to update price stats
  const updatePriceStats = useCallback((data: any[]) => {
    if (data.length < 2) return;

    const last24h = data.slice(-24); // Assuming hourly data
    const currentPrice = last24h[last24h.length - 1].close;
    const openPrice = last24h[0].open;
    const high24h = Math.max(...last24h.map(d => d.high));
    const low24h = Math.min(...last24h.map(d => d.low));
    
    const priceChange = ((currentPrice - openPrice) / openPrice) * 100;
    const changeColor = priceChange >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]';

    // Update DOM elements with correct decimal places
    const priceElement = document.getElementById('current-price');
    const changeElement = document.getElementById('price-change');
    const highElement = document.getElementById('24h-high');
    const lowElement = document.getElementById('24h-low');

    if (priceElement) priceElement.textContent = formatPrice(currentPrice, baseToken);
    if (changeElement) changeElement.innerHTML = `<span class="${changeColor}">${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%</span>`;
    if (highElement) highElement.textContent = formatPrice(high24h, baseToken);
    if (lowElement) lowElement.textContent = formatPrice(low24h, baseToken);
  }, [baseToken]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1E222D] text-white border-b border-[#2B2B43]">
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
          <span id="current-price" className="text-lg font-semibold">Loading...</span>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div>
            <span className="text-gray-400">24h Change</span>
            <div id="price-change">—</div>
          </div>
          <div>
            <span className="text-gray-400">24h High</span>
            <div id="24h-high">—</div>
          </div>
          <div>
            <span className="text-gray-400">24h Low</span>
            <div id="24h-low">—</div>
          </div>
        </div>
      </div>
    </div>
  );
} 