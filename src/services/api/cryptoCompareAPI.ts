import { Time, UTCTimestamp } from 'lightweight-charts';

// WARNING: This is the production Bitcoin price feed implementation.
// This file contains critical real-time data functionality.
// DO NOT modify this implementation or replace it with sample data.
// The WebSocket connection and historical data fetching are working correctly.

interface PriceData {
  time: UTCTimestamp;
  value: number;
}

interface TradeData {
  time: UTCTimestamp;
  price: number;
  volume24h: number;
}

export type TimeframeConfig = {
  endpoint: string;
  limit: number;
  interval: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

const TIMEFRAME_CONFIG: Record<Timeframe, TimeframeConfig> = {
  '1m': { endpoint: 'histominute', limit: 1440, interval: 60 },
  '5m': { endpoint: 'histominute', limit: 1440, interval: 300 },
  '15m': { endpoint: 'histominute', limit: 1440, interval: 900 },
  '30m': { endpoint: 'histominute', limit: 1440, interval: 1800 },
  '1h': { endpoint: 'histohour', limit: 720, interval: 3600 },
  '4h': { endpoint: 'histohour', limit: 720, interval: 14400 },
  '1d': { endpoint: 'histoday', limit: 365, interval: 86400 },
  '1w': { endpoint: 'histoday', limit: 365, interval: 604800 }
};

let socket: WebSocket | null = null;
let priceUpdateCallbacks: ((data: PriceData) => void)[] = [];
let tradeUpdateCallbacks: ((data: TradeData) => void)[] = [];
let pendingSubscription = false;
let lastPrice = 0;
let reconnectAttempts = 0;
let currentTimeframe: Timeframe = '1m';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

// Fallback to REST API when WebSocket fails
async function fetchPriceUpdate() {
  try {
    const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD');
    const data = await response.json();
    const price = data.USD;
    const timestamp = Math.floor(Date.now() / 1000) as UTCTimestamp;

    if (price && !isNaN(price) && price !== lastPrice) {
      lastPrice = price;
      priceUpdateCallbacks.forEach(callback => callback({
        time: timestamp,
        value: price
      }));
    }
  } catch (error) {
    console.error('Error fetching price via REST:', error);
  }
}

function sendSubscription(ws: WebSocket) {
  const subscribeMsg = {
    "action": "SubAdd",
    "subs": [
      "5~CCCAGG~BTC~USD",       // Aggregate index (most frequent)
      "2~Coinbase~BTC~USD",     // Coinbase ticker
      "11~BTC~USD"              // Direct price feed
    ]
  };
  
  try {
    ws.send(JSON.stringify(subscribeMsg));
    console.log('Subscribed to price feeds');
    pendingSubscription = false;
  } catch (error) {
    console.error('Error sending subscription:', error);
    pendingSubscription = true;
  }
}

// Update the WebSocket message handler to respect timeframes
function handlePriceUpdate(price: number, timestamp: UTCTimestamp, timeframe: Timeframe) {
  const config = TIMEFRAME_CONFIG[timeframe];
  const interval = config.interval;
  
  // Align timestamp to the current timeframe interval
  const alignedTimestamp = Math.floor(timestamp / interval) * interval as UTCTimestamp;
  
  if (price && !isNaN(price) && price !== lastPrice) {
    lastPrice = price;
    
    priceUpdateCallbacks.forEach(callback => callback({
      time: alignedTimestamp,
      value: price
    }));

    if (tradeUpdateCallbacks.length > 0) {
      tradeUpdateCallbacks.forEach(callback => callback({
        time: alignedTimestamp,
        price: price,
        volume24h: 0 // Volume will be updated separately
      }));
    }
  }
}

function connectWebSocket() {
  if (socket?.readyState === WebSocket.OPEN) {
    if (pendingSubscription) {
      sendSubscription(socket);
    }
    return;
  }

  // Don't try to reconnect too many times
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('Max reconnection attempts reached, falling back to REST API');
    // Set up periodic REST API polling as fallback
    const pollInterval = setInterval(fetchPriceUpdate, 5000);
    return;
  }

  try {
    // Close existing socket if any
    if (socket) {
      socket.close();
      socket = null;
    }

    socket = new WebSocket('wss://streamer.cryptocompare.com/v2');

    socket.onopen = () => {
      console.log('Connected to CryptoCompare WebSocket');
      reconnectAttempts = 0; // Reset attempts on successful connection
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendSubscription(socket);
      } else {
        pendingSubscription = true;
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.TYPE === "20" && data.MESSAGE === "SUBSCRIBECOMPLETE") {
          console.log('Successfully subscribed to feeds');
          return;
        }

        const timestamp = Math.floor(Date.now() / 1000) as UTCTimestamp;
        let price: number | null = null;

        if (data.TYPE === "11" || data.TYPE === "2" || data.TYPE === "5") {
          price = parseFloat(data.PRICE);
          if (price && !isNaN(price)) {
            handlePriceUpdate(price, timestamp, currentTimeframe);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      reconnectAttempts++;
      reconnect();
    };

    socket.onclose = (event) => {
      console.log(`WebSocket closed with code ${event.code}, reason: ${event.reason}`);
      reconnect();
    };

    // Ping every 15 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ "action": "PING" }));
        } catch (error) {
          console.error('Error sending ping:', error);
          reconnect();
        }
      }
    }, 15000);

    // Clean up ping interval on socket close
    socket.addEventListener('close', () => clearInterval(pingInterval));

  } catch (error) {
    console.error('Error creating WebSocket:', error);
    reconnectAttempts++;
    setTimeout(connectWebSocket, RECONNECT_DELAY);
  }
}

