'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DepositModal } from '@/features/vault/DepositModal';
import { MarketStockList } from './MarketStockList';
import { BuyModal } from './BuyModal';
import { SellModal } from './SellModal';
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
  const [isEarnOpen, setIsEarnOpen] = useState(false);

  return (
    <main className="market-page">
      {/* Minimal Header and Subtitle */}
      <div className="market-hero">
        <h1>Market</h1>
        <p>Trade stocks. Put them to work.</p>
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
          onEarn={() => setIsEarnOpen(true)}
        />
      </div>

      {/* Buy Modal */}
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

      {/* Earn Modal: Reuses Agent 1's shared pxPrime Deposit flow */}
      {isEarnOpen && (
        <DepositModal
          vaultId="pxPrime"
          initialStock={selectedStockId}
          initialMode="Deposit"
          onClose={() => setIsEarnOpen(false)}
        />
      )}
    </main>
  );
}
