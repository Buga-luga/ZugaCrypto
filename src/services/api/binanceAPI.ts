import { Time } from 'lightweight-charts';

interface KlineData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const timeframeToInterval: { [key: string]: string } = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

export async function fetchKlines(timeframe: string, limit: number = 1000): Promise<KlineData[]> {
  const interval = timeframeToInterval[timeframe];
  const symbol = 'BTCUSDT';
  
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.map((kline: any) => ({
      time: (kline[0] / 1000) as Time,
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));
  } catch (error) {
    console.error('Error fetching kline data:', error);
    throw error;
  }
}

export function setupWebSocket(
  timeframe: string,
  onKlineUpdate: (kline: KlineData) => void
): WebSocket {
  const ws = new WebSocket('wss://streamer.cryptocompare.com/v2?api_key=your_api_key_here');
  
  ws.onopen = () => {
    console.log('CryptoCompare WebSocket connected');
    // Subscribe to BTC-USD ticker
    const subRequest = {
      action: 'SubAdd',
      subs: ['0~Coinbase~BTC~USD']  // Using Coinbase as source
    };
    ws.send(JSON.stringify(subRequest));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Handle CryptoCompare ticker updates
    if (data.TYPE === '0') {  // '0' is for ticker data
      const price = parseFloat(data.PRICE);
      if (!isNaN(price)) {
        onKlineUpdate({
          time: (Date.now() / 1000) as Time,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: parseFloat(data.VOLUME24HOUR || '0')
        });
      }
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };
  
  return ws;
}