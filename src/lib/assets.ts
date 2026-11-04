export const assets = {
  logo: "/assets/logo.png",
  background: "/assets/video-bg.mp4",
  backgroundStill: "/assets/background.jpg",
  pxPrime: "/assets/vault-prime.png",
  pxBoost: "/assets/vault-boost.png",
} as const;
export const stockIds = [
  "AAPL",
  "GOOGL",
  "NFLX",
  "MSFT",
  "META",
  "SPY",
  "QQQ",
  "NVDA",
] as const;
export type StockId = (typeof stockIds)[number];
export type VaultId = "pxPrime" | "pxBoost";
// Identity metadata only. Prices, shares and balances come from deployed contracts.
export const stocks: Record<
  StockId,
  { name: string; logo: string }
> = {
  AAPL: { name: "Apple", logo: "/assets/AAPL.png" },
  GOOGL: { name: "Alphabet", logo: "/assets/GOOGL.png" },
  NFLX: { name: "Netflix", logo: "/assets/NFLX.png" },
  MSFT: { name: "Microsoft", logo: "/assets/MSFT.png" },
  META: { name: "Meta", logo: "/assets/META.png" },
  SPY: { name: "SPDR S&P 500 ETF", logo: "/assets/SPY.png" },
  QQQ: { name: "Invesco QQQ Trust", logo: "/assets/QQQ.png" },
  NVDA: { name: "NVIDIA", logo: "/assets/NVDA.png" },
};
export const vaults = {
  pxPrime: {
    description:
      "Earn automated yield by deploying tokenized stocks into diversified lending pools.",
  },
  pxBoost: {
    description:
      "Leverage borrowed liquidity in AMM pools to maximize trading fee yields.",
  },
} as const;
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const units = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n);
