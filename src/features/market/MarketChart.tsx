'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { assets } from '@/lib/assets';
import { MARKET_STOCKS, MARKET_FIXTURE_DATA } from './fixtures';
import { calculateSMA, formatUSD, formatPercent } from './calculations';
import type { MarketStockId, Timeframe } from './types';

interface MarketChartProps {
  stockId: MarketStockId;
  onBuy: () => void;
  onSell: () => void;
  onEarn: () => void;
}

export function MarketChart({ stockId, onBuy, onSell, onEarn }: MarketChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [showVol, setShowVol] = useState(true);
  const [showMA5, setShowMA5] = useState(true);
  const [showMA10, setShowMA10] = useState(true);

  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  const stock = MARKET_STOCKS[stockId];
  const isPositive = stock.change >= 0;

  useEffect(() => {
    if (!hostRef.current) return;

    // Active dataset for current stock & timeframe
    const candles = MARKET_FIXTURE_DATA[stockId][timeframe];
    const ma5Data = calculateSMA(candles, 5);
    const ma10Data = calculateSMA(candles, 10);

    // Create Lightweight Chart instance
    const chart = createChart(hostRef.current, {
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#cbb6eb',
        fontFamily: "'Portix Sans', Arial, Helvetica, sans-serif",
        fontSize: 12,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: '#9582b520', style: LineStyle.Dotted },
        horzLines: { color: '#9582b530', style: LineStyle.Dotted },
      },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.22 },
      },
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: '#9582b545',
        timeVisible: timeframe === '1D',
        secondsVisible: false,
        rightOffset: 3,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: {
          color: '#be8af560',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2d1e4e',
        },
        horzLine: {
          color: '#be8af560',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2d1e4e',
        },
      },
      handleScroll: false,
      handleScale: false,
      localization: {
        priceFormatter: (p: number) => `$${p.toFixed(2)}`,
      },
    });

    chartInstanceRef.current = chart;

    // 1. Candlestick series (Restrained mint & coral)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2dd4bf',
      downColor: '#f87171',
      borderUpColor: '#2dd4bf',
      borderDownColor: '#f87171',
      wickUpColor: '#2dd4bf',
      wickDownColor: '#f87171',
      priceScaleId: 'left',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#2dd4bf',
      priceLineStyle: LineStyle.Dotted,
    });
    candleSeries.setData(candles);

    // 2. Volume histogram series (Compact at bottom)
    const volSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    if (showVol) {
      volSeries.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? '#2dd4bf55' : '#f8717155',
        }))
      );
    }

    // 3. Moving Average 5 Series (Warm gold)
    let ma5Series: ISeriesApi<'Line'> | null = null;
    if (showMA5 && ma5Data.length > 0) {
      ma5Series = chart.addSeries(LineSeries, {
        color: '#f4b64f',
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });
      ma5Series.setData(ma5Data);
    }

    // 4. Moving Average 10 Series (Lavender)
    let ma10Series: ISeriesApi<'Line'> | null = null;
    if (showMA10 && ma10Data.length > 0) {
      ma10Series = chart.addSeries(LineSeries, {
        color: '#be8af5',
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });
      ma10Series.setData(ma10Data);
    }

    chart.timeScale().fitContent();

    // Crosshair tooltip subscription
    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.x > (hostRef.current?.clientWidth ?? 0) ||
        param.point.y < 0 ||
        param.point.y > 340
      ) {
        tooltip.hidden = true;
        return;
      }

      tooltip.hidden = false;
      const candleData = param.seriesData.get(candleSeries) as
        | { open?: number; high?: number; low?: number; close?: number }
        | undefined;
      const ma5Point = ma5Series
        ? (param.seriesData.get(ma5Series) as { value?: number } | undefined)
        : undefined;
      const ma10Point = ma10Series
        ? (param.seriesData.get(ma10Series) as { value?: number } | undefined)
        : undefined;

      const timeStr = typeof param.time === 'object'
        ? `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`
        : typeof param.time === 'number'
        ? new Date(param.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : String(param.time);

      let content = `<span>${timeStr}</span>`;
      if (candleData && candleData.open !== undefined) {
        content += ` · <span>O:</span> <b>$${candleData.open.toFixed(2)}</b> <span>H:</span> <b>$${candleData.high?.toFixed(2)}</b> <span>L:</span> <b>$${candleData.low?.toFixed(2)}</b> <span>C:</span> <b>$${candleData.close?.toFixed(2)}</b>`;
      }
      if (showMA5 && ma5Point && ma5Point.value !== undefined) {
        content += ` · <span class="badge-gold">MA5: $${ma5Point.value.toFixed(2)}</span>`;
      }
      if (showMA10 && ma10Point && ma10Point.value !== undefined) {
        content += ` · <span class="badge-lavender">MA10: $${ma10Point.value.toFixed(2)}</span>`;
      }

      tooltip.innerHTML = content;
    });

    // Resize observer with cleanup
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !hostRef.current) return;
      const newWidth = entries[0].contentRect.width;
      chart.resize(newWidth, 340);
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [stockId, timeframe, showVol, showMA5, showMA10]);

  return (
    <div className="panel market-chart-panel">
      {/* Top Header Row */}
      <div className="market-chart-header">
        <div className="market-chart-identity">
          <img src={stock.logo} alt={`${stock.name} logo`} width={38} height={38} />
          <div className="market-chart-ticker">
            <h2>{stock.id}</h2>
            <span>{stock.name}</span>
          </div>
        </div>

        <div className="market-chart-divider" aria-hidden="true" />

        <div className="market-chart-price-block">
          <span className="market-chart-price">{formatUSD(stock.price)}</span>
          <span
            className={`market-chart-change ${isPositive ? 'positive' : 'negative'}`}
          >
            {formatPercent(stock.changePercent)}
          </span>
        </div>
      </div>

      {/* Controls Row: Timeframe Pills & Indicator Toggles */}
      <div className="market-chart-controls">
        <div
          className="market-timeframe-group"
          role="tablist"
          aria-label="Chart timeframes"
        >
          {(['1D', '1W', '1M'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={timeframe === tf}
              className={`market-timeframe-button ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div
          className="market-indicators-group"
          role="toolbar"
          aria-label="Chart indicators"
        >
          <button
            type="button"
            aria-pressed={showVol}
            className={`market-indicator-toggle ${showVol ? '' : 'inactive'}`}
            onClick={() => setShowVol((prev) => !prev)}
          >
            <i className="market-indicator-dot vol" />
            <span>Vol</span>
          </button>

          <button
            type="button"
            aria-pressed={showMA5}
            className={`market-indicator-toggle ${showMA5 ? '' : 'inactive'}`}
            onClick={() => setShowMA5((prev) => !prev)}
          >
            <i className="market-indicator-dot ma5" />
            <span>MA 5</span>
          </button>

          <button
            type="button"
            aria-pressed={showMA10}
            className={`market-indicator-toggle ${showMA10 ? '' : 'inactive'}`}
            onClick={() => setShowMA10((prev) => !prev)}
          >
            <i className="market-indicator-dot ma10" />
            <span>MA 10</span>
          </button>
        </div>
      </div>

      {/* Lightweight Charts Canvas Viewport */}
      <div className="market-chart-viewport" aria-label={`${stock.name} candlestick chart`}>
        <div ref={hostRef} />
        <div ref={tooltipRef} className="market-chart-tooltip" hidden />
      </div>

      {/* Three Main Actions Row (Below Chart) */}
      <div className="market-action-row">
        <button
          type="button"
          className="button market-btn-buy"
          onClick={onBuy}
        >
          Buy
        </button>

        <button
          type="button"
          className="button market-btn-sell"
          onClick={onSell}
        >
          Sell
        </button>

        <div className="market-earn-wrapper">
          <button
            type="button"
            className="button market-btn-earn"
            onClick={onEarn}
          >
            <img src={assets.pxPrime} alt="" width={26} height={26} />
            <span>Earn</span>
          </button>
          <span className="market-earn-caption">via pxPrime</span>
        </div>
      </div>
    </div>
  );
}
