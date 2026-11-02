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

  // Default input matching market-popup-confirmation.png ($300.00 if affordable, else balance)
  const [spendStr, setSpendStr] = useState<string>(
    pUSDC >= 300 ? "300.00" : pUSDC > 0 ? pUSDC.toFixed(2) : "",
  );
  const [step, setStep] = useState<"edit" | "done">("edit");
  const [error, setError] = useState<string>("");

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

  const handleConfirm = () => {
    if (!isValidInput) {
      if (isInsufficient) {
        setError("Insufficient pUSDC balance.");
      } else {
        setError("Please enter a valid amount.");
      }
      return;
    }

    if (calc.stockQuantity <= 0) {
      setError("Amount too small to purchase stock.");
      return;
    }

    // Call store action with the calculated stock quantity
    const result = buyStock(stockId, calc.stockQuantity, calc.totalPayment);
    if (result.ok) {
      setStep("done");
    } else {
      setError(result.error);
    }
  };

  const modalTitle =
    step === "done" ? (
      "Order executed"
    ) : (
      <div className="trade-modal-title">
        <img src={stock.logo} alt="" width={28} height={28} />
        <span>Buy {stock.id}</span>
      </div>
    );

  return (
    <Modal title={modalTitle} onClose={onClose}>
      {step === "done" ? (
        <div className="trade-success">
          <CheckCircle2 size={48} />
          <h3>Stock acquired!</h3>
          <p>
            Successfully purchased {formatStockUnits(calc.stockQuantity)}{" "}
            {stock.id} for {formatUSD(calc.totalPayment)} pUSDC.
          </p>
          <button
            type="button"
            className="button market-btn-buy"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Close
          </button>
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

          {/* Section 3: Review */}
          <div className="trade-review-box">
            <h4>Review</h4>
            <dl style={{ margin: 0 }}>
              <div className="trade-review-row">
                <dt>Price per share</dt>
                <dd>{stock.price.toFixed(2)} pUSDC</dd>
              </div>
              <div className="trade-review-row">
                <dt>Estimated fee</dt>
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

          {/* Actions */}
          <div className="trade-actions">
            <button
              type="button"
              className="trade-btn-confirm"
              disabled={!isValidInput}
              onClick={handleConfirm}
            >
              Confirm buy
            </button>
            <button
              type="button"
              className="trade-btn-cancel"
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
