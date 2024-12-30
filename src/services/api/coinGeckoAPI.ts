const API_KEY = process.env.COINGECKO_API_KEY;
const BASE_URL = 'https://api.coingecko.com/api/v3';

interface CoinGeckoResponse {
  prices: [number, number][];
}

function isCoinGeckoResponse(data: any): data is CoinGeckoResponse {
  return data && Array.isArray(data.prices) && data.prices.every((d: any) => Array.isArray(d) && d.length === 2);
}

export async function getHistoricalData(timeframe: string, token: string = 'bitcoin', baseToken: string = 'usd'): Promise<any[]> {
  try {
    const response = await fetch(`${BASE_URL}/coins/${token}/market_chart?vs_currency=${baseToken}&days=${timeframe}&api_key=${API_KEY}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!isCoinGeckoResponse(data)) {
      throw new Error('Invalid data format received from CoinGecko API');
    }

    return data.prices.map((d, index) => ({
      time: d[0],
      open: index === 0 ? d[1] : data.prices[index - 1][1],
      high: d[1],
      low: d[1],
      close: d[1],
      volume: 0 // Placeholder for volume as CoinGecko does not provide it in this endpoint
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

function isStringArray(data: any): data is string[] {
  return Array.isArray(data) && data.every(item => typeof item === 'string');
}

export async function getSupportedPairs(): Promise<{ token: string; baseToken: string }[]> {
  try {
    const response = await fetch(`${BASE_URL}/simple/supported_vs_currencies`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!isStringArray(data)) {
      throw new Error('Invalid data format received from CoinGecko API');
    }

    const supportedCurrencies: string[] = data;

    const existingPairs = [
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
    ];

    return existingPairs.filter(pair =>
      supportedCurrencies.includes(pair.baseToken.toLowerCase())
    );
  } catch (error) {
    console.error('Error fetching supported pairs:', error);
    return [];
  }
} 