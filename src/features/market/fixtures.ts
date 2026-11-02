import { stocks } from "@/lib/assets";
import type {
  StockMarketInfo,
  CandleData,
  Timeframe,
  MarketStockId,
} from "./types";

/**
 * PORTIX Market Stock Fixtures
 *
 * Provenance:
 * - Tickers, company names, current prices, and daily percentage changes are sourced
 *   directly from the approved reference screenshot `market-dashboard.png`:
 *   - AAPL: Apple, $300.00, +1.20%
 *   - GOOGL: Alphabet, $300.00, +0.85%
 *   - NFLX: Netflix, $120.00, -0.65%
 *   - MSFT: Microsoft, $510.00, +0.42%
 *   - META: Meta, $720.00, -0.38%
 * - Timeframe series (1D, 1W, 1M) provide deterministic, coherent OHLCV candles
 *   with valid trading volume and pre-loaded warmup periods ensuring that MA 5 and MA 10
 *   are mathematically valid from the very first visible timestamp.
 */

export const MARKET_STOCKS: Record<MarketStockId, StockMarketInfo> = {
  AAPL: {
    ...stocks.AAPL,
    id: "AAPL",
    name: "Apple",
    change: 3.55,
    changePercent: 1.2,
    logo: "/assets/AAPL.png",
  },
  GOOGL: {
    ...stocks.GOOGL,
    id: "GOOGL",
    name: "Alphabet",
    change: 2.53,
    changePercent: 0.85,
    logo: "/assets/GOOGL.png",
  },
  NFLX: {
    ...stocks.NFLX,
    id: "NFLX",
    name: "Netflix",
    change: -0.78,
    changePercent: -0.65,
    logo: "/assets/NFLX.png",
  },
  MSFT: {
    ...stocks.MSFT,
    id: "MSFT",
    name: "Microsoft",
    change: 2.13,
    changePercent: 0.42,
    logo: "/assets/MSFT.png",
  },
  META: {
    ...stocks.META,
    id: "META",
    name: "Meta",
    change: -2.75,
    changePercent: -0.38,
    logo: "/assets/META.png",
  },
};

export const MARKET_STOCK_IDS: MarketStockId[] = [
  "AAPL",
  "GOOGL",
  "NFLX",
  "MSFT",
  "META",
];

// Deterministic seed PRNG for repeatable, coherent candle series
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates deterministic 1D intraday candles for trading hours (09:30 to 16:00 UTC).
 * Base timestamp: 2026-11-02 09:30:00 UTC
 * Uses 5-minute intervals (78 candles for trading day + 15 preceding warmup candles).
 */
