export interface SearchOptions {
    sector?: string | null;
    exchange?: string | null;
    minVolume?: number;
    sortBy?: 'volume24h' | 'marketCap' | 'percentChange24h' | null;
    limit?: number;
}