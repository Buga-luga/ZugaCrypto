export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

const API_KEY = process.env.NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY;
const BASE_URL = 'https://min-api.cryptocompare.com/data';

// Helper function to get the interval string for CryptoCompare API
function getIntervalString(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1m': return 'histominute';
    case '5m': return 'histominute';
    case '15m': return 'histominute';
    case '30m': return 'histominute';
    case '1h': return 'histohour';
    case '4h': return 'histohour';
    case '1d': return 'histoday';
    case '1w': return 'histoday';
    default: return 'histominute';
  }
}

// Helper function to get the limit based on timeframe
function getLimit(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m': return 1440; // 24 hours
    case '5m': return 288; // 24 hours
    case '15m': return 96; // 24 hours
    case '30m': return 48; // 24 hours
    case '1h': return 168; // 7 days
    case '4h': return 180; // 30 days
    case '1d': return 365; // 1 year
    case '1w': return 52; // 1 year
    default: return 1440;
  }
}

// Helper function to get the aggregate based on timeframe
function getAggregate(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m': return 1;
    case '5m': return 5;
    case '15m': return 15;
    case '30m': return 30;
    case '1h': return 1;
    case '4h': return 4;
    case '1d': return 1;
    case '1w': return 7;
    default: return 1;
  }
}

export async function getHistoricalData(timeframe: Timeframe, token: string = 'BTC', baseToken: string = 'USDT'): Promise<any[]> {
  try {
    const interval = getIntervalString(timeframe);
    const limit = getLimit(timeframe);
    const aggregate = getAggregate(timeframe);

    const response = await fetch(
      `${BASE_URL}/${interval}?fsym=${token}&tsym=${baseToken}&limit=${limit}&aggregate=${aggregate}&api_key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.Response === 'Error') {
      throw new Error(data.Message);
    }

    return data.Data.map((d: any) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volumefrom
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

export function subscribeToPrice(callback: (data: { time: number; value: number }) => void, timeframe: Timeframe, token: string = 'BTC', baseToken: string = 'USDT'): () => void {
  let isSubscribed = true;
  let pollInterval: NodeJS.Timeout | null = null;
  const POLL_INTERVAL = 2000; // Poll every 2 seconds

  const fetchLatestPrice = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/price?fsym=${token}&tsyms=${baseToken}&api_key=${API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.Response === 'Error') {
        throw new Error(data.Message);
      }

      const price = data[baseToken];
      if (price && !isNaN(price)) {
        const timestamp = Math.floor(Date.now() / 1000);
        console.log('Processing price update:', { time: timestamp, value: price });
        callback({ time: timestamp, value: price });
      }
    } catch (error) {
      console.error('Error fetching price:', error);
    }
  };

  // Start polling
  const startPolling = () => {
    // Fetch immediately
    fetchLatestPrice();

    // Then set up interval
    pollInterval = setInterval(() => {
      if (isSubscribed) {
        fetchLatestPrice();
      }
    }, POLL_INTERVAL);
  };

  // Start polling immediately
  startPolling();

  // Return cleanup function
  return () => {
    console.log('Cleaning up price subscription...');
    isSubscribed = false;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}

// Helper function to validate if a trading pair is supported
export async function isPairSupported(token: string, baseToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BASE_URL}/price?fsym=${token}&tsyms=${baseToken}&api_key=${API_KEY}`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return !data.Response || data.Response !== 'Error';
  } catch (error) {
    console.error('Error checking pair support:', error);
    return false;
  }
} 