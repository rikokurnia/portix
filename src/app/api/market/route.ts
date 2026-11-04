import { stockIds, stocks } from "@/lib/assets";

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
    if (!Number.isFinite(meta?.regularMarketPrice) || meta.regularMarketPrice <= 0) return null;
    const price = Math.round(meta.regularMarketPrice * 100) / 100;
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
    return Response.json({ stocks: cachedQuotes.data, source: "Yahoo Finance equity benchmark", available: Object.keys(cachedQuotes.data).length > 0 });
  }

  const results: Record<string, StockQuoteSummary> = {};

  await Promise.all(
    stockIds.map(async (id) => {
      const live = await fetchQuoteFromYahoo(id);
      if (live) {
        results[id] = live;
      }
    }),
  );

  cachedQuotes = {
    expiresAt: now + 5000,
    data: results,
  };

  return Response.json({ stocks: results, source: "Yahoo Finance equity benchmark", available: Object.keys(results).length > 0 });
}
