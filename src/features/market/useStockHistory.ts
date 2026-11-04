"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { StockId } from "@/lib/assets";
import type { OracleObservation } from "@/lib/onchain/history";
interface History {
  observations: OracleObservation[];
  loading: boolean;
  error: string;
}
const empty: History = { observations: [], loading: true, error: "" };
const states = new Map<StockId, History>(),
  listeners = new Set<() => void>(),
  inFlight = new Set<StockId>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
async function refresh(id: StockId) {
  if (inFlight.has(id)) return;
  inFlight.add(id);
  try {
    const response = await fetch(`/api/market/${id}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("History unavailable.");
    const data = await response.json();
    const observations = Array.isArray(data.observations)
      ? data.observations.filter(
          (p: OracleObservation) =>
            Number.isFinite(p.timestamp) &&
            Number.isFinite(p.price) &&
            p.price > 0,
        )
      : [];
    states.set(id, { observations, loading: false, error: "" });
  } catch {
    states.set(id, {
      observations: states.get(id)?.observations ?? [],
      loading: false,
      error: "Price history is unavailable.",
    });
  } finally {
    inFlight.delete(id);
    listeners.forEach((fn) => fn());
  }
}
export function useStockHistory(id: StockId) {
  useEffect(() => {
    void refresh(id);
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(id);
    }, 60_000);
    return () => clearInterval(timer);
  }, [id]);
  return {
    ...useSyncExternalStore(
      subscribe,
      () => states.get(id) ?? empty,
      () => empty,
    ),
    refresh: () => refresh(id),
  };
}