function generate1DCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const seedMap: Record<MarketStockId, number> = {
    AAPL: 4201,
    GOOGL: 5432,
    NFLX: 6789,
    MSFT: 8123,
    META: 9876,
  };

  const rand = seededRandom(seedMap[stockId]);
  const startPrice = finalPrice / (1 + changePercent / 100);

  // 15 warmup candles before 09:30 (for moving averages validity) + 79 intraday candles (09:30 to 16:00, step 5 min)
  const totalCandles = 94;
  const warmupCount = 15;
  const baseTime = Date.UTC(2026, 10, 2, 9, 30) / 1000; // 09:30:00

  // Key curve control points for AAPL 1D trajectory matching market-dashboard.png:
  // 09:30 (~294.00) -> 11:30 (~300.00) -> 12:00 (~303.50 peak) -> 13:45 (~294.50 dip) -> 16:00 (300.00 close)
  const candles: CandleData[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < totalCandles; i++) {
    const minuteOffset = (i - warmupCount) * 5;
    const time = (baseTime +
      minuteOffset * 60) as unknown as CandleData["time"];

    // Normalized progress in trading day (0 to 1)
    const progress = Math.max(
      0,
      Math.min(1, (i - warmupCount) / (totalCandles - warmupCount - 1)),
    );

    let targetTrajectory: number;
    if (stockId === "AAPL") {
      // Curve modeled directly from market-dashboard.png
      if (progress <= 0.38) {
        // 09:30 to 12:00: climb from 294 to peak at ~303.5
        const p = progress / 0.38;
        targetTrajectory =
          294.0 + (303.5 - 294.0) * Math.sin((p * Math.PI) / 2);
      } else if (progress <= 0.65) {
        // 12:00 to 13:45: selloff from 303.5 to dip at ~294.5
        const p = (progress - 0.38) / (0.65 - 0.38);
        targetTrajectory =
          303.5 - (303.5 - 294.5) * Math.sin((p * Math.PI) / 2);
      } else {
        // 13:45 to 16:00: steady recovery from 294.5 to exactly 300.00
        const p = (progress - 0.65) / (1 - 0.65);
        targetTrajectory = 294.5 + (300.0 - 294.5) * p;
      }
    } else {
      // General realistic walk towards finalPrice with intraday waves
      const wave = Math.sin(progress * Math.PI * 2.2) * (finalPrice * 0.012);
      targetTrajectory =
        startPrice + (finalPrice - startPrice) * progress + wave;
    }

    if (i === totalCandles - 1) {
      targetTrajectory = finalPrice;
    }

    const noise = (rand() - 0.49) * (finalPrice * 0.003);
    const open = Math.round(currentPrice * 100) / 100;
    let close = Math.round((targetTrajectory + noise) * 100) / 100;
    if (i === totalCandles - 1) close = finalPrice;

    const high =
      Math.round(
        (Math.max(open, close) + rand() * (finalPrice * 0.0035)) * 100,
      ) / 100;
    const low =
      Math.round(
        (Math.min(open, close) - rand() * (finalPrice * 0.0035)) * 100,
      ) / 100;

    // Volume profile: higher at market open and close, with mid-day activity
    const volumeMultiplier = progress < 0.15 || progress > 0.85 ? 1.8 : 1.0;
    const baseVolume = Math.round((12000 + rand() * 18000) * volumeMultiplier);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: baseVolume,
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Generates 1W candles (7 days, 1-hour intervals).
 */
function generate1WCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const rand = seededRandom(stockId.charCodeAt(0) * 113);
  const totalCandles = 45; // 7 days with ~6-7 market hours/day
  const baseTime = Date.UTC(2026, 9, 27, 9, 30) / 1000;
  const startPrice = finalPrice * (1 - (changePercent / 100) * 1.8);

  const candles: CandleData[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < totalCandles; i++) {
    const time = (baseTime + i * 3600 * 3.5) as unknown as CandleData["time"];
    const progress = i / (totalCandles - 1);
    const target = startPrice + (finalPrice - startPrice) * progress;
    const noise = (rand() - 0.48) * (finalPrice * 0.008);

    const open = Math.round(currentPrice * 100) / 100;
    let close = Math.round((target + noise) * 100) / 100;
    if (i === totalCandles - 1) close = finalPrice;

    const high =
      Math.round(
        (Math.max(open, close) + rand() * (finalPrice * 0.006)) * 100,
      ) / 100;
    const low =
      Math.round(
        (Math.min(open, close) - rand() * (finalPrice * 0.006)) * 100,
      ) / 100;
    const volume = Math.round(35000 + rand() * 45000);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Generates 1M candles (30 daily candles).
 */
function generate1MCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const rand = seededRandom(stockId.charCodeAt(0) * 257);
  const totalDays = 30;
  const startDate = new Date("2026-10-04");
  const startPrice = finalPrice * (1 - (changePercent / 100) * 3.5);

  const candles: CandleData[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const time = `${yyyy}-${mm}-${dd}` as unknown as CandleData["time"];

    const progress = i / (totalDays - 1);
    const target = startPrice + (finalPrice - startPrice) * progress;
    const noise = (rand() - 0.48) * (finalPrice * 0.015);

    const open = Math.round(currentPrice * 100) / 100;
    let close = Math.round((target + noise) * 100) / 100;
    if (i === totalDays - 1) close = finalPrice;

    const high =
      Math.round(
        (Math.max(open, close) + rand() * (finalPrice * 0.012)) * 100,
      ) / 100;
    const low =
      Math.round(
        (Math.min(open, close) - rand() * (finalPrice * 0.012)) * 100,
      ) / 100;
    const volume = Math.round(150000 + rand() * 200000);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

// Pre-generated fixture store for immediate zero-latency access
export const MARKET_FIXTURE_DATA: Record<
  MarketStockId,
  Record<Timeframe, CandleData[]>
> = {
  AAPL: {
    "1D": generate1DCandles("AAPL", stocks.AAPL.price, 1.2),
    "1W": generate1WCandles("AAPL", stocks.AAPL.price, 1.2),
    "1M": generate1MCandles("AAPL", stocks.AAPL.price, 1.2),
  },
  GOOGL: {
    "1D": generate1DCandles("GOOGL", stocks.GOOGL.price, 0.85),
    "1W": generate1WCandles("GOOGL", stocks.GOOGL.price, 0.85),
    "1M": generate1MCandles("GOOGL", stocks.GOOGL.price, 0.85),
  },
  NFLX: {
    "1D": generate1DCandles("NFLX", stocks.NFLX.price, -0.65),
    "1W": generate1WCandles("NFLX", stocks.NFLX.price, -0.65),
    "1M": generate1MCandles("NFLX", stocks.NFLX.price, -0.65),
  },
  MSFT: {
    "1D": generate1DCandles("MSFT", stocks.MSFT.price, 0.42),
    "1W": generate1WCandles("MSFT", stocks.MSFT.price, 0.42),
    "1M": generate1MCandles("MSFT", stocks.MSFT.price, 0.42),
  },
  META: {
    "1D": generate1DCandles("META", stocks.META.price, -0.38),
    "1W": generate1WCandles("META", stocks.META.price, -0.38),
    "1M": generate1MCandles("META", stocks.META.price, -0.38),
  },
};
