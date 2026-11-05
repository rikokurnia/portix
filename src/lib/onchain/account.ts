import { legacyAddress, legacyAbi, legacySharesSlot, isLegacyRuntime } from "./legacy";
import { formatUnits, type Address } from "viem";
import { stockIds, type StockId } from "@/lib/assets";
import { sharedLedger } from "@/lib/shared-ledger";
import type { Activity } from "@/lib/portfolio-store";
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
  if (!isolatedAccounting) return { prices: {}, settlementPrices:{}, feeBps: undefined, priceError: true };
  const prices: Partial<Record<StockId, number>> = {};
  const settlementPrices: Partial<Record<StockId,number>> = {};

  // 1. Fetch live market prices from benchmark feed to match chart
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/market");
      if (res.ok) {
        const data = await res.json();
        if (data?.stocks) {
          for (const [id, item] of Object.entries(data.stocks) as [StockId, { price?: number }][]) {
            if (typeof item?.price === "number" && item.price > 0) {
              prices[id] = item.price;
            }
          }
        }
      }
    } catch {
      // fallback will populate from onchain or baseline
    }
  }

  // 2. Query on-chain oracle contracts
  const tasks = stockIds.map(async (id) => {
    const token = stockAddress(id);
    if (!token || !contracts.oracle) return;
    try {
      const raw = (await publicClient.readContract({
        address: contracts.oracle,
        abi: oracleAbi,
        functionName: "getPriceUSD",
        args: [token],
      })) as bigint;
      const onchainPrice = human(raw, 6);
      if(onchainPrice>0)settlementPrices[id]=onchainPrice;
    } catch {
      // keep market feed price
    }
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
    settlementPrices,
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

  let activities: Activity[] = [];
  if (typeof window !== "undefined") {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`portix:activity:420420777:${owner.toLowerCase()}`) ?? "[]",
      );
      if (Array.isArray(saved)) activities = saved.filter(a=>a?.status === "Completed");
    } catch {
      /* Storage unavailable */
    }
  }

  if(onchainStockBalRes.status === "rejected" || onchainSharesRes.status === "rejected")throw new Error("Shared balances could not be read");
  const ledger=sharedLedger(activities,onchainStockBal,onchainShares);
  const stockBalances=Object.fromEntries(stockIds.map(id=>[id,human(ledger.stocks[id],18)])) as Record<StockId,number>;
  const rawStockBalances=Object.fromEntries(stockIds.map(id=>[id,formatUnits(ledger.stocks[id],18)])) as Record<StockId,string>;
  const stockReady=Object.fromEntries(stockIds.map(id=>[id,true])) as Record<StockId,boolean>;
  const metrics=onchainShares>0n?await publicClient.readContract({address:legacyAddress,abi:vaultAbi,functionName:"getVaultMetrics"}) as readonly [bigint,bigint,bigint,bigint,bigint,boolean]:undefined;
  const positions:VaultPosition[]=await Promise.all(ledger.positions.map(async p=>{
    const preview=await publicClient.readContract({address:legacyAddress,abi:legacyAbi,functionName:"previewWithdrawCarry",args:[p.shares]});
    return {id:`${p.vaultId}-${p.stockId}`,vaultId:p.vaultId,stockId:p.stockId,shares:human(p.shares,18),rawShares:formatUnits(p.shares,18),collateral:human(preview[0],18),rawCollateral:formatUnits(preview[0],18),earnedYield:0,withdrawalBonus:human(preview[3],6),ltv:metrics?Number(metrics[4])/100:0,healthy:metrics?.[5]??false};
  }));

  return {
    pUSDC,
    stockReady,
    positionsReady: true,
    stockBalances,
    rawStockBalances,
    positions,
  };
}
