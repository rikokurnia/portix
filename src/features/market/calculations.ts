import type { CandleData, MovingAveragePoint } from "./types";

/**
 * Calculates a Simple Moving Average (SMA) from close prices.
 * Preceding candles are used to ensure the moving average is mathematically
 * sound and valid from the earliest visible candle without synthetic decorative curves.
 */
export function calculateSMA(
  candles: CandleData[],
  period: number,
): MovingAveragePoint[] {
  if (candles.length < period) return [];

  const points: MovingAveragePoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const avg = Math.round((sum / period) * 100) / 100;
    points.push({
      time: candles[i].time,
      value: avg,
    });
  }

  return points;
}

// One quote implementation for Market previews and account settlement.
export {
  TRADING_FEE_RATE,
  calculateBuy,
  calculateSell,
} from "@/lib/trade-calculations";
export type { BuyCalculation, SellCalculation } from "@/lib/trade-calculations";

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatStockUnits(value: number, maxDecimals = 6): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
