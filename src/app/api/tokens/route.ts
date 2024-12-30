import { NextResponse } from 'next/server';
import { TokenSearchService } from '@/services/token-search.service';

const tokenSearch = new TokenSearchService();

const isValidSortBy = (value: string | null): value is 'volume24h' | 'marketCap' | 'percentChange24h' => {
    return value === 'volume24h' || value === 'marketCap' || value === 'percentChange24h';
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const sector = searchParams.get('sector');
    const exchange = searchParams.get('exchange');
    const minVolume = searchParams.get('minVolume');
    const sortByParam = searchParams.get('sortBy');
    const limit = parseInt(searchParams.get('limit') || '10');

    const sortBy = isValidSortBy(sortByParam) ? sortByParam : null;

    const options = {
        sector,
        exchange,
        minVolume: minVolume ? parseFloat(minVolume) : undefined,
        sortBy,
        limit
    };

    const results = await tokenSearch.search(query, options);
    return NextResponse.json(results);
}