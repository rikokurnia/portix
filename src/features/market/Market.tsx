'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { MarketStockList } from './MarketStockList';
import { BuyModal } from './BuyModal';
import { SellModal } from './SellModal';
import { ContractsModal } from './ContractsModal';
import type { MarketStockId } from './types';
import './market.css';

// Dynamically load MarketChart to guarantee clean client-side canvas mounting without SSR issues
const MarketChart = dynamic(
  () => import('./MarketChart').then((m) => m.MarketChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="panel market-chart-panel"
        style={{ minHeight: 460, display: 'grid', placeItems: 'center' }}
      >
        <span className="muted">Loading market chart...</span>
      </div>
    ),
  }
);

export function Market() {
  const [selectedStockId, setSelectedStockId] = useState<MarketStockId>('AAPL');
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isContractsOpen, setIsContractsOpen] = useState(false);
  const router = useRouter();

  return (
    <main className="market-page">
      {/* Header and Mode Selector */}
      <div className="market-hero">
        <div className="market-hero-left">
          <h1>Market</h1>
          <p>Trade synthetic equities & ETFs on Portaldot Network V3. Put them to work.</p>
        </div>

        <div className="market-hero-right">
          {/* Trading Mode Indicator: Clarifying Spot focus vs Futures */}
          <div className="market-mode-selector" role="group" aria-label="Market trading mode">
            <button
              type="button"
              className="market-mode-pill active"
              title="1x Spot synthetic stock trading active"
            >
              <span className="market-mode-dot live" />
              <span>Spot (1x)</span>
            </button>
            <button
              type="button"
              className="market-mode-pill disabled"
              title="Perpetual futures with leverage coming in V2"
              disabled
            >
              <span className="market-mode-dot soon" />
              <span>Perps / Futures</span>
              <small className="market-soon-tag">V2</small>
            </button>
          </div>

          <button
            type="button"
            className="market-contracts-badge-btn"
            onClick={() => setIsContractsOpen(true)}
            title="Inspect Portaldot V3 EVM Testnet Contracts"
          >
            <ShieldCheck size={14} color="#2dd4bf" />
            <span>Portaldot V3 Contracts</span>
          </button>
        </div>
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
          onEarn={() => router.push(`/vault/pxPrime?stock=${selectedStockId}`)}
          onOpenContracts={() => setIsContractsOpen(true)}
        />
      </div>

      {/* Buy Modal: Instant direct buy, no review popup */}
      {isBuyOpen && (
        <BuyModal
          stockId={selectedStockId}
          onClose={() => setIsBuyOpen(false)}
        />
      )}

      {/* Sell Modal: Spot liquidation to pUSDC */}
      {isSellOpen && (
        <SellModal
          stockId={selectedStockId}
          onClose={() => setIsSellOpen(false)}
        />
      )}

      {/* Contract plan modal */}
      {isContractsOpen && (
        <ContractsModal
          onClose={() => setIsContractsOpen(false)}
        />
      )}
    </main>
  );
}
