"use client";

import { isolatedAccounting } from "@/lib/onchain/contracts";
import { useState } from "react";
import dynamic from "next/dynamic";
import { MarketStockList } from "./MarketStockList";
import { BuyModal } from "./BuyModal";
import { SellModal } from "./SellModal";
import { MarketEarnModal } from "./MarketEarnModal";
import type { MarketStockId } from "./types";
import type { VaultId } from "@/lib/assets";
import "./market.css";

// Dynamically load MarketChart to guarantee clean client-side canvas mounting without SSR issues
const MarketChart = dynamic(
  () => import("./MarketChart").then((m) => m.MarketChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="panel market-chart-panel"
        style={{ minHeight: 460, display: "grid", placeItems: "center" }}
      >
        <span className="muted">Loading market chart...</span>
      </div>
    ),
  },
);

export function Market() {
  const [selectedStockId, setSelectedStockId] = useState<MarketStockId>("AAPL");
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [earnVault, setEarnVault] = useState<VaultId | null>(null);

  return (
    <main className="market-page">
      {/* Centered Minimal Header matching market-dashboard.png */}
      <div className="market-hero">
        <h1>Market</h1>
        <p>{isolatedAccounting?"Trade stocks. Put them to work.":"Equity benchmarks. Trade the shared testnet asset with pUSDC."}</p>
      </div>

      {/* Main 2-Column Layout */}
      <div className="market-layout">
        {/* Left Column: Stocks List (~30%) */}
        <MarketStockList
          selectedStockId={selectedStockId}
          onSelectStock={(id) => setSelectedStockId(id)}
        />

        {/* Right Column: Chart & Actions (~70%) */}
        <MarketChart
          stockId={selectedStockId}
          onBuy={() => setIsBuyOpen(true)}
          onSell={() => setIsSellOpen(true)}
          onEarn={(vaultId) => setEarnVault(vaultId ?? "pxBoost")}
        />
      </div>

      {/* Buy Modal: Direct instant buy without popup review */}
      {isBuyOpen && (
        <BuyModal
          stockId={selectedStockId}
          onClose={() => setIsBuyOpen(false)}
        />
      )}

      {/* Sell Modal */}
      {isSellOpen && (
        <SellModal
          stockId={selectedStockId}
          onClose={() => setIsSellOpen(false)}
        />
      )}

      {/* Earn Modal: 1-Click Zap & Auto-Deploy to Carry Vault */}
      {earnVault && (
        <MarketEarnModal
          stockId={selectedStockId}
          initialVaultId={earnVault}
          onClose={() => setEarnVault(null)}
        />
      )}
    </main>
  );
}
