import axios from 'axios';
import { TokenMetrics } from '../types/token-metrics';

export class DefiLamaService {
    private readonly baseUrl = 'https://api.llama.fi';

    async getAllProtocols(): Promise<TokenMetrics[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/protocols`);
            return this.transformProtocolData(response.data);
        } catch (error) {
            console.error('Error fetching DeFi protocols:', error);
            return [];
        }
    }

    private transformProtocolData(data: any[]): TokenMetrics[] {
        return data.map(protocol => ({
            symbol: protocol.symbol,
            name: protocol.name,
            price: 0,
            volume24h: protocol.volume24h || 0,
            marketCap: protocol.mcap || 0,
            percentChange24h: 0,
            sector: protocol.category,
            exchanges: []
        }));
    }
}