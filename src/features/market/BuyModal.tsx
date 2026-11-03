"use client";

import { useState } from "react";
import { ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { usePortfolio } from "@/lib/portfolio-store";
import { MARKET_STOCKS } from "./fixtures";
import { calculateBuy, formatUSD, formatStockUnits } from "./calculations";
import type { MarketStockId } from "./types";

interface BuyModalProps {
  stockId: MarketStockId;
  onClose: () => void;
}

export function BuyModal({ stockId, onClose }: BuyModalProps) {
  const { pUSDC, buyStock } = usePortfolio();
  const stock = MARKET_STOCKS[stockId];

  // Default input ($300.00 if affordable, else available pUSDC balance)
  const [spendStr, setSpendStr] = useState<string>(
    pUSDC >= 300 ? "300.00" : pUSDC > 0 ? pUSDC.toFixed(2) : "",
  );
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    stockQuantity: number;
    totalPayment: number;
  } | null>(null);

  const spendNum = Number(spendStr);
  const calc = calculateBuy(spendNum, stock.price);

  const isValidInput =
    Number.isFinite(spendNum) &&
    spendNum > 0 &&
    /^\d*\.?\d{0,2}$/.test(spendStr) &&
    spendNum <= pUSDC &&
    calc.stockQuantity > 0;

  const isInsufficient = Number.isFinite(spendNum) && spendNum > pUSDC;

  const handleShortcut = (pct: number) => {
    if (pUSDC <= 0) return;
    const amount = Math.floor(pUSDC * (pct / 100) * 100) / 100;
    setSpendStr(amount.toFixed(2));
    setError("");
  };

  // Direct buy execution — no intermediate review confirmation popup
  const handleDirectBuy = () => {
    if (!isValidInput) {
      if (isInsufficient) {
        setError("Insufficient pUSDC balance.");
      } else {
        setError("Please enter a valid payment amount.");
      }
      return;
    }

    if (calc.stockQuantity <= 0) {
      setError("Amount too small to purchase stock.");
      return;
    }

    setIsProcessing(true);
    setError("");

    // Directly execute buy order via shared portfolio store
    const result = buyStock(stockId, calc.stockQuantity, calc.totalPayment);
    if (result.ok) {
      setSuccessInfo({
        stockQuantity: calc.stockQuantity,
        totalPayment: calc.totalPayment,
      });
      setTimeout(() => {
        onClose();
      }, 1400);
    } else {
      setError(result.error);
      setIsProcessing(false);
    }
  };

  const modalTitle = (
    <div className="trade-modal-title">
      <img src={stock.logo} alt="" width={28} height={28} />
      <span>Buy {stock.id}</span>
    </div>
  );

  return (
    <Modal title={modalTitle} onClose={onClose}>
      {successInfo ? (
        <div className="trade-success" role="status" aria-live="polite">
          <CheckCircle2 size={46} color="#2dd4bf" />
          <h3>Purchase Executed!</h3>
          <p>
            Acquired <b>{formatStockUnits(successInfo.stockQuantity)} {stock.id}</b> for{" "}
            <b>{formatUSD(successInfo.totalPayment)}</b> pUSDC.
          </p>
        </div>
      ) : (
        <div>
          {/* Section 1: You pay */}
          <div>
            <label htmlFor="buy-pay-input" className="trade-section-label">
              You pay
            </label>
            <div className="trade-input-row">
              <input
                id="buy-pay-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={spendStr}
                onChange={(e) => {
                  setSpendStr(e.target.value);
                  setError("");
                }}
              />
              <span className="trade-currency">pUSDC</span>
            </div>

            <div className="trade-balance-row">
              Balance{" "}
              {new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(pUSDC)}{" "}
              pUSDC
            </div>

            <div
              className="trade-shortcuts"
              role="group"
              aria-label="Percentage shortcuts"
            >
              <button type="button" onClick={() => handleShortcut(25)}>
                25%
              </button>
              <button type="button" onClick={() => handleShortcut(50)}>
                50%
              </button>
              <button type="button" onClick={() => handleShortcut(100)}>
                Max
              </button>
            </div>
          </div>

          {/* Divider with Swap Icon */}
          <div className="trade-divider" aria-hidden="true">
            <div className="trade-divider-icon">
              <ArrowUpDown size={14} />
            </div>
          </div>

          {/* Section 2: You receive */}
          <div>
            <span className="trade-section-label">You receive</span>
            <div className="trade-output-row">
              <span className="trade-output-value">
                {formatStockUnits(calc.stockQuantity)}
              </span>
              <div className="trade-output-asset">
                <img src={stock.logo} alt="" width={26} height={26} />
                <span>{stock.id}</span>
              </div>
            </div>
          </div>

          {/* Real-time Order Summary */}
          <div className="trade-review-box">
            <h4>Review</h4>
            <dl style={{ margin: 0 }}>
              <div className="trade-review-row">
                <dt>Price per share</dt>
                <dd>{stock.price.toFixed(2)} pUSDC</dd>
              </div>
              <div className="trade-review-row">
                <dt>Estimated fee (0.10%)</dt>
                <dd>{calc.fee.toFixed(2)} pUSDC</dd>
              </div>
              <div className="trade-review-row">
                <dt>Total payment</dt>
                <dd>{calc.totalPayment.toFixed(2)} pUSDC</dd>
              </div>
            </dl>
          </div>

          {error && (
            <p className="trade-error" role="alert">
              {error}
            </p>
          )}

          {isInsufficient && !error && (
            <p className="trade-error" role="alert">
              Insufficient pUSDC balance.
            </p>
          )}

          {/* Direct Instant Action — No Review Modal */}
          <div className="trade-actions">
            <button
              type="button"
              className="trade-btn-confirm"
              disabled={!isValidInput || isProcessing}
              onClick={handleDirectBuy}
            >
              {isProcessing ? "Processing..." : `Buy ${stock.id}`}
            </button>
            <button
              type="button"
              className="trade-btn-cancel"
              disabled={isProcessing}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
