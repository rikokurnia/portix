import { TradeModal } from "./TradeModal";
import type { MarketStockId } from "./types";
export function BuyModal(props: {
  stockId: MarketStockId;
  onClose: () => void;
}) {
  return <TradeModal {...props} mode="Buy" />;
}
