import type { ChartSeries } from "@/components/shared/Chart";
const dates = [
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-10-31",
  "2026-11-01",
  "2026-11-02",
];
const line = (name: string, color: string, values: number[]): ChartSeries => ({
  name,
  color,
  logo: `/assets/${name.toLowerCase()}.png`,
  values: values.map((value, i) => ({ time: dates[i], value })),
});
// Seven-day fixed comparison fixtures. Not live protocol rates.
export const primeSeries = [
  line("Morpho", "#37d9f0", [5.3, 5.55, 5.25, 5.52, 5.2, 5.43, 5.6]),
  line("Aave", "#be8af5", [4.95, 4.68, 4.96, 4.56, 4.86, 4.64, 4.9]),
  line("Compound", "#50e9a1", [4, 4.3, 4.08, 4.3, 3.9, 4.25, 4.03]),
];
export const boostSeries = [
  line("Uniswap", "#f34ba1", [8.4, 9.2, 8.4, 9.5, 8.5, 9.2, 8.9]),
];
