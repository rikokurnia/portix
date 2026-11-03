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
 *   directly from approved references:
 *   - AAPL: Apple, $300.00, +1.20% (Tech Equity)
 *   - GOOGL: Alphabet, $300.00, +0.85% (Tech Equity)
 *   - NFLX: Netflix, $120.00, -0.65% (Tech Equity)
 *   - MSFT: Microsoft, $510.00, +0.42% (Tech Equity)
 *   - META: Meta, $720.00, -0.38% (Tech Equity)
 *   - SPY: SPDR S&P 500 ETF Trust, $585.00, +0.72% (Index ETF)
 *   - QQQ: Invesco QQQ Trust, $495.00, +1.18% (Index ETF)
 *   - NVDA: NVIDIA Corporation, $140.00, +2.83% (Semiconductors)
 * - Timeframe series (1D, 1W, 1M) provide deterministic, deep historical OHLCV candles
 *   spanning multiple trading sessions so traders can pan/drag back in time to inspect past history.
 * - MA 5 and MA 10 moving averages remain mathematically accurate across the full range.
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
  SPY: {
    ...stocks.SPY,
    id: "SPY",
    name: "SPDR S&P 500 ETF",
    change: 4.20,
    changePercent: 0.72,
    logo: "/assets/SPY.png",
  },
  QQQ: {
    ...stocks.QQQ,
    id: "QQQ",
    name: "Invesco QQQ Trust",
    change: 5.80,
    changePercent: 1.18,
    logo: "/assets/QQQ.png",
  },
  NVDA: {
    ...stocks.NVDA,
    id: "NVDA",
    name: "NVIDIA",
    change: 3.85,
    changePercent: 2.83,
    logo: "/assets/NVDA.png",
  },
};

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

// Deterministic seed PRNG for repeatable, coherent candle series
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
 * Generates deterministic 1D intraday candles spanning 5 consecutive trading days (390 candles).
 * Each day contains 78 five-minute candles (09:30 to 16:00 UTC).
 * Enables smooth drag/pan backwards into past days.
 */
function generate1DCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const rand = seededRandom(SEED_MAP[stockId]);
  const days = [
    Date.UTC(2026, 9, 27, 9, 30) / 1000,
    Date.UTC(2026, 9, 28, 9, 30) / 1000,
    Date.UTC(2026, 9, 29, 9, 30) / 1000,
    Date.UTC(2026, 9, 30, 9, 30) / 1000,
    Date.UTC(2026, 10, 2, 9, 30) / 1000, // Today
  ];

  const candlesPerDay = 78;
  const candles: CandleData[] = [];

  // Start from 5 days ago (~3% offset)
  const initialBasePrice = finalPrice * (1 - (changePercent / 100) * 1.5 - 0.02);
  let currentPrice = initialBasePrice;

  days.forEach((dayStart, dayIdx) => {
    const isToday = dayIdx === days.length - 1;
    const dayTargetStart = currentPrice * (1 + (rand() - 0.48) * 0.008);
    currentPrice = dayTargetStart;

    for (let c = 0; c < candlesPerDay; c++) {
      const time = (dayStart + c * 300) as unknown as CandleData["time"];
      const progress = c / (candlesPerDay - 1);

      let targetPrice: number;
      if (isToday && stockId === "AAPL") {
        // Curve modeled directly from market-dashboard.png for AAPL today:
        // 09:30 (~294.00) -> 11:30 (~300.00) -> 12:00 (~303.50 peak) -> 13:45 (~294.50 dip) -> 16:00 (300.00 close)
        if (progress <= 0.38) {
          const p = progress / 0.38;
          targetPrice = 294.0 + (303.5 - 294.0) * Math.sin((p * Math.PI) / 2);
        } else if (progress <= 0.65) {
          const p = (progress - 0.38) / (0.65 - 0.38);
          targetPrice = 303.5 - (303.5 - 294.5) * Math.sin((p * Math.PI) / 2);
        } else {
          const p = (progress - 0.65) / (1 - 0.65);
          targetPrice = 294.5 + (300.0 - 294.5) * p;
        }
      } else if (isToday) {
        const todayStart = finalPrice / (1 + changePercent / 100);
        const wave = Math.sin(progress * Math.PI * 2.2) * (finalPrice * 0.01);
        targetPrice = todayStart + (finalPrice - todayStart) * progress + wave;
      } else {
        const dayDrift = (rand() - 0.49) * (currentPrice * 0.004);
        targetPrice = currentPrice + dayDrift;
      }

      if (isToday && c === candlesPerDay - 1) {
        targetPrice = finalPrice;
      }

      const noise = (rand() - 0.49) * (finalPrice * 0.0025);
      const open = Math.round(currentPrice * 100) / 100;
      let close = Math.round((targetPrice + noise) * 100) / 100;
      if (isToday && c === candlesPerDay - 1) close = finalPrice;

      const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.003)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.003)) * 100) / 100;

      const volumeMultiplier = progress < 0.15 || progress > 0.85 ? 1.9 : 1.0;
      const baseVolume = Math.round((14000 + rand() * 22000) * volumeMultiplier);

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
  });

  return candles;
}

