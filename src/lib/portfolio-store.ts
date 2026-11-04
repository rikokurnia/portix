"use client";
import { useSyncExternalStore } from "react";
import { stockIds, type StockId, type VaultId } from "./assets";
import type { Address, Hash } from "viem";
export interface VaultPosition {
  id: string;
  vaultId: VaultId;
  stockId: StockId;
  collateral: number;
  shares: number;
  rawShares: string;
  earnedYield: number;
  ltv: number;
  healthy: boolean;
}
export type ActivityType =
  | "Buy"
  | "Sell"
  | "Deposit"
  | "Withdraw"
  | "Faucet"
  | "Approve";
export interface Activity {
  transport?: "substrate";
  fromBlock?:number;
  blockHash?:Hash;
  legacy?: boolean;
  id: Hash;
  hash: Hash;
  type: ActivityType;
  stockId: StockId | "pUSDC";
  amount: number;
  vaultId?: VaultId;
  timestamp: string;
  status: "Pending" | "Completed" | "Failed";
}
export interface PortfolioState {
  legacyStock: string;
  legacyShares: string;
  observedAt: number;
  stockReady: Partial<Record<StockId, boolean>>;
  positionsReady: boolean;
  address?: Address;
  pUSDC: number;
  stockBalances: Record<StockId, number>;
  rawStockBalances: Record<StockId, string>;
  prices: Partial<Record<StockId, number>>;
  feeBps?: number;
  positions: VaultPosition[];
  activity: Activity[];
  ready: boolean;
  refreshing: boolean;
  error: string;
  pending: string;
}
const emptyBalances = () =>
  Object.fromEntries(stockIds.map((id) => [id, 0])) as Record<StockId, number>;
export const initialState: PortfolioState = {
  legacyStock: "0", legacyShares: "0",
  observedAt: 0,
  stockReady: {},
  positionsReady: false,
  pUSDC: 0,
  stockBalances: emptyBalances(),
  rawStockBalances: Object.fromEntries(
    stockIds.map((id) => [id, "0"]),
  ) as Record<StockId, string>,
  prices: {},
  positions: [],
  activity: [],
  ready: false,
  refreshing: false,
  error: "",
  pending: "",
};
let state = initialState;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getPortfolioSnapshot = () => state;
export function updatePortfolio(next: Partial<PortfolioState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}
const storageKey = (owner: string) =>
  `portix:activity:420420777:${owner.toLowerCase()}`;
export function setPortfolioAccount(owner?: Address) {
  if (state.address?.toLowerCase() === owner?.toLowerCase()) return;
  let activity: Activity[] = [];
  if (owner) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(owner)) ?? "[]");
      if (Array.isArray(saved))
        activity = saved
          .filter(
            (a: Activity) =>
              /^0x[\da-f]{64}$/i.test(a.hash) &&
              a.id === a.hash &&
              [
                "Buy",
                "Sell",
                "Deposit",
                "Withdraw",
                "Faucet",
                "Approve",
              ].includes(a.type) &&
              ["Pending", "Completed", "Failed"].includes(a.status) &&
              (a.stockId === "pUSDC" || stockIds.includes(a.stockId)) &&
              Number.isFinite(a.amount) &&
              a.amount >= 0 &&
              Number.isFinite(Date.parse(a.timestamp)),
          )
          .slice(0, 200);
    } catch {
      /* Storage is optional; chain balances are always fetched again. */
    }
  }
  updatePortfolio({
    ...initialState,
    prices: state.prices,
    feeBps: state.feeBps,
    address: owner,
    activity,
  });
}
export function recordActivity(owner: Address, event: Activity) {
  const selected = state.address?.toLowerCase() === owner.toLowerCase();
  let previous = selected ? state.activity : [];
  if (!selected)
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(owner)) ?? "[]");
      if (Array.isArray(saved)) previous = saved;
    } catch {
      /* Optional persistence. */
    }
  const activity = [
    event,
    ...previous.filter((a) => a.hash !== event.hash),
  ].slice(0, 200);
  if (selected) updatePortfolio({ activity });
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(activity));
  } catch {
    /* Optional persistence. */
  }
}
export type ActionResult =
  | { ok: true; hash: Hash }
  | { ok: false; error: string };
export type PortfolioCommand = (
  | { type: "Buy"; stockId: StockId; amount: number; spend?: number }
  | { type: "Sell"; stockId: StockId; amount: number; rawAmount?: string }
  | {
      type: "Deposit" | "Withdraw";
      vaultId: VaultId;
      stockId: StockId;
      amount: number;
      rawAmount?: string;
    }
  | { type: "Faucet"; stockId: "pUSDC"; amount: number }) & { legacy?: boolean };
let execute: ((command: PortfolioCommand) => Promise<ActionResult>) | undefined;
export function registerPortfolioExecutor(fn: typeof execute) {
  execute = fn;
}
async function run(command: PortfolioCommand): Promise<ActionResult> {
  if (!execute || !state.address)
    return { ok: false, error: "Connect your wallet to continue." };
  if (!Number.isFinite(command.amount) || command.amount <= 0)
    return { ok: false, error: "Enter a positive amount." };
  if (state.pending)
    return { ok: false, error: "Finish the current wallet request first." };
  return execute(command);
}
export const portfolioActions = {
  buyStock: (stockId: StockId, amount: number, spend?: number) =>
    run({ type: "Buy", stockId, amount, spend }),
  sellStock: (stockId: StockId, amount: number | string) =>
    run({
      type: "Sell",
      stockId,
      amount: Number(amount),
      rawAmount: String(amount),
    }),
  depositToVault: (
    vaultId: VaultId,
    stockId: StockId,
    amount: number | string,
  ) =>
    run({
      type: "Deposit",
      vaultId,
      stockId,
      amount: Number(amount),
      rawAmount: String(amount),
    }),
  withdrawFromVault: (
    vaultId: VaultId,
    stockId: StockId,
    amount: number | string,
  ) =>
    run({
      type: "Withdraw",
      vaultId,
      stockId,
      amount: Number(amount),
      rawAmount: String(amount),
    }),
  claimFaucet: () => run({ type: "Faucet", stockId: "pUSDC", amount: 5000 }),
};
export const {
  buyStock,
  sellStock,
  depositToVault,
  withdrawFromVault,
  claimFaucet,
} = portfolioActions;
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

// Explicit legacy demo commands never claim independent equity accounting.
export const runLegacyCommand = (command: PortfolioCommand) => run({...command, legacy: true});
