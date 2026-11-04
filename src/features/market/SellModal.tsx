"use client";
import { CarryOrder } from "@/features/carry/CarryOrder";
import { isolatedAccounting } from "@/lib/onchain/contracts";
import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";

export function SellModal({ stockId, onClose }: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  if(!isolatedAccounting)return <CarryOrder mode="Sell" onClose={onClose}/>;
  return <TradeModal stockId={stockId} mode="Sell" onClose={onClose} />;
}
