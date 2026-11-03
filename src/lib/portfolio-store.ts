"use client";
import { useSyncExternalStore } from "react";
import { stocks, vaults, type StockId, type VaultId } from "./assets";
import {
  calculateBuy,
  calculateSell,
  TRADING_FEE_RATE,
} from "./trade-calculations";
export interface VaultPosition {
  id: string;
  vaultId: VaultId;
  stockId: StockId;
  collateral: number;
  shares: number;
  earnedYield: number;
}
export interface Activity {
  id: string;
  type: "Buy" | "Sell" | "Deposit" | "Withdraw";
  stockId: StockId;
  amount: number;
  vaultId?: VaultId;
  timestamp: string;
  status: "Completed";
}
export interface PortfolioState {
  pUSDC: number;
  stockBalances: Record<StockId, number>;
  positions: VaultPosition[];
  activity: Activity[];
}
export type ActionResult = { ok: true } | { ok: false; error: string };
// One in-memory account per browser tab. SSR always reads this immutable initial snapshot.
export const initialState: PortfolioState = {
  pUSDC: 2500,
  stockBalances: {
    AAPL: 4,
    GOOGL: 5,
    NFLX: 8,
    MSFT: 2,
    META: 1,
    SPY: 3,
    QQQ: 2,
    NVDA: 15,
  },
  positions: [
    {
      id: "pxPrime-GOOGL",
      vaultId: "pxPrime",
      stockId: "GOOGL",
      collateral: 2.5,
      shares: (2.5 * stocks.GOOGL.price) / vaults.pxPrime.sharePrice,
      earnedYield: 12.6,
    },
    {
      id: "pxBoost-AAPL",
      vaultId: "pxBoost",
      stockId: "AAPL",
      collateral: 4,
      shares: (4 * stocks.AAPL.price) / vaults.pxBoost.sharePrice,
      earnedYield: 5.82,
    },
  ],
  activity: [],
};
let state = initialState;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const valid = (n: number) =>
  Number.isFinite(n) && n > 0 && Math.abs(n - round(n)) < 1e-9;
function commit(
  next: PortfolioState,
  event: Omit<Activity, "id" | "timestamp" | "status">,
): ActionResult {
  state = {
    ...next,
    activity: [
      {
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: "Completed",
      },
      ...state.activity,
    ],
  };
  listeners.forEach((fn) => fn());
  return { ok: true };
}
const fail = (error: string): ActionResult => ({ ok: false, error });
export const portfolioActions = {
  buyStock(
    stockId: StockId,
    amount: number,
    totalPayment?: number,
  ): ActionResult {
    if (!stocks[stockId] || !valid(amount))
      return fail("Enter a positive amount with up to 6 decimals.");
    const gross = round(amount * stocks[stockId].price);
    const cost =
      totalPayment === undefined
        ? round(gross + Math.round(gross * TRADING_FEE_RATE * 100) / 100)
        : totalPayment;
    if (totalPayment !== undefined) {
      const quote = calculateBuy(totalPayment, stocks[stockId].price);
      if (
        !Number.isFinite(totalPayment) ||
        totalPayment <= 0 ||
        Math.abs(totalPayment * 100 - Math.round(totalPayment * 100)) > 1e-6 ||
        Math.abs(quote.stockQuantity - amount) > 1e-9
      )
        return fail("The payment no longer matches the stock quote.");
    }
    if (cost > state.pUSDC) return fail("Insufficient pUSDC balance.");
    return commit(
      {
        ...state,
        pUSDC: round(state.pUSDC - cost),
        stockBalances: {
          ...state.stockBalances,
          [stockId]: round(state.stockBalances[stockId] + amount),
        },
      },
      { type: "Buy", stockId, amount },
    );
  },
  sellStock(stockId: StockId, amount: number): ActionResult {
    if (!stocks[stockId] || !valid(amount))
      return fail("Enter a positive amount with up to 6 decimals.");
    if (amount > state.stockBalances[stockId])
      return fail("Insufficient stock balance.");
    return commit(
      {
        ...state,
        pUSDC: round(
          state.pUSDC + calculateSell(amount, stocks[stockId].price).netPayout,
        ),
        stockBalances: {
          ...state.stockBalances,
          [stockId]: round(state.stockBalances[stockId] - amount),
        },
      },
      { type: "Sell", stockId, amount },
    );
  },
  depositToVault(
    vaultId: VaultId,
    stockId: StockId,
    amount: number,
  ): ActionResult {
    if (!vaults[vaultId] || !stocks[stockId] || !valid(amount))
      return fail("Enter a positive amount with up to 6 decimals.");
    if (amount > state.stockBalances[stockId])
      return fail("Insufficient stock balance.");
    const shares = round(
      (amount * stocks[stockId].price) / vaults[vaultId].sharePrice,
    );
    const id = `${vaultId}-${stockId}`;
    const current = state.positions.find((p) => p.id === id);
    const position: VaultPosition = current
      ? {
          ...current,
          collateral: round(current.collateral + amount),
          shares: round(current.shares + shares),
        }
      : { id, vaultId, stockId, collateral: amount, shares, earnedYield: 0 };
    return commit(
      {
        ...state,
        stockBalances: {
          ...state.stockBalances,
          [stockId]: round(state.stockBalances[stockId] - amount),
        },
        positions: [...state.positions.filter((p) => p.id !== id), position],
      },
      { type: "Deposit", stockId, amount, vaultId },
    );
  },
  withdrawFromVault(
    vaultId: VaultId,
    stockId: StockId,
    shares: number,
  ): ActionResult {
    if (!valid(shares))
      return fail("Enter a positive share amount with up to 6 decimals.");
    const p = state.positions.find(
      (p) => p.vaultId === vaultId && p.stockId === stockId,
    );
    if (!p || shares > p.shares + 1e-9)
      return fail("Insufficient vault shares.");
    const ratio = Math.min(1, shares / p.shares),
      amount = p.collateral * ratio;
    return commit(
      {
        ...state,
        pUSDC: round(state.pUSDC + p.earnedYield * ratio),
        stockBalances: {
          ...state.stockBalances,
          [stockId]: round(state.stockBalances[stockId] + amount),
        },
        positions: state.positions.flatMap((x) =>
          x.id !== p.id
            ? [x]
            : ratio >= 1 - 1e-9
              ? []
              : [
                  {
                    ...p,
                    collateral: p.collateral - amount,
                    shares: p.shares - shares,
                    earnedYield: p.earnedYield * (1 - ratio),
                  },
                ],
        ),
      },
      { type: "Withdraw", stockId, amount, vaultId },
    );
  },
};
export const { buyStock, sellStock, depositToVault, withdrawFromVault } =
  portfolioActions;
export const getPortfolioSnapshot = () => state;
export function usePortfolio() {
  return {
    ...useSyncExternalStore(
      subscribe,
      () => state,
      () => initialState,
    ),
    ...portfolioActions,
  };
}
