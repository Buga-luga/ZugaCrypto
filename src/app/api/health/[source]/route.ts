import { NextResponse } from 'next/server';

const API_ENDPOINTS = {
  cryptocompare: 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
  cryptowatch: 'https://api.cryptowat.ch/markets',
  coinglass: 'https://open-api.coinglass.com/public/v2/perpetual',
  etherscan: 'https://api.etherscan.io/api?module=proxy&action=eth_blockNumber',
  bscscan: 'https://api.bscscan.com/api?module=proxy&action=eth_blockNumber',
  polygonscan: 'https://api.polygonscan.com/api?module=proxy&action=eth_blockNumber',
  snowtrace: 'https://api.snowtrace.io/api?module=proxy&action=eth_blockNumber',
  solscan: 'https://public-api.solscan.io/block/last',
  uniswap: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  pancakeswap: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2',
  sushiswap: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
  curve: 'https://api.curve.fi/api/getPools/ethereum/main',
  balancer: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
  defillama: 'https://api.llama.fi/protocols',
  coingecko: 'https://api.coingecko.com/api/v3/ping',
  alternativeme: 'https://api.alternative.me/v2/ticker',
  cryptopanic: 'https://cryptopanic.com/api/v1/posts/',
  yahoofinance: 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD',
  redditapi: 'https://www.reddit.com/r/CryptoCurrency/hot.json',
  coinmarketcal: 'https://api.coinmarketcal.com/v1/events'
};

export async function GET(
  request: Request,
  { params }: { params: { source: string } }
) {
  const source = params.source.toLowerCase().replace(/[\s\.]/g, '');
  const endpoint = API_ENDPOINTS[source as keyof typeof API_ENDPOINTS];
  
  if (!endpoint) {
    return NextResponse.json({ status: 'error', message: 'Invalid source' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(endpoint, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'ZugaCrypto/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('API not healthy');
    
    return NextResponse.json({ status: 'connected' });
  } catch (error) {
    console.error(`Health check failed for ${source}:`, error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}