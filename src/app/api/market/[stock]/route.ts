import { stockIds, type StockId, stocks } from "@/lib/assets";
import type { UTCTimestamp } from "lightweight-charts";
import type { CandleData, Timeframe } from "@/features/market/types";

export const dynamic = "force-dynamic";

interface CachedData {
  expiresAt: number;
  data: {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    timeframe: Timeframe;
    candles: CandleData[];
    observations: { timestamp: number; price: number }[];
    available: boolean;
  };
}

const cache = new Map<string, CachedData>();

async function fetchFromYahoo(
  ticker: string,
  timeframe: Timeframe,
): Promise<{
  price: number;
  change: number;
  changePercent: number;
  candles: CandleData[];
} | null> {
  const range = timeframe === "1D" ? "5d" : timeframe === "1W" ? "1mo" : "1y";
  const interval = timeframe === "1D" ? "15m" : timeframe === "1W" ? "1h" : "1d";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = quote.open || [];
  const highs: (number | null)[] = quote.high || [];
  const lows: (number | null)[] = quote.low || [];
  const closes: (number | null)[] = quote.close || [];
  const volumes: (number | null)[] = quote.volume || [];

  const candles: CandleData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] ?? 0;

    if (
      o !== null &&
      o !== undefined &&
      h !== null &&
      h !== undefined &&
      l !== null &&
      l !== undefined &&
      c !== null &&
      c !== undefined &&
      Number.isFinite(o) &&
      Number.isFinite(c)
    ) {
      candles.push({
        time: timestamps[i] as UTCTimestamp,
        open: Math.round(o * 100) / 100,
        high: Math.round(h * 100) / 100,
        low: Math.round(l * 100) / 100,
        close: Math.round(c * 100) / 100,
        volume: v,
      });
    }
  }

  if (candles.length === 0) return null;

  const lastCandle = candles[candles.length - 1];
  const price =
    meta.regularMarketPrice && Number.isFinite(meta.regularMarketPrice)
      ? Math.round(meta.regularMarketPrice * 100) / 100
      : lastCandle.close;

  const prevClose =
    meta.chartPreviousClose ??
    meta.previousClose ??
    candles[0].open;

  const change = Math.round((price - prevClose) * 100) / 100;
  const changePercent =
    prevClose > 0
      ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
      : 0;

  return { price, change, changePercent, candles };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ stock: string }> },
) {
  const { stock } = await context.params;
  const stockId = stock.toUpperCase() as StockId;

  if (!stockIds.includes(stockId)) {
    return Response.json({ error: "Unknown stock identifier." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get("timeframe") as Timeframe) || "1D";
  const validTimeframe: Timeframe = ["1D", "1W", "1M"].includes(timeframe)
    ? timeframe
    : "1D";

  const cacheKey = `${stockId}:${validTimeframe}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return Response.json(cached.data);
  }

  const stockMeta = stocks[stockId];

  let price = 0;
  let change = 0;
  let changePercent = 0;
  let candles: CandleData[] = [];

  try {
    const live = await fetchFromYahoo(stockId, validTimeframe);
    if (live && live.candles.length > 0) {
      price = live.price;
      change = live.change;
      changePercent = live.changePercent;
      candles = live.candles;
    }
  } catch {
    // Missing upstream observations must remain unavailable.
  }

  const observations = candles.map((c) => ({
    timestamp: typeof c.time === "number" ? c.time : Math.floor(now / 1000),
    price: c.close,
  }));

  const payload = {
    ticker: stockId,
    name: stockMeta.name,
    price,
    change,
    changePercent,
    timeframe: validTimeframe,
    candles,
    observations,
    available: candles.length > 0,
    source: "Yahoo Finance equity benchmark",
  };

  // Cache for 4 seconds so polling is efficient yet completely responsive
  cache.set(cacheKey, {
    expiresAt: now + 4000,
    data: payload,
  });

  return Response.json(payload);
}
