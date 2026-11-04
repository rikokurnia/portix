"use client";
import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";

export function BuyModal({ stockId, onClose }: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  return <TradeModal stockId={stockId} mode="Buy" onClose={onClose} />;
}
