import type { CandleData, Timeframe } from "@/features/market/types";
import type { UTCTimestamp } from "lightweight-charts";
export interface OracleObservation {
  timestamp: number;
  price: number;
}
// Candles aggregate actual oracle observations. No interpolation and no invented trading volume.
export function aggregateObservations(
  observations: OracleObservation[],
  timeframe: Timeframe,
): CandleData[] {
  const interval = timeframe === "1D" ? 300 : timeframe === "1W" ? 3600 : 86400;
  const buckets = new Map<number, CandleData>();
  for (const point of [...observations].sort(
    (a, b) => a.timestamp - b.timestamp,
  )) {
    if (
      !Number.isFinite(point.timestamp) ||
      !Number.isFinite(point.price) ||
      point.price <= 0 ||
      point.timestamp <= 0
    )
      continue;
    const time = Math.floor(point.timestamp / interval) * interval;
    const current = buckets.get(time);
    buckets.set(
      time,
      current
        ? {
            ...current,
            high: Math.max(current.high, point.price),
            low: Math.min(current.low, point.price),
            close: point.price,
          }
        : {
            time: time as UTCTimestamp,
            open: point.price,
            high: point.price,
            low: point.price,
            close: point.price,
          },
    );
  }
  return [...buckets.values()];
}
export function dailyChange(
  observations: OracleObservation[],
  now = Date.now() / 1000,
): number | undefined {
  const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted.at(-1),
    previous = sorted.filter((p) => p.timestamp <= now - 86400).at(-1);
  return latest &&
    previous &&
    latest.timestamp >= now - 86400 &&
    previous.price > 0
    ? (latest.price / previous.price - 1) * 100
    : undefined;
}
