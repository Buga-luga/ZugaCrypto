// Existing EMA and SMA functions
export const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema = [];
  let prevEMA = data[0];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[0]);
    } else {
      prevEMA = (data[i] - prevEMA) * k + prevEMA;
      ema.push(prevEMA);
    }
  }

  return ema;
};

export const calculateSMA = (data: number[], period: number): number[] => {
  const sma = [];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
      sma.push(sum / period);
    } else if (i === period - 1) {
      sma.push(sum / period);
    } else {
      sma.push(NaN);
    }
  }

  return sma;
};

// Triple EMA (TEMA)
export const calculateTEMA = (data: number[], period: number): number[] => {
  const ema1 = calculateEMA(data, period);
  const ema2 = calculateEMA(ema1, period);
  const ema3 = calculateEMA(ema2, period);
  const tema = [];

  for (let i = 0; i < data.length; i++) {
    const value = 3 * ema1[i] - 3 * ema2[i] + ema3[i];
    tema.push(value);
  }

  return tema;
};

// Hull Moving Average (HMA)
export const calculateHMA = (data: number[], period: number): number[] => {
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  const wma1 = calculateWMA(data, halfPeriod);
  const wma2 = calculateWMA(data, period);
  const diff = [];

  // Calculate 2 * WMA(n/2) - WMA(n)
  for (let i = 0; i < data.length; i++) {
    diff.push(2 * wma1[i] - wma2[i]);
  }

  // Calculate final HMA
  return calculateWMA(diff, sqrtPeriod);
};

// Weighted Moving Average (WMA) - helper for HMA
export const calculateWMA = (data: number[], period: number): number[] => {
  const wma = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      wma.push(NaN);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j] * (period - j);
    }
    wma.push(sum / denominator);
  }

  return wma;
};

// MACD
export const calculateMACD = (data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): { 
  macd: number[], 
  signal: number[], 
  histogram: number[] 
} => {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const macd = [];

  // Calculate MACD line
  for (let i = 0; i < data.length; i++) {
    macd.push(fastEMA[i] - slowEMA[i]);
  }

  // Calculate Signal line (EMA of MACD)
  const signal = calculateEMA(macd, signalPeriod);

  // Calculate Histogram
  const histogram = macd.map((value, i) => value - signal[i]);

  return { macd, signal, histogram };
}; 