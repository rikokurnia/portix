'use client';

import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { MARKET_STOCKS, MARKET_STOCK_IDS } from './fixtures';
import { STOCK_TOKEN_CONTRACTS } from './contracts';
import { formatUSD, formatPercent } from './calculations';
import type { MarketStockId } from './types';

interface MarketStockListProps {
  selectedStockId: MarketStockId;
  onSelectStock: (id: MarketStockId) => void;
}

type CategoryFilter = 'All' | 'Big Tech' | 'Index ETF' | 'Semiconductors';

export function MarketStockList({ selectedStockId, onSelectStock }: MarketStockListProps) {
  const [filter, setFilter] = useState<CategoryFilter>('All');

  const filteredStockIds = MARKET_STOCK_IDS.filter((id) => {
    if (filter === 'All') return true;
    return STOCK_TOKEN_CONTRACTS[id].category === filter;
  });

  return (
    <Panel className="market-stocks-panel">
      <div className="market-stocks-header">
        <h2>Stocks & ETFs</h2>
        <span className="market-stocks-count">{MARKET_STOCK_IDS.length} Assets</span>
      </div>

      {/* Category filter pills */}
      <div className="market-category-filters" role="tablist" aria-label="Asset category filter">
        {(['All', 'Big Tech', 'Index ETF', 'Semiconductors'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={filter === cat}
            className={`market-cat-filter-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat === 'All' ? 'All' : cat === 'Big Tech' ? 'Tech' : cat === 'Index ETF' ? 'ETFs' : 'Semis'}
          </button>
        ))}
      </div>

      <div
        className="market-stocks-list"
        role="radiogroup"
        aria-label="Available tokenized stocks and ETFs"
      >
        {filteredStockIds.map((id) => {
          const stock = MARKET_STOCKS[id];
          const token = STOCK_TOKEN_CONTRACTS[id];
          const isSelected = selectedStockId === id;
          const isPositive = stock.change >= 0;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`market-stock-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectStock(id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
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
                  <div className="market-stock-ticker-row">
                    <strong>{stock.id}</strong>
                    <span className={`market-stock-badge ${token.category.toLowerCase().replace(/\s+/g, '-')}`}>
                      {token.category === 'Index ETF' ? 'ETF' : token.category === 'Semiconductors' ? 'CHIP' : 'EQUITY'}
                    </span>
                  </div>
                  <span>{stock.name}</span>
                </div>
              </div>
              <div className="market-stock-right">
                <span className="market-stock-price">{formatUSD(stock.price)}</span>
                <span
                  className={`market-stock-change ${isPositive ? 'positive' : 'negative'}`}
                >
                  {formatPercent(stock.changePercent)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
