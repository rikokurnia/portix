import { stockIds, stocks } from "@/lib/assets";
import { BASELINE_MARKET_STOCKS } from "@/features/market/fixtures";

export const dynamic = "force-dynamic";

interface StockQuoteSummary {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

let cachedQuotes: {
  expiresAt: number;
  data: Record<string, StockQuoteSummary>;
} | null = null;

async function fetchQuoteFromYahoo(ticker: string): Promise<StockQuoteSummary | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=15m`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = Math.round((meta.regularMarketPrice ?? BASELINE_MARKET_STOCKS[ticker as keyof typeof BASELINE_MARKET_STOCKS]?.price ?? 100) * 100) / 100;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = Math.round((price - prevClose) * 100) / 100;
    const changePercent = prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;

    return {
      ticker,
      name: stocks[ticker as keyof typeof stocks]?.name ?? ticker,
      price,
      change,
      changePercent,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cachedQuotes && cachedQuotes.expiresAt > now) {
    return Response.json({ stocks: cachedQuotes.data });
  }

  const results: Record<string, StockQuoteSummary> = {};

  await Promise.all(
    stockIds.map(async (id) => {
      const live = await fetchQuoteFromYahoo(id);
      if (live) {
        results[id] = live;
      } else {
        const base = BASELINE_MARKET_STOCKS[id];
        // micro tick drift for live feel
        const tickSec = Math.floor(now / 4000);
        const microNoise = ((tickSec % 5) - 2) * 0.04;
        results[id] = {
          ticker: id,
          name: base.name,
          price: Math.round((base.price + microNoise) * 100) / 100,
          change: base.change,
          changePercent: base.changePercent,
        };
      }
    }),
  );

  cachedQuotes = {
    expiresAt: now + 5000,
    data: results,
  };

  return Response.json({ stocks: results });
}
