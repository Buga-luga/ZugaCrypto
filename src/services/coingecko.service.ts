import axios from 'axios';

export class CoinGeckoService {
    private readonly baseUrl = 'https://api.coingecko.com/api/v3';
    private categories: Map<string, string> = new Map();

    async initialize(): Promise<void> {
        try {
            const response = await axios.get(`${this.baseUrl}/coins/categories/list`);
            response.data.forEach((category: { id: string, name: string }) => {
                this.categories.set(category.id.toLowerCase(), category.name);
            });
        } catch (error) {
            console.error('Failed to fetch CoinGecko categories:', error);
        }
    }

    async getTokenCategory(tokenId: string): Promise<string | null> {
        try {
            const response = await axios.get(`${this.baseUrl}/coins/${tokenId}`);
            return response.data.categories?.[0] || null;
        } catch (error) {
            console.error(`Failed to fetch category for token ${tokenId}:`, error);
            return null;
        }
    }

    getCategoryName(categoryId: string): string | null {
        return this.categories.get(categoryId.toLowerCase()) || null;
    }
}