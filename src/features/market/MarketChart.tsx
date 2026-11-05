"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { RotateCcw, ExternalLink } from "lucide-react";
import { useStockHistory } from "./useStockHistory";
import { assets } from "@/lib/assets";
import { explorerContract, stockAddress } from "@/lib/onchain/contracts";
import { MARKET_STOCKS } from "./stocks";
import { calculateSMA, formatUSD, formatPercent } from "./calculations";
import type { MarketStockId, Timeframe } from "./types";

interface MarketChartProps {
  stockId: MarketStockId;
  onBuy: () => void;
  onSell: () => void;
  onEarn: () => void;
}

export function MarketChart({
  stockId,
  onBuy,
  onSell,
  onEarn,
}: MarketChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [showVol, setShowVol] = useState(true);
  const [showMA5, setShowMA5] = useState(true);
  const [showMA10, setShowMA10] = useState(true);

  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  const stock = MARKET_STOCKS[stockId];
  const history = useStockHistory(stockId, timeframe);
  const candles = history.candles;

  const currentPrice = history.price;
  const currentChangePercent = history.changePercent;
  const isPositive = currentChangePercent >= 0;

  const handleResetView = () => {
    if (!chartInstanceRef.current || candles.length === 0) return;
    const total = candles.length;
    chartInstanceRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, total - 55),
      to: total + 3,
    });
  };

  useEffect(() => {
    if (!hostRef.current || candles.length === 0) return;

    // Moving average data computed mathematically from close prices
    const ma5Data = calculateSMA(candles, 5);
    const ma10Data = calculateSMA(candles, 10);

    // Create Lightweight Chart instance with interactive pan and scale enabled
    const chart = createChart(hostRef.current, {
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#cbb6eb",
        fontFamily: "'Portix Sans', Arial, Helvetica, sans-serif",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#9582b520", style: LineStyle.Dotted },
        horzLines: { color: "#9582b530", style: LineStyle.Dotted },
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
        borderColor: "#9582b545",
        timeVisible: timeframe === "1D",
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        vertLine: {
          color: "#be8af560",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2d1e4e",
        },
        horzLine: {
          color: "#be8af560",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2d1e4e",
        },
      },
      // Panning and scaling enabled for dragging backwards into past history
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      localization: {
        priceFormatter: (p: number) => `$${p.toFixed(2)}`,
      },
    });

    chartInstanceRef.current = chart;

    // 1. Candlestick series (Restrained mint & coral)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#2dd4bf",
      downColor: "#f87171",
      borderUpColor: "#2dd4bf",
      borderDownColor: "#f87171",
      wickUpColor: "#2dd4bf",
      wickDownColor: "#f87171",
      priceScaleId: "left",
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#2dd4bf",
      priceLineStyle: LineStyle.Dotted,
    });
    candleSeries.setData(candles);

    // 2. Volume histogram series (Compact at bottom)
    let volSeries: ISeriesApi<"Histogram"> | null = null;
    if (showVol) {
      volSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      volSeries.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume ?? 10000,
          color: c.close >= c.open ? "#2dd4bf55" : "#f8717155",
        })),
      );
    }

    // 3. Moving Average 5 Series (Warm gold)
    let ma5Series: ISeriesApi<"Line"> | null = null;
    if (showMA5 && ma5Data.length > 0) {
      ma5Series = chart.addSeries(LineSeries, {
        color: "#f4b64f",
        lineWidth: 2,
        priceScaleId: "left",
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });
      ma5Series.setData(ma5Data);
    }

    // 4. Moving Average 10 Series (Lavender)
    let ma10Series: ISeriesApi<"Line"> | null = null;
    if (showMA10 && ma10Data.length > 0) {
      ma10Series = chart.addSeries(LineSeries, {
        color: "#be8af5",
        lineWidth: 2,
        priceScaleId: "left",
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });
      ma10Series.setData(ma10Data);
    }

    // Initialize visible window to latest 55 candles
    const totalCandles = candles.length;
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, totalCandles - 55),
      to: totalCandles + 3,
    });

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

      const timeStr =
        typeof param.time === "object"
          ? `${param.time.year}-${String(param.time.month).padStart(2, "0")}-${String(param.time.day).padStart(2, "0")}`
          : typeof param.time === "number"
            ? new Date(param.time * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
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
    });

    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [candles, timeframe, showVol, showMA5, showMA10]);

  return (
    <div className="panel market-chart-panel">
      {/* Top Header Row: Clean Logo, Ticker, Name, Price, Daily Change, Live Pulse */}
      <div className="market-chart-header">
        <div className="market-chart-identity">
          <img
            src={stock.logo}
            alt={`${stock.name} logo`}
            width={38}
            height={38}
          />
          <div className="market-chart-ticker">
            <h2>{stock.id}</h2>
            <span>{stock.name}</span>
          </div>
        </div>

        <div className="market-chart-divider" aria-hidden="true" />

        <div className="market-chart-price-block">
          <span className="market-chart-price">
            {currentPrice > 0 ? formatUSD(currentPrice) : "—"}
          </span>
          <span
            className={`market-chart-change ${isPositive ? "positive" : "negative"}`}
          >
            {currentPrice > 0 ? formatPercent(currentChangePercent) : "—"}
          </span>
        </div>

        {stockAddress(stock.id) && (
          <a
            href={explorerContract(stockAddress(stock.id)!)}
            target="_blank"
            rel="noreferrer"
            className="market-contract-badge"
            title={`On-chain stock contract: ${stockAddress(stock.id)}`}
          >
            <img src="/assets/portaldot.png" alt="Portaldot" width={16} height={16} />
            <span>
              {stockAddress(stock.id)!.slice(0, 6)}…{stockAddress(stock.id)!.slice(-4)}
            </span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Controls Row: Timeframe Pills, Reset Button & Indicator Toggles */}
      <div className="market-chart-controls">
        <div className="market-chart-left-controls">
          <div
            className="market-timeframe-group"
            role="tablist"
            aria-label="Chart timeframes"
          >
            {(["1D", "1W", "1M"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                role="tab"
                aria-selected={timeframe === tf}
                className={`market-timeframe-button ${timeframe === tf ? "active" : ""}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="market-chart-reset-btn"
            title="Reset chart view to latest candles"
            onClick={handleResetView}
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>
        </div>

        <div
          className="market-indicators-group"
          role="toolbar"
          aria-label="Chart indicators"
        >
          <button
            type="button"
            aria-pressed={showVol}
            className={`market-indicator-toggle ${showVol ? "" : "inactive"}`}
            onClick={() => setShowVol((prev) => !prev)}
          >
            <i className="market-indicator-dot vol" />
            <span>Vol</span>
          </button>

          <button
            type="button"
            aria-pressed={showMA5}
            className={`market-indicator-toggle ${showMA5 ? "" : "inactive"}`}
            onClick={() => setShowMA5((prev) => !prev)}
          >
            <i className="market-indicator-dot ma5" />
            <span>MA 5</span>
          </button>

          <button
            type="button"
            aria-pressed={showMA10}
            className={`market-indicator-toggle ${showMA10 ? "" : "inactive"}`}
            onClick={() => setShowMA10((prev) => !prev)}
          >
            <i className="market-indicator-dot ma10" />
            <span>MA 10</span>
          </button>
        </div>
      </div>

      {/* Lightweight Charts Canvas Viewport */}
      <div
        className="market-chart-viewport"
        aria-label={`${stock.name} candlestick chart`}
      >
        <div ref={hostRef} style={{ cursor: "grab" }} />
        {candles.length === 0 && (
          <div className="market-history-empty" role="status">
            <span>{history.error || "Loading market benchmark…"}</span>
          </div>
        )}
        <div ref={tooltipRef} className="market-chart-tooltip" hidden />
      </div>

      {/* Three Main Actions Row (Below Chart) */}
      <div className="market-action-row">
        <button type="button" className="button market-btn-buy" onClick={onBuy}>
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
