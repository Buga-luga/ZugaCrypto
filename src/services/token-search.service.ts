import { TokenMetrics } from '../types/token-metrics';
import { SearchOptions } from '../types/search-options';
import { CryptoApiService } from '@/services/crypto-api.service';
import { DefiLamaService } from '@/services/defi-lama.service';
import { CoinGeckoService } from '@/services/coingecko.service';

export class TokenSearchService {
    private cryptoApi: CryptoApiService;
    private defiLama: DefiLamaService;
    private coinGecko: CoinGeckoService;
    private searchIndex: Map<string, Set<string>> = new Map();
    private tokens: Map<string, TokenMetrics> = new Map();

    constructor() {
        this.cryptoApi = new CryptoApiService();
        this.defiLama = new DefiLamaService();
        this.coinGecko = new CoinGeckoService();
    }

    async initialize(): Promise<void> {
        await this.coinGecko.initialize();
        
        const [cryptoData, defiData] = await Promise.all([
            this.cryptoApi.getAllPairs(),
            this.defiLama.getAllProtocols()
        ]);
        
        await this.processTokenData(cryptoData, defiData);
        this.buildSearchIndex();
    }

    private async processTokenData(cryptoData: any, defiData: any): Promise<void> {
        // Process and merge data from different sources
        for (const token of cryptoData) {
            const sector = await this.coinGecko.getTokenCategory(token.symbol.toLowerCase());
            token.sector = sector;
            this.tokens.set(token.symbol, token);
        }
        
        for (const token of defiData) {
            if (!this.tokens.has(token.symbol)) {
                const sector = await this.coinGecko.getTokenCategory(token.symbol.toLowerCase());
                token.sector = sector;
                this.tokens.set(token.symbol, token);
            }
        }
    }

    private buildSearchIndex(): void {
        this.tokens.forEach((metrics, symbol) => {
            this.addToIndex(symbol.toLowerCase(), symbol);
            this.addToIndex(metrics.name.toLowerCase(), symbol);
        });
    }

    private addToIndex(term: string, symbol: string): void {
        for (let i = 1; i <= term.length; i++) {
            const prefix = term.substring(0, i);
            if (!this.searchIndex.has(prefix)) {
                this.searchIndex.set(prefix, new Set());
            }
            this.searchIndex.get(prefix)!.add(symbol);
        }
    }

    search(query: string, options: SearchOptions = {}): TokenMetrics[] {
        const matches = this.searchIndex.get(query.toLowerCase()) || new Set();
        return Array.from(matches)
            .map(symbol => this.tokens.get(symbol)!)
            .filter(token => this.applyFilters(token, options))
            .sort(this.getSortFunction(options.sortBy))
            .slice(0, options.limit || 10);
    }

    private applyFilters(token: TokenMetrics, options: SearchOptions): boolean {
        if (options.sector && token.sector !== options.sector) return false;
        if (options.exchange && !token.exchanges.includes(options.exchange)) return false;
        if (options.minVolume && token.volume24h < options.minVolume) return false;
        return true;
    }

    private getSortFunction(sortBy?: 'volume24h' | 'marketCap' | 'percentChange24h' | null): (a: TokenMetrics, b: TokenMetrics) => number {
        return (a, b) => {
            switch (sortBy) {
                case 'volume24h':
                    return b.volume24h - a.volume24h;
                case 'marketCap':
                    return b.marketCap - a.marketCap;
                case 'percentChange24h':
                    return b.percentChange24h - a.percentChange24h;
                default:
                    return b.volume24h - a.volume24h;
            }
        };
    }

    getSectors(): string[] {
        const sectors = new Set<string>();
        this.tokens.forEach(token => {
            if (token.sector) {
                sectors.add(token.sector);
            }
        });
        return Array.from(sectors);
    }
}