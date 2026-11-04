import type { UTCTimestamp } from "lightweight-charts";
import type {
  StockMarketInfo,
  CandleData,
  Timeframe,
  MarketStockId,
} from "./types";

/**
 * PORTIX Market Stock Fixtures & Deterministic Fallbacks
 *
 * Supported Stocks:
 * - AAPL: Apple Inc.
 * - GOOGL: Alphabet Inc.
 * - NFLX: Netflix Inc.
 * - MSFT: Microsoft Corp.
 * - META: Meta Platforms Inc.
 * - SPY: SPDR S&P 500 ETF Trust
 * - QQQ: Invesco QQQ Trust
 * - NVDA: NVIDIA Corporation
 */

export const MARKET_STOCK_IDS: MarketStockId[] = [
  "AAPL",
  "GOOGL",
  "NFLX",
  "MSFT",
  "META",
  "SPY",
  "QQQ",
  "NVDA",
];

export const BASELINE_MARKET_STOCKS: Record<MarketStockId, StockMarketInfo> = {
  AAPL: {
    id: "AAPL",
    name: "Apple",
    price: 331.9,
    change: -15.2,
    changePercent: -4.38,
    logo: "/assets/AAPL.png",
  },
  GOOGL: {
    id: "GOOGL",
    name: "Alphabet",
    price: 280.03,
    change: 2.53,
    changePercent: 0.91,
    logo: "/assets/GOOGL.png",
  },
  NFLX: {
    id: "NFLX",
    name: "Netflix",
    price: 63.42,
    change: 0.9,
    changePercent: 1.44,
    logo: "/assets/NFLX.png",
  },
  MSFT: {
    id: "MSFT",
    name: "Microsoft",
    price: 520.99,
    change: -10.34,
    changePercent: -1.95,
    logo: "/assets/MSFT.png",
  },
  META: {
    id: "META",
    name: "Meta",
    price: 621.03,
    change: 0.84,
    changePercent: 0.14,
    logo: "/assets/META.png",
  },
  SPY: {
    id: "SPY",
    name: "SPDR S&P 500 ETF",
    price: 754.35,
    change: -15.31,
    changePercent: -1.99,
    logo: "/assets/SPY.png",
  },
  QQQ: {
    id: "QQQ",
    name: "Invesco QQQ Trust",
    price: 685.28,
    change: -35.97,
    changePercent: -4.99,
    logo: "/assets/QQQ.png",
  },
  NVDA: {
    id: "NVDA",
    name: "NVIDIA",
    price: 206.69,
    change: -11.25,
    changePercent: -5.16,
    logo: "/assets/NVDA.png",
  },
};

export const MARKET_STOCKS = BASELINE_MARKET_STOCKS;

// Deterministic pseudo-random number generator for coherent fallback candles
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SEED_MAP: Record<MarketStockId, number> = {
  AAPL: 4201,
  GOOGL: 5432,
  NFLX: 6789,
  MSFT: 8123,
  META: 9876,
  SPY: 3311,
  QQQ: 4422,
  NVDA: 7788,
};

/**
 * Generates continuous fallback candles for any timeframe when external APIs are unavailable.
 */
export function generateFallbackCandles(
  stockId: MarketStockId,
  timeframe: Timeframe,
  basePrice?: number,
): CandleData[] {
  const stock = BASELINE_MARKET_STOCKS[stockId];
  const finalPrice = basePrice ?? stock.price;
  const rand = seededRandom(SEED_MAP[stockId] + (timeframe === "1D" ? 1 : timeframe === "1W" ? 2 : 3));

  const nowSec = Math.floor(Date.now() / 1000);
  const candles: CandleData[] = [];

  if (timeframe === "1D") {
    // 5 trading sessions of 15m candles (~130 candles)
    const totalCandles = 130;
    const interval = 15 * 60; // 15 mins
    const startTime = nowSec - totalCandles * interval;
    const startPrice = finalPrice * (1 - (stock.changePercent / 100) * 0.8);
    let curr = startPrice;

    for (let i = 0; i < totalCandles; i++) {
      const time = startTime + i * interval;
      const progress = i / (totalCandles - 1);
      const wave = Math.sin(progress * Math.PI * 3) * (finalPrice * 0.015);
      const target = startPrice + (finalPrice - startPrice) * progress + wave;
      const noise = (rand() - 0.49) * (finalPrice * 0.006);

      const open = Math.round(curr * 100) / 100;
      let close = Math.round((target + noise) * 100) / 100;
      if (i === totalCandles - 1) close = finalPrice;

      const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.005)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.005)) * 100) / 100;
      const volume = Math.round(15000 + rand() * 45000);

      candles.push({ time: time as UTCTimestamp, open, high, low, close, volume });
      curr = close;
    }
  } else if (timeframe === "1W") {
    // 1 month of 1h candles (~150 candles)
    const totalCandles = 150;
    const interval = 3600; // 1 hr
    const startTime = nowSec - totalCandles * interval;
    const startPrice = finalPrice * (1 - (stock.changePercent / 100) * 1.5 - 0.03);
    let curr = startPrice;

    for (let i = 0; i < totalCandles; i++) {
      const time = startTime + i * interval;
      const progress = i / (totalCandles - 1);
      const wave = Math.sin(progress * Math.PI * 2.5) * (finalPrice * 0.03);
      const target = startPrice + (finalPrice - startPrice) * progress + wave;
      const noise = (rand() - 0.49) * (finalPrice * 0.009);

      const open = Math.round(curr * 100) / 100;
      let close = Math.round((target + noise) * 100) / 100;
      if (i === totalCandles - 1) close = finalPrice;

      const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.007)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.007)) * 100) / 100;
      const volume = Math.round(45000 + rand() * 95000);

      candles.push({ time: time as UTCTimestamp, open, high, low, close, volume });
      curr = close;
    }
  } else {
    // 1M: 1 year of daily candles (~250 candles)
    const totalCandles = 250;
    const interval = 86400; // 1 day
    const startTime = nowSec - totalCandles * interval;
    const startPrice = finalPrice * (1 - (stock.changePercent / 100) * 2.5 - 0.08);
    let curr = startPrice;

    for (let i = 0; i < totalCandles; i++) {
      const time = startTime + i * interval;
      const progress = i / (totalCandles - 1);
      const wave = Math.sin(progress * Math.PI * 4) * (finalPrice * 0.05);
      const target = startPrice + (finalPrice - startPrice) * progress + wave;
      const noise = (rand() - 0.48) * (finalPrice * 0.015);

      const open = Math.round(curr * 100) / 100;
      let close = Math.round((target + noise) * 100) / 100;
      if (i === totalCandles - 1) close = finalPrice;

      const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.012)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.012)) * 100) / 100;
      const volume = Math.round(180000 + rand() * 420000);

      candles.push({ time: time as UTCTimestamp, open, high, low, close, volume });
      curr = close;
    }
  }

  return candles;
}
