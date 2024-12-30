import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const INITIAL_SOURCES = [
  // CEX Data
  { name: 'Cryptowatch', status: 'checking' as const, lastChecked: new Date(), category: 'CEX' as const },
  { name: 'CryptoCompare', status: 'checking' as const, lastChecked: new Date(), category: 'CEX' as const },
  { name: 'Coinglass', status: 'checking' as const, lastChecked: new Date(), category: 'CEX' as const },
  
  // Chain Data
  { name: 'Etherscan', status: 'checking' as const, lastChecked: new Date(), category: 'Chain' as const },
  { name: 'BscScan', status: 'checking' as const, lastChecked: new Date(), category: 'Chain' as const },
  { name: 'PolygonScan', status: 'checking' as const, lastChecked: new Date(), category: 'Chain' as const },
  { name: 'SnowTrace', status: 'checking' as const, lastChecked: new Date(), category: 'Chain' as const },
  { name: 'SolScan', status: 'checking' as const, lastChecked: new Date(), category: 'Chain' as const },

  // DEX Data
  { name: 'Uniswap', status: 'checking' as const, lastChecked: new Date(), category: 'DEX' as const },
  { name: 'PancakeSwap', status: 'checking' as const, lastChecked: new Date(), category: 'DEX' as const },
  { name: 'SushiSwap', status: 'checking' as const, lastChecked: new Date(), category: 'DEX' as const },
  { name: 'Curve', status: 'checking' as const, lastChecked: new Date(), category: 'DEX' as const },
  { name: 'Balancer', status: 'checking' as const, lastChecked: new Date(), category: 'DEX' as const },

  // Market Data
  { name: 'DefiLlama', status: 'checking' as const, lastChecked: new Date(), category: 'Market' as const },
  { name: 'CoinGecko', status: 'checking' as const, lastChecked: new Date(), category: 'Market' as const },
  { name: 'Alternative.me', status: 'checking' as const, lastChecked: new Date(), category: 'Market' as const },

  // News & Events
  { name: 'CryptoPanic', status: 'checking' as const, lastChecked: new Date(), category: 'News' as const },
  { name: 'Yahoo Finance', status: 'checking' as const, lastChecked: new Date(), category: 'News' as const },
  { name: 'Reddit API', status: 'checking' as const, lastChecked: new Date(), category: 'News' as const },
  { name: 'CoinMarketCal', status: 'checking' as const, lastChecked: new Date(), category: 'News' as const }
];

interface DataSource {
  name: string;
  status: 'connected' | 'error' | 'checking';
  lastChecked: Date;
  category: 'CEX' | 'DEX' | 'Chain' | 'Market' | 'News';
}

export const DataSourcesStatus = () => {
  const [sources, setSources] = useState<DataSource[]>(INITIAL_SOURCES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const checkSources = async () => {
      const updatedSources = await Promise.all(
        sources.map(async (source) => {
          try {
            const response = await fetch(`/api/health/${source.name.toLowerCase()}`);
            return {
              ...source,
              status: response.ok ? 'connected' as const : 'error' as const,
              lastChecked: new Date()
            };
          } catch {
            return {
              ...source,
              status: 'error' as const,
              lastChecked: new Date()
            };
          }
        })
      );
      setSources(updatedSources);
    };

    checkSources();
    const interval = setInterval(checkSources, 60000);
    return () => clearInterval(interval);
  }, [sources]);

  const getStatusIcon = (status: DataSource['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500 animate-pulse" />;
    }
  };

  const categories = ['all', 'CEX', 'DEX', 'Chain', 'Market', 'News'];
  const filteredSources = sources.filter(source => 
    selectedCategory === 'all' || source.category === selectedCategory
  );

  const getHealthSummary = () => {
    const total = sources.length;
    const connected = sources.filter(s => s.status === 'connected').length;
    return `${connected}/${total} Connected`;
  };

  return (
    <div className="w-full max-w-md p-4 bg-[#1E222D] rounded-lg shadow-lg border border-[#2B2B43]">
      <Collapsible defaultOpen={true}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full flex items-center justify-between p-2 text-sm bg-[#2B2B43] hover:bg-[#363853]"
          >
            <span>Data Sources Status</span>
            <span className="text-xs text-gray-400">{getHealthSummary()}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 mb-2 flex gap-2 overflow-x-auto">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
          <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
            {filteredSources.map((source, index) => (
              <Alert 
                key={index}
                variant={source.status === 'connected' ? 'default' : 'destructive'}
                className="bg-[#2B2B43] border-[#363853]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(source.status)}
                    <span className="font-medium">{source.name}</span>
                    <span className="text-xs text-gray-400">({source.category})</span>
                  </div>
                  <AlertDescription className="text-xs text-gray-400">
                    Last checked: {source.lastChecked.toLocaleTimeString()}
                  </AlertDescription>
                </div>
              </Alert>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};