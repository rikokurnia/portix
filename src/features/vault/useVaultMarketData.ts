"use client";
import { useEffect, useSyncExternalStore } from "react";
import {
  normalizeYieldHistory,
  protocols,
  yieldEndpoint,
  type ProtocolId,
  type YieldPoint,
} from "@/lib/vault-market-data";
interface MarketState {
  histories: Partial<Record<ProtocolId, YieldPoint[]>>;
  status: "loading" | "ready" | "error";
  refreshing: boolean;
  error: string | null;
  fetchedAt: string | null;
}
const initial: MarketState = {
  histories: {},
  status: "loading",
  refreshing: false,
  error: null,
  fetchedAt: null,
};
let state = initial,
  pending: Promise<void> | null = null,
  timer: ReturnType<typeof setInterval> | undefined,
  consumers = 0;
const listeners = new Set<() => void>();
function publish(next: MarketState) {
  state = next;
  listeners.forEach((fn) => fn());
}
export function refreshVaultMarketData(): Promise<void> {
  if (pending) return pending;
  publish({ ...state, refreshing: true });
  pending = (async () => {
    const ids = Object.keys(protocols) as ProtocolId[];
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const response = await fetch(yieldEndpoint(id), {
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Yield source unavailable");
        const body = await response.json();
        return { id, points: normalizeYieldHistory(body.data, id) };
      }),
    );
    const histories = { ...state.histories };
    let failures = 0;
    results.forEach((result) => {
      if (result.status === "fulfilled")
        histories[result.value.id] = result.value.points;
      else failures++;
    });
    publish({
      histories,
      status: failures ? "error" : "ready",
      refreshing: false,
      error: failures
        ? "Some benchmark feeds could not refresh. Available observations are retained."
        : null,
      fetchedAt: new Date().toISOString(),
    });
  })().finally(() => {
    pending = null;
  });
  return pending;
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useVaultMarketData() {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
  useEffect(() => {
    consumers++;
    if (consumers === 1) {
      if (!state.fetchedAt || Date.now() - Date.parse(state.fetchedAt) > 60000)
        void refreshVaultMarketData();
      timer = setInterval(() => void refreshVaultMarketData(), 60000);
    }
    return () => {
      consumers--;
      if (!consumers) clearInterval(timer);
    };
  }, []);
  return { ...value, refresh: refreshVaultMarketData };
}
