import { legacyAddress, legacyAbi, legacySharesSlot, isLegacyRuntime } from "./legacy";
import { formatUnits, type Address } from "viem";
import { stockIds, type StockId, type VaultId } from "@/lib/assets";
import type { VaultPosition } from "@/lib/portfolio-store";
import {
  isolatedAccounting,
  contracts,
  publicClient,
  stockAddress,
  tokenAbi,
  vaultAbi,
  oracleAbi,
  marketAbi,
} from "./contracts";
export const human = (value: bigint, decimals: number) =>
  Number(formatUnits(value, decimals));
export async function readMarket() {
  if (!isolatedAccounting) return { prices: {}, feeBps: undefined, priceError: true };
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
  if (!isolatedAccounting) {
    if (!isLegacyRuntime(await publicClient.getCode({address:legacyAddress}))) throw new Error("Legacy runtime changed");
    const [legacyStock, legacyShares] = await Promise.all([
      publicClient.readContract({address:legacyAddress,abi:legacyAbi,functionName:"balanceOf",args:[owner]}),
      publicClient.getStorageAt({address:legacyAddress,slot:legacySharesSlot(owner)}),
    ]);
    return {
      legacyStock:formatUnits(legacyStock,18), legacyShares:formatUnits(BigInt(legacyShares ?? "0x0"),18),
      pUSDC,
      stockReady: Object.fromEntries(
        stockIds.map((id) => [id, false]),
      ) as Record<StockId, boolean>,
      positionsReady: false,
      stockBalances: Object.fromEntries(
        stockIds.map((id) => [id, 0]),
      ) as Record<StockId, number>,
      rawStockBalances: Object.fromEntries(
        stockIds.map((id) => [id, "0"]),
      ) as Record<StockId, string>,
      positions: [] as VaultPosition[],
    };
  }
  const [onchainStockBalRes, onchainSharesRes] = await Promise.allSettled([
    publicClient.readContract({
      address: legacyAddress,
      abi: legacyAbi,
      functionName: "balanceOf",
      args: [owner],
    }),
    publicClient.getStorageAt({
      address: legacyAddress,
      slot: legacySharesSlot(owner),
    }),
  ]);
  const onchainStockBal =
    onchainStockBalRes.status === "fulfilled"
      ? (onchainStockBalRes.value as bigint)
      : 0n;
  const onchainShares =
    onchainSharesRes.status === "fulfilled" && onchainSharesRes.value
      ? BigInt(onchainSharesRes.value)
      : 0n;

  let activities: {
    type?: string;
    stockId?: string;
    vaultId?: string;
    amount?: number;
    status?: string;
  }[] = [];
  if (typeof window !== "undefined") {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`portix:activity:420420777:${owner.toLowerCase()}`) ?? "[]",
      );
      if (Array.isArray(saved)) activities = saved;
    } catch {
      /* Storage unavailable */
    }
  }

  const boughtStocks = activities
    .filter(
      (a) =>
        (a.type === "Buy" || a.type === "Deposit" || a.type === "Withdraw") &&
        a.stockId &&
        a.stockId !== "pUSDC" &&
        stockIds.includes(a.stockId as StockId),
    )
    .map((a) => a.stockId as StockId);

  const activeStock: StockId = boughtStocks[0] ?? "AAPL";

  const stockBalances = Object.fromEntries(
    stockIds.map((id) => [id, 0]),
  ) as Record<StockId, number>;
  const rawStockBalances = Object.fromEntries(
    stockIds.map((id) => [id, "0"]),
  ) as Record<StockId, string>;
  const stockReady = Object.fromEntries(
    stockIds.map((id) => [id, true]),
  ) as Record<StockId, boolean>;

  if (onchainStockBal > 0n) {
    const uniqueBought = Array.from(new Set(boughtStocks));
    if (uniqueBought.length <= 1) {
      stockBalances[activeStock] = human(onchainStockBal, 18);
      rawStockBalances[activeStock] = formatUnits(onchainStockBal, 18);
    } else {
      let totalEst = 0;
      const netPerStock: Partial<Record<StockId, number>> = {};
      for (const id of uniqueBought) {
        let net = 0;
        for (const a of activities) {
          if (a.stockId === id && a.status === "Completed") {
            if (a.type === "Buy") net += a.amount ?? 0;
            else if (a.type === "Sell") net -= a.amount ?? 0;
            else if (a.type === "Deposit") net -= a.amount ?? 0;
            else if (a.type === "Withdraw") net += a.amount ?? 0;
          }
        }
        if (net > 0) {
          netPerStock[id] = net;
          totalEst += net;
        }
      }
      if (totalEst > 0) {
        const onchainNum = human(onchainStockBal, 18);
        for (const [id, net] of Object.entries(netPerStock)) {
          const ratio = (net as number) / totalEst;
          const assigned = Math.round(onchainNum * ratio * 1e6) / 1e6;
          stockBalances[id as StockId] = assigned;
          rawStockBalances[id as StockId] = assigned.toFixed(18);
        }
      } else {
        stockBalances[activeStock] = human(onchainStockBal, 18);
        rawStockBalances[activeStock] = formatUnits(onchainStockBal, 18);
      }
    }
  }

  let positions: VaultPosition[] = [];
  if (onchainShares > 0n) {
    const depositAct = activities.find(
      (a) => a.type === "Deposit" && a.status === "Completed",
    );
    const targetVaultId: VaultId =
      depositAct?.vaultId === "pxBoost" ? "pxBoost" : "pxPrime";
    const targetStockId: StockId =
      depositAct?.stockId &&
      depositAct.stockId !== "pUSDC" &&
      stockIds.includes(depositAct.stockId as StockId)
        ? (depositAct.stockId as StockId)
        : activeStock;

    try {
      const [preview, metrics] = await Promise.all([
        publicClient.readContract({
          address: legacyAddress,
          abi: legacyAbi,
          functionName: "previewWithdrawCarry",
          args: [onchainShares],
        }) as Promise<readonly bigint[]>,
        publicClient.readContract({
          address: legacyAddress,
          abi: vaultAbi,
          functionName: "getVaultMetrics",
        }) as Promise<
          readonly [bigint, bigint, bigint, bigint, bigint, boolean]
        >,
      ]);
      positions = [
        {
          id: `${targetVaultId}-${targetStockId}`,
          vaultId: targetVaultId,
          stockId: targetStockId,
          shares: human(onchainShares, 18),
          rawShares: formatUnits(onchainShares, 18),
          collateral: human(preview[0], 18),
          earnedYield: human(preview[3], 6),
          ltv: Number(metrics[4]) / 100,
          healthy: metrics[5],
        },
      ];
    } catch {
      positions = [
        {
          id: `${targetVaultId}-${targetStockId}`,
          vaultId: targetVaultId,
          stockId: targetStockId,
          shares: human(onchainShares, 18),
          rawShares: formatUnits(onchainShares, 18),
          collateral: human(onchainShares / 3n, 18),
          earnedYield: 0,
          ltv: 40,
          healthy: true,
        },
      ];
    }
  }

  return {
    pUSDC,
    stockReady,
    positionsReady: true,
    stockBalances,
    rawStockBalances,
    positions,
  };
}
