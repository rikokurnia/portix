"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import { MARKET_STOCKS, MARKET_STOCK_IDS } from "./stocks";
import { formatUSD, formatPercent } from "./calculations";
import type { MarketStockId } from "./types";

interface StockQuote {
  price: number;
  change: number;
  changePercent: number;
}

interface MarketStockListProps {
  selectedStockId: MarketStockId;
  onSelectStock: (id: MarketStockId) => void;
}

export function MarketStockList({
  selectedStockId,
  onSelectStock,
}: MarketStockListProps) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});

  useEffect(() => {
    let active = true;

    async function loadQuotes() {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.stocks) {
          setQuotes(data.stocks);
        }
      } catch {
        // Fallback to static base quotes
      }
    }

    void loadQuotes();

    // Poll live quotes every 5 seconds for real-time price updates
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        void loadQuotes();
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

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
          const quote = quotes[id];

          const displayPrice = quote?.price ?? stock.price;
          const displayChangePercent = quote?.changePercent ?? stock.changePercent;
          const isPositive = displayChangePercent >= 0;

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
                  {formatUSD(displayPrice)}
                </span>
                <span
                  className={`market-stock-change ${
                    isPositive ? "positive" : "negative"
                  }`}
                >
                  {formatPercent(displayChangePercent)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
