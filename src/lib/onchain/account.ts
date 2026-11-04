import { formatUnits, type Address } from "viem";
import { stockIds, type StockId, type VaultId } from "@/lib/assets";
import type { VaultPosition } from "@/lib/portfolio-store";
import {
  contracts,
  publicClient,
  stockAddress,
  vaultAddress,
  tokenAbi,
  vaultAbi,
  oracleAbi,
  marketAbi,
} from "./contracts";
export const human = (value: bigint, decimals: number) =>
  Number(formatUnits(value, decimals));
export async function readMarket() {
  const prices: Partial<Record<StockId, number>> = {};
  const tasks = stockIds.map(async (id) => {
    const token = stockAddress(id);
    if (!token || !contracts.oracle) return;
    const raw = (await publicClient.readContract({
      address: contracts.oracle,
      abi: oracleAbi,
      functionName: "getPriceUSD",
      args: [token],
    })) as bigint;
    prices[id] = human(raw, 6);
  });
  const results = await Promise.allSettled(tasks);
  let feeBps: number | undefined;
  let feeError = false;
  if (contracts.market)
    try {
      feeBps = Number(
        await publicClient.readContract({
          address: contracts.market,
          abi: marketAbi,
          functionName: "feeBps",
        }),
      );
    } catch {
      feeError = true;
    }
  return {
    prices,
    feeBps,
    priceError: feeError || results.some((r) => r.status === "rejected"),
  };
}
export async function readAccount(owner: Address) {
  if (!contracts.pUSDC) throw new Error("Missing settlement address.");
  const pUSDC = human(
    await publicClient.readContract({
      address: contracts.pUSDC,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [owner],
    }),
    6,
  );
  const balances = await Promise.allSettled(
    stockIds.map(async (id) => {
      const token = stockAddress(id);
      const raw = token
        ? await publicClient.readContract({
            address: token,
            abi: tokenAbi,
            functionName: "balanceOf",
            args: [owner],
          })
        : 0n;
      return [id, raw] as const;
    }),
  );
  const positions = await Promise.allSettled(
    stockIds.flatMap((stockId) =>
      (["pxPrime", "pxBoost"] as VaultId[]).map(async (vaultId) => {
        const target = vaultAddress(vaultId, stockId);
        if (!target) return undefined;
        const shares = await publicClient.readContract({
          address: target,
          abi: tokenAbi,
          functionName: "balanceOf",
          args: [owner],
        });
        if (shares === 0n) return undefined;
        const [preview, metrics] = await Promise.all([
          publicClient.readContract({
            address: target,
            abi: vaultAbi,
            functionName: "previewWithdrawCarry",
            args: [shares],
          }) as Promise<readonly bigint[]>,
          publicClient.readContract({
            address: target,
            abi: vaultAbi,
            functionName: "getVaultMetrics",
          }) as Promise<
            readonly [bigint, bigint, bigint, bigint, bigint, boolean]
          >,
        ]);
        return {
          id: `${vaultId}-${stockId}`,
          vaultId,
          stockId,
          shares: human(shares, 18),
          rawShares: formatUnits(shares, 18),
          collateral: human(preview[0], 18),
          earnedYield: human(preview[3], 6),
          ltv: Number(metrics[4]) / 100,
          healthy: metrics[5],
        } satisfies VaultPosition;
      }),
    ),
  );
  const validBalances = balances.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : ([stockIds[index], 0n] as const),
  );
  const stockReady = Object.fromEntries(
    balances.map((result, index) => [
      stockIds[index],
      !!stockAddress(stockIds[index]) && result.status === "fulfilled",
    ]),
  ) as Record<StockId, boolean>;
  return {
    pUSDC,
    stockReady,
    positionsReady: positions.every((r) => r.status === "fulfilled"),
    stockBalances: Object.fromEntries(
      validBalances.map(([id, raw]) => [id, human(raw, 18)]),
    ) as Record<StockId, number>,
    rawStockBalances: Object.fromEntries(
      validBalances.map(([id, raw]) => [id, formatUnits(raw, 18)]),
    ) as Record<StockId, string>,
    positions: positions.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    ),
  };
}