/**
 * Generates 1W candles: 60 trading days with 5 hourly candles per day (~300 candles).
 * Allows extensive backwards panning over multi-week history.
 */
function generate1WCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const rand = seededRandom(SEED_MAP[stockId] * 3);
  const totalCandles = 280;
  const baseTime = Date.UTC(2026, 7, 10, 9, 30) / 1000;
  const startPrice = finalPrice * (1 - (changePercent / 100) * 2.8 - 0.06);

  const candles: CandleData[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < totalCandles; i++) {
    const time = (baseTime + i * 3600 * 4) as unknown as CandleData["time"];
    const progress = i / (totalCandles - 1);
    const macroTrend = Math.sin(progress * Math.PI * 3.5) * (finalPrice * 0.04);
    const target = startPrice + (finalPrice - startPrice) * progress + macroTrend;
    const noise = (rand() - 0.48) * (finalPrice * 0.007);

    const open = Math.round(currentPrice * 100) / 100;
    let close = Math.round((target + noise) * 100) / 100;
    if (i === totalCandles - 1) close = finalPrice;

    const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.006)) * 100) / 100;
    const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.006)) * 100) / 100;
    const volume = Math.round(45000 + rand() * 65000);

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
 * Generates 1M candles: 220 daily trading candles (~1 full trading year).
 * Formatted as "YYYY-MM-DD" daily bars.
 */
function generate1MCandles(
  stockId: MarketStockId,
  finalPrice: number,
  changePercent: number,
): CandleData[] {
  const rand = seededRandom(SEED_MAP[stockId] * 7);
  const totalDays = 220;
  const startDate = new Date("2026-01-05");
  const startPrice = finalPrice * (1 - (changePercent / 100) * 4.2 - 0.12);

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
    const multiCycle = Math.sin(progress * Math.PI * 4) * (finalPrice * 0.06);
    const target = startPrice + (finalPrice - startPrice) * progress + multiCycle;
    const noise = (rand() - 0.48) * (finalPrice * 0.014);

    const open = Math.round(currentPrice * 100) / 100;
    let close = Math.round((target + noise) * 100) / 100;
    if (i === totalDays - 1) close = finalPrice;

    const high = Math.round((Math.max(open, close) + rand() * (finalPrice * 0.012)) * 100) / 100;
    const low = Math.round((Math.min(open, close) - rand() * (finalPrice * 0.012)) * 100) / 100;
    const volume = Math.round(180000 + rand() * 320000);

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

// Pre-generated fixture store for immediate zero-latency access across all 8 stocks
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
  SPY: {
    "1D": generate1DCandles("SPY", stocks.SPY.price, 0.72),
    "1W": generate1WCandles("SPY", stocks.SPY.price, 0.72),
    "1M": generate1MCandles("SPY", stocks.SPY.price, 0.72),
  },
  QQQ: {
    "1D": generate1DCandles("QQQ", stocks.QQQ.price, 1.18),
    "1W": generate1WCandles("QQQ", stocks.QQQ.price, 1.18),
    "1M": generate1MCandles("QQQ", stocks.QQQ.price, 1.18),
  },
  NVDA: {
    "1D": generate1DCandles("NVDA", stocks.NVDA.price, 2.83),
    "1W": generate1WCandles("NVDA", stocks.NVDA.price, 2.83),
    "1M": generate1MCandles("NVDA", stocks.NVDA.price, 2.83),
  },
};
