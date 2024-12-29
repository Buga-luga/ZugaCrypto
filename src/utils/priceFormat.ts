interface PriceFormatConfig {
  precision: number;
  minMove: number;
  format: (price: number) => string;
}

export const DEFAULT_BTC_FORMAT = '0.00000000';
export const DEFAULT_USDT_FORMAT = '0.00';

// Single source of truth for checking if a pair is BTC-based
export const isBTCPair = (baseToken: string): boolean => {
  return baseToken.toUpperCase() === 'BTC';
};

export const getPriceFormatConfig = (baseToken: string): PriceFormatConfig => {
  const btcPair = isBTCPair(baseToken);
  return {
    precision: btcPair ? 8 : 2,
    minMove: btcPair ? 0.00000001 : 0.01,
    format: (price: number): string => {
      if (typeof price !== 'number' || isNaN(price)) {
        return btcPair ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
      }
      return price.toFixed(btcPair ? 8 : 2);
    }
  };
};

export const getChartPriceFormat = (baseToken: string) => {
  const btcPair = isBTCPair(baseToken);
  return {
    type: 'custom' as const,
    minMove: btcPair ? 0.00000001 : 0.01,
    formatter: (price: number): string => {
      if (typeof price !== 'number' || isNaN(price)) {
        return btcPair ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
      }
      return price.toFixed(btcPair ? 8 : 2);
    }
  };
};

export const getScaleFormat = (baseToken: string) => {
  const btcPair = isBTCPair(baseToken);
  return {
    type: 'custom' as const,
    minMove: btcPair ? 0.00000001 : 0.01,
    formatter: (price: number): string => {
      if (typeof price !== 'number' || isNaN(price)) {
        return btcPair ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
      }
      return price.toFixed(btcPair ? 8 : 2);
    }
  };
};

export const formatPrice = (price: number, baseToken: string): string => {
  const btcPair = isBTCPair(baseToken);
  if (typeof price !== 'number' || isNaN(price)) {
    return btcPair ? DEFAULT_BTC_FORMAT : DEFAULT_USDT_FORMAT;
  }
  return price.toFixed(btcPair ? 8 : 2);
}; 