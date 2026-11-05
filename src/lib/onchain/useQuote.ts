"use client";
import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import type { StockId, VaultId } from "@/lib/assets";
import {
  isolatedAccounting,
  publicClient,
  contracts,
  stockAddress,
  vaultAddress,
  marketAbi,
  vaultAbi,
  transactionError,
} from "./contracts";
import { human } from "./account";
import { usePortfolio } from "@/lib/portfolio-store";
import { calculateBuy } from "@/lib/trade-calculations";
import { legacyAbi, legacyAddress } from "./legacy";
export interface Quote {
  receive: number;
  value: number;
  fee: number;
  borrow: number;
  yield: number;
}
export function useQuote(
  mode: "Buy" | "Sell" | "Deposit" | "Withdraw",
  stock: StockId,
  input: string,
  vault?: VaultId,
) {
  const account = usePortfolio();
  const [state, setState] = useState<{
    key: string;
    quote?: Quote;
    error?: string;
  }>({ key: "" });
  const price = account.settlementPrices[stock],
    feeBps = account.feeBps;
  const key = [
    mode,
    stock,
    input,
    vault,
    price,
    feeBps,
    account.observedAt,
  ].join(":");
  const configured =
    isolatedAccounting &&
    !!stockAddress(stock) &&
    (mode === "Buy" || mode === "Sell"
      ? !!contracts.market && !!contracts.oracle
      : isolatedAccounting && !!vault && !!vaultAddress(vault, stock));
  useEffect(() => {
    let active = true;
    if (
      !configured ||
      !(mode === "Buy" ? /^\d*\.?\d{0,6}$/ : /^\d*\.?\d{0,18}$/).test(input) ||
      !(Number(input) > 0)
    )
      return;
    const timer = window.setTimeout(async () => {
      try {
        let quote: Quote;
        if (mode === "Buy") {
          if (!price || feeBps === undefined)
            throw new Error("Price unavailable.");
          const calc = calculateBuy(Number(input), price, feeBps);
          quote = {
            receive: calc.stockQuantity,
            value: calc.totalPayment,
            fee: calc.fee,
            borrow: 0,
            yield: 0,
          };
        } else if (mode === "Sell") {
          const raw = (await publicClient.readContract({
            address: contracts.market!,
            abi: marketAbi,
            functionName: "quoteSell",
            args: [stockAddress(stock)!, parseUnits(input, 18)],
          })) as readonly bigint[];
          quote = {
            receive: human(raw[2], 6),
            value: human(raw[0], 6),
            fee: human(raw[1], 6),
            borrow: 0,
            yield: 0,
          };
        } else {
          const raw = (await publicClient.readContract({
            address: vaultAddress(vault!, stock)!,
            abi: vaultAddress(vault!,stock)?.toLowerCase()===legacyAddress.toLowerCase()?legacyAbi:vaultAbi,
            functionName:
              mode === "Deposit"
                ? "previewDepositCarry"
                : "previewWithdrawCarry",
            args: [parseUnits(input, 18)],
          })) as readonly bigint[];
          quote =
            mode === "Deposit"
              ? {
                  receive: human(raw[0], 18),
                  value: human(raw[1], 6),
                  borrow: human(raw[2], 6),
                  fee: 0,
                  yield: 0,
                }
              : {
                  receive: human(raw[0], 18),
                  value: price ? human(raw[0], 18) * price : 0,
                  borrow: human(raw[1], 6),
                  yield: human(raw[3], 6),
                  fee: 0,
                };
        }
        if (active) setState({ key, quote });
      } catch (error) {
        if (active) setState({ key, error: transactionError(error) });
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [configured, input, key, mode, stock, vault, price, feeBps]);
  return {
    configured,
    quote: state.key === key ? state.quote : undefined,
    error: state.key === key ? state.error : undefined,
  };
}
