import type { VaultId } from "./assets";
export type ProtocolId = "morpho" | "aave" | "compound" | "uniswap";
export interface YieldPoint {
  time: string;
  apy: number;
  tvl: number;
  timestamp: string;
}
export interface ProtocolConfig {
  id: ProtocolId;
  name: string;
  color: string;
  logo: string;
  pool: string;
  chain: "Base" | "Ethereum";
  symbol: string;
  strategy: string;
  contract: string;
  contractRole: string;
  docs: string;
  contractSource: string;
}
export const protocols: Record<ProtocolId, ProtocolConfig> = {
  morpho: {
    id: "morpho",
    name: "Morpho",
    color: "#37d9f0",
    logo: "/assets/morpho.png",
    pool: "ba68527f-8ec2-4c55-827a-8f4673ae047c",
    chain: "Base",
    symbol: "STEAKUSDC",
    strategy:
      "Isolated USDC lending markets with collateral-specific risk parameters.",
    contract: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    contractRole: "Morpho Blue core",
    docs: "https://docs.morpho.org/get-started/resources/addresses/",
    contractSource: "https://docs.morpho.org/get-started/resources/addresses/",
  },
  aave: {
    id: "aave",
    name: "Aave",
    color: "#be8af5",
    logo: "/assets/aave.png",
    pool: "aa70268e-4b52-42bf-a116-608b370f9501",
    chain: "Ethereum",
    symbol: "USDC",
    strategy:
      "USDC supplied to Aave V3 earns interest from overcollateralized borrowing.",
    contract: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    contractRole: "Aave V3 Ethereum Pool",
    docs: "https://aave.com/docs/resources/addresses",
    contractSource:
      "https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Ethereum.sol",
  },
  compound: {
    id: "compound",
    name: "Compound",
    color: "#50e9a1",
    logo: "/assets/compound.png",
    pool: "7da72d09-56ca-4ec5-a45f-59114353e487",
    chain: "Ethereum",
    symbol: "USDC",
    strategy:
      "USDC supplied to Compound III accrues interest through its Comet market.",
    contract: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    contractRole: "Compound III USDC Comet",
    docs: "https://docs.compound.finance/",
    contractSource:
      "https://github.com/compound-finance/comet/blob/main/deployments/mainnet/usdc/roots.json",
  },
  uniswap: {
    id: "uniswap",
    name: "Uniswap",
    color: "#f34ba1",
    logo: "/assets/uniswap.png",
    pool: "665dc8bc-c79d-4800-97f7-304bf368e547",
    chain: "Ethereum",
    symbol: "USDC / WETH · 0.05%",
    strategy:
      "Concentrated liquidity in the USDC / WETH 0.05% pool earns swap fees. Returns depend on volume and active price ranges.",
    contract: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    contractRole: "Uniswap V3 Factory",
    docs: "https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments",
    contractSource:
      "https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments",
  },
};
export const vaultProtocols: Record<VaultId, ProtocolId[]> = {
  pxPrime: ["morpho", "aave", "compound"],
  pxBoost: ["uniswap"],
};
export const yieldEndpoint = (id: ProtocolId) =>
  `https://yields.llama.fi/chart/${protocols[id].pool}`;
// Public benchmark rates, not PORTIX realized returns. Deduplicate UTC dates for Lightweight Charts.
export function normalizeYieldHistory(
  input: unknown,
  id: ProtocolId,
): YieldPoint[] {
  if (!Array.isArray(input)) throw new Error("Invalid yield history");
  const byDay = new Map<string, YieldPoint>();
  const rows = input
    .flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const r = row as Record<string, unknown>;
      const apy = id === "uniswap" ? r.apyBase : r.apy;
      if (
        typeof r.timestamp !== "string" ||
        !Number.isFinite(Date.parse(r.timestamp)) ||
        typeof apy !== "number" ||
        !Number.isFinite(apy) ||
        apy < 0 ||
        typeof r.tvlUsd !== "number" ||
        !Number.isFinite(r.tvlUsd) ||
        r.tvlUsd < 0
      )
        return [];
      return [
        {
          time: new Date(r.timestamp).toISOString().slice(0, 10),
          apy,
          tvl: r.tvlUsd,
          timestamp: r.timestamp,
        },
      ];
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  rows.forEach((row) => byDay.set(row.time, row));
  if (!byDay.size) throw new Error("No usable yield observations");
  return [...byDay.values()];
}
export function summarizeVault(
  vaultId: VaultId,
  histories: Partial<Record<ProtocolId, YieldPoint[]>>,
) {
  const ids = vaultProtocols[vaultId];
  const latest = ids.map((id) => histories[id]?.at(-1));
  if (latest.some((p) => !p)) return null;
  const points = latest as YieldPoint[],
    tvl = points.reduce((s, p) => s + p.tvl, 0);
  return {
    apy: tvl
      ? points.reduce((s, p) => s + p.apy * p.tvl, 0) / tvl
      : points.reduce((s, p) => s + p.apy, 0) / points.length,
    tvl,
    updatedAt: points.map((p) => p.timestamp).sort()[0],
  };
}

export const formatBenchmarkTVL = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
