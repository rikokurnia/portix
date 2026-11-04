import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";
export function SellModal(props: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  return <TradeModal {...props} mode="Sell" />;
}
