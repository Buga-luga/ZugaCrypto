export interface TokenMetrics {
    symbol: string;
    name: string;
    price: number;
    volume24h: number;
    marketCap: number;
    percentChange24h: number;
    sector: string;
    exchanges: string[];
}

export interface SearchOptions {
    sector?: string;
    exchange?: string;
    minVolume?: number;
    minMarketCap?: number;
    sortBy?: SortOrder;
    limit?: number;
}

export enum SortOrder {
    VOLUME = 'volume24h',
    PRICE = 'price',
    MARKET_CAP = 'marketCap',
    PERCENT_CHANGE = 'percentChange24h'
}