import {
  createPublicClient,
  http,
  isAddress,
  zeroAddress,
  parseAbi,
  type Address,
} from "viem";
import { portaldot } from "@/features/wallet/chain";
import manifest from "./addresses.json";
import market from "./StockMarket.abi.json";
import vault from "./PortixVault.abi.json";
import oracle from "./PortixPriceOracle.abi.json";
import type { Abi } from "viem";
import type { StockId, VaultId } from "@/lib/assets";

// Public deployment configuration only. Never import environment files or signing keys here.
export { manifest };
export const publicClient = createPublicClient({
  chain: portaldot,
  transport: http(
    typeof window === "undefined"
      ? portaldot.rpcUrls.default.http[0]
      : "/api/rpc",
    { timeout: 15_000, retryCount: 1 },
  ),
});
export const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function faucet(address,uint256)",
]);
export const stockBoughtAbi = parseAbi([
  "event StockBought(address indexed buyer,address indexed stock,uint256 stockAmount,uint256 usdcPaid,uint256 feePaid)",
]);
export const marketAbi = market as Abi;
export const vaultAbi = vault as Abi;
export const oracleAbi = oracle as Abi;
export function address(value: string | undefined): Address | undefined {
  return value && isAddress(value) && value.toLowerCase() !== zeroAddress
    ? (value as Address)
    : undefined;
}
export const contracts = {
  pUSDC: address(manifest.contracts.pUSDC),
  market: address(manifest.contracts.stockMarket),
  oracle: address(manifest.contracts.priceOracle),
  factory: address(manifest.contracts.vaultFactory),
  debtPool: address(manifest.contracts.debtPool),
};
export const stockAddress = (id: StockId) => address(manifest.stocks[id].token);
export const vaultAddress = (id: VaultId, stock: StockId) =>
  address(
    manifest.stocks[stock][id === "pxPrime" ? "primeVault" : "boostVault"],
  );
// The supplied ERC-4626 interface requires separate readable stock/vault balances.
// Reusing one balanceOf() address for every asset would fabricate duplicate positions.
const stockTargets = Object.values(manifest.stocks).map((s) =>
  s.token.toLowerCase(),
);
const vaultTargets = Object.values(manifest.stocks).flatMap((s) => [
  s.primeVault.toLowerCase(),
  s.boostVault.toLowerCase(),
]);
export const isolatedAccounting =
  new Set(stockTargets).size === stockTargets.length &&
  new Set(vaultTargets).size === vaultTargets.length;
export const vaultIntegrationIssue = isolatedAccounting
  ? ""
  : "This deployment needs compatible vault balance accounting before deposits can open.";
export const explorerTransaction = (hash: string) =>
  `${portaldot.blockExplorers.default.url}#/extrinsics/${hash}`;
export const explorerContract = (value: string) =>
  `${portaldot.blockExplorers.default.url}#/contracts/${value}`;
export function requireAddress(
  value: Address | undefined,
  label: string,
): Address {
  if (!value) throw new Error(`${label} is awaiting its deployment address.`);
  return value;
}
export function transactionError(error: unknown): string {
  // Never surface serialized RPC requests, provider credentials or full wallet errors.
  const e = error as {
    code?: number;
    shortMessage?: string;
    name?: string;
    cause?: unknown;
  };
  if (e?.code === 4001 || e?.name === "UserRejectedRequestError")
    return "Request declined in your wallet.";
  const text = e?.shortMessage ?? (error instanceof Error ? error.message : "");
  if (/reject|denied|cancelled/i.test(text))
    return "Request declined in your wallet.";
  if (/insufficient funds|gas.*balance/i.test(text))
    return "Not enough tPOT for network fees. Fund this wallet and try again.";
  if (/stale/i.test(text))
    return "The stock oracle needs a fresh price. Please try again after it updates.";
  if (/timeout|timed out/i.test(text))
    return "Confirmation is taking longer than expected. Check Activity before trying again.";
  if (/awaiting its deployment address/.test(text)) return text;
  if (/liquidity/i.test(text))
    return "The pool does not have enough liquidity for this amount.";
  if (/chain|network/i.test(text))
    return "Switch your wallet to Portaldot V3 and try again.";
  return "The transaction could not be completed. Check your wallet and try again.";
}
