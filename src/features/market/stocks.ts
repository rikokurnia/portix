import { stocks, stockIds } from "@/lib/assets";
export const MARKET_STOCK_IDS = [...stockIds];
export const MARKET_STOCKS = Object.fromEntries(
  stockIds.map((id) => [id, { ...stocks[id], id }]),
) as { [K in (typeof stockIds)[number]]: (typeof stocks)[K] & { id: K } };
