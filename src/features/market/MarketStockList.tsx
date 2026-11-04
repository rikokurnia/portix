"use client";

import { usePortfolio } from "@/lib/portfolio-store";
import { Panel } from "@/components/shared/Panel";
import { MARKET_STOCKS, MARKET_STOCK_IDS } from "./stocks";
import { formatUSD } from "./calculations";
import type { MarketStockId } from "./types";

interface MarketStockListProps {
  selectedStockId: MarketStockId;
  onSelectStock: (id: MarketStockId) => void;
}

export function MarketStockList({
  selectedStockId,
  onSelectStock,
}: MarketStockListProps) {
  const { prices } = usePortfolio();
  return (
    <Panel className="market-stocks-panel">
      <h2>Stocks</h2>
      <div
        className="market-stocks-list"
        role="radiogroup"
        aria-label="Available tokenized stocks and ETFs"
      >
        {MARKET_STOCK_IDS.map((id) => {
          const stock = MARKET_STOCKS[id];
          const isSelected = selectedStockId === id;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`market-stock-item ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectStock(id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onSelectStock(id);
                }
              }}
            >
              <div className="market-stock-left">
                <img
                  src={stock.logo}
                  alt={`${stock.name} logo`}
                  className="market-stock-logo"
                  width={32}
                  height={32}
                />
                <div className="market-stock-ticker">
                  <strong>{stock.id}</strong>
                  <span>{stock.name}</span>
                </div>
              </div>
              <div className="market-stock-right">
                <span className="market-stock-price">
                  {prices[id] ? formatUSD(prices[id]!) : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
