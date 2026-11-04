"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { StockId } from "@/lib/assets";
import type { CandleData, Timeframe } from "./types";
import { BASELINE_MARKET_STOCKS, generateFallbackCandles } from "./fixtures";
import { updatePortfolio, getPortfolioSnapshot } from "@/lib/portfolio-store";

export interface StockHistoryState {
  ticker: StockId;
  price: number;
  change: number;
  changePercent: number;
  candles: CandleData[];
  observations: { timestamp: number; price: number }[];
  loading: boolean;
  error: string;
}

const cache = new Map<string, StockHistoryState>();
const listeners = new Set<() => void>();
const inFlight = new Set<string>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

function getInitialState(id: StockId, timeframe: Timeframe): StockHistoryState {
  const base = BASELINE_MARKET_STOCKS[id] ?? {
    id,
    name: id,
    price: 100,
    change: 0,
    changePercent: 0,
    logo: "",
  };
  const fallbackCandles = generateFallbackCandles(id, timeframe, base.price);
  return {
    ticker: id,
    price: base.price,
    change: base.change,
    changePercent: base.changePercent,
    candles: fallbackCandles,
    observations: fallbackCandles.map((c) => ({
      timestamp: typeof c.time === "number" ? c.time : Math.floor(Date.now() / 1000),
      price: c.close,
    })),
    loading: false,
    error: "",
  };
}

async function refresh(id: StockId, timeframe: Timeframe) {
  const key = `${id}:${timeframe}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  try {
    const res = await fetch(`/api/market/${id}?timeframe=${timeframe}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error("Market data unavailable.");
    const data = await res.json();

    const candles: CandleData[] = Array.isArray(data.candles)
      ? data.candles.filter(
          (c: CandleData) =>
            Number.isFinite(c.open) &&
            Number.isFinite(c.close) &&
            c.close > 0,
        )
      : [];

    const price = Number.isFinite(data.price)
      ? data.price
      : (candles[candles.length - 1]?.close ?? BASELINE_MARKET_STOCKS[id]?.price ?? 100);

    const change = Number.isFinite(data.change)
      ? data.change
      : (BASELINE_MARKET_STOCKS[id]?.change ?? 0);

    const changePercent = Number.isFinite(data.changePercent)
      ? data.changePercent
      : (BASELINE_MARKET_STOCKS[id]?.changePercent ?? 0);

    const observations = Array.isArray(data.observations)
      ? data.observations
      : candles.map((c) => ({
          timestamp: typeof c.time === "number" ? c.time : Math.floor(Date.now() / 1000),
          price: c.close,
        }));

    cache.set(key, {
      ticker: id,
      price,
      change,
      changePercent,
      candles: candles.length > 0 ? candles : generateFallbackCandles(id, timeframe, price),
      observations,
      loading: false,
      error: "",
    });

    // Synchronize price with shared portfolio store
    const currentPrices = getPortfolioSnapshot().prices;
    if (currentPrices[id] !== price) {
      updatePortfolio({
        prices: {
          ...currentPrices,
          [id]: price,
        },
      });
    }
  } catch {
    const existing = cache.get(key) ?? getInitialState(id, timeframe);
    cache.set(key, {
      ...existing,
      loading: false,
      error: "",
    });
  } finally {
    inFlight.delete(key);
    listeners.forEach((fn) => fn());
  }
}

export function useStockHistory(id: StockId, timeframe: Timeframe = "1D") {
  const key = `${id}:${timeframe}`;

  useEffect(() => {
    void refresh(id, timeframe);

    // Live continuous polling every 4 seconds for real-time price & candle ticking
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        void refresh(id, timeframe);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [id, timeframe]);

  const snap = cache.get(key) ?? getInitialState(id, timeframe);

  return {
    ...useSyncExternalStore(
      subscribe,
      () => cache.get(key) ?? snap,
      () => snap,
    ),
    refresh: () => refresh(id, timeframe),
  };
}
