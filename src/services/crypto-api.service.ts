import axios from 'axios';
import { TokenMetrics } from '../types/token-metrics';

export class CryptoApiService {
    private readonly apiKey = process.env.CRYPTOWATCH_API_KEY;
    private readonly baseUrl = 'https://api.cryptowat.ch';

    async getAllPairs(): Promise<TokenMetrics[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/pairs`, {
                headers: { 'X-CW-API-Key': this.apiKey }
            });
            return this.transformPairData(response.data);
        } catch (error) {
            console.error('Error fetching crypto pairs:', error);
            return [];
        }
    }

    private transformPairData(data: any): TokenMetrics[] {
        return data.result.map((pair: any) => ({
            symbol: `${pair.base}/${pair.quote}`,
            name: pair.base,
            price: 0,
            volume24h: 0,
            marketCap: 0,
            percentChange24h: 0,
            sector: 'Unknown',
            exchanges: []
        }));
    }
}