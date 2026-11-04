"use client";
import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";

export function SellModal({ stockId, onClose }: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  return <TradeModal stockId={stockId} mode="Sell" onClose={onClose} />;
}
