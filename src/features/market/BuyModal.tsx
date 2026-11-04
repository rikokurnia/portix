"use client";
import { CarryOrder } from "@/features/carry/CarryOrder";
import { isolatedAccounting } from "@/lib/onchain/contracts";
import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";

export function BuyModal({ stockId, onClose }: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  if(!isolatedAccounting)return <CarryOrder mode="Buy" onClose={onClose}/>;
  return <TradeModal stockId={stockId} mode="Buy" onClose={onClose} />;
}