function reconnect() {
  if (socket) {
    try {
      socket.close();
    } catch (error) {
      console.error('Error closing socket:', error);
    }
    socket = null;
  }
  setTimeout(connectWebSocket, RECONNECT_DELAY * Math.min(reconnectAttempts, 5));
}

export function subscribeToPrice(callback: (data: PriceData) => void, timeframe: Timeframe = '1m') {
  currentTimeframe = timeframe;
  priceUpdateCallbacks.push(callback);
  
  // Immediately get current price via REST API
  getCurrentPrice().then(price => {
    const timestamp = Math.floor(Date.now() / 1000) as UTCTimestamp;
    callback({
      time: timestamp,
      value: price
    });
  }).catch(console.error);
  
  // If this is the first subscriber, connect to WebSocket
  if (priceUpdateCallbacks.length === 1) {
    connectWebSocket();
  }
  
  return () => {
    priceUpdateCallbacks = priceUpdateCallbacks.filter(cb => cb !== callback);
    if (priceUpdateCallbacks.length === 0 && tradeUpdateCallbacks.length === 0 && socket) {
      socket.close();
      socket = null;
    }
  };
}

export function subscribeToTrades(callback: (data: TradeData) => void) {
  tradeUpdateCallbacks.push(callback);
  
  // If this is the first subscriber, connect to WebSocket
  if (tradeUpdateCallbacks.length === 1 && priceUpdateCallbacks.length === 0) {
    connectWebSocket();
  }
  
  return () => {
    tradeUpdateCallbacks = tradeUpdateCallbacks.filter(cb => cb !== callback);
    if (priceUpdateCallbacks.length === 0 && tradeUpdateCallbacks.length === 0 && socket) {
      socket.close();
      socket = null;
    }
  };
}

export async function getCurrentPrice(): Promise<number> {
  try {
    const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.USD;
  } catch (error) {
    console.error('Error fetching price:', error);
    throw error;
  }
}

export async function getHistoricalData(timeframe: Timeframe = '1m'): Promise<any[]> {
  try {
    const config = TIMEFRAME_CONFIG[timeframe];
    const endTime = Math.floor(Date.now() / 1000);
    
    // Calculate the appropriate aggregate parameter based on timeframe
    let aggregate = 1;
    if (config.endpoint === 'histominute') {
      aggregate = config.interval / 60;
    } else if (config.endpoint === 'histohour') {
      aggregate = config.interval / 3600;
    } else if (config.endpoint === 'histoday') {
      aggregate = config.interval / 86400;
    }

    const url = `https://min-api.cryptocompare.com/data/v2/${config.endpoint}?fsym=BTC&tsym=USD&limit=${config.limit}&toTs=${endTime}&aggregate=${aggregate}`;
    
    console.log(`Fetching historical data for ${timeframe} timeframe...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.Data?.Data) {
      throw new Error('Invalid data format received from API');
    }

    return data.Data.Data;
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
} 