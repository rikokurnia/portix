export const assets = {
  logo: "/assets/logo.png",
  background: "/assets/video-bg.mp4",
  backgroundStill: "/assets/background.jpg",
  pxPrime: "/assets/vault-prime.png",
  pxBoost: "/assets/vault-boost.png",
} as const;
export const stockIds = ["AAPL", "GOOGL", "NFLX", "MSFT", "META"] as const;
export type StockId = (typeof stockIds)[number];
export type VaultId = "pxPrime" | "pxBoost";
// Fixed product fixtures, not live market quotes. All USD prices and yields are illustrative.
export const stocks: Record<
  StockId,
  { name: string; price: number; logo: string }
> = {
  AAPL: { name: "Apple", price: 300, logo: "/assets/AAPL.png" },
  GOOGL: { name: "Alphabet", price: 300, logo: "/assets/GOOGL.png" },
  NFLX: { name: "Netflix", price: 120, logo: "/assets/NFLX.png" },
  MSFT: { name: "Microsoft", price: 510, logo: "/assets/MSFT.png" },
  META: { name: "Meta", price: 720, logo: "/assets/META.png" },
};
export const vaults = {
  pxPrime: {
    apy: 4.8,
    sharePrice: 100,
    description:
      "Put your stocks to work through diversified stablecoin lending.",
  },
  pxBoost: {
    apy: 8.1,
    sharePrice: 125,
    description:
      "Deploy borrowed liquidity into AMM pools to earn trading fees.",
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
