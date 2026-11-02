"use client";

import { useState } from "react";
import { ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { usePortfolio } from "@/lib/portfolio-store";
import { MARKET_STOCKS } from "./fixtures";
import { calculateSell, formatUSD, formatStockUnits } from "./calculations";
import type { MarketStockId } from "./types";

interface SellModalProps {
  stockId: MarketStockId;
  onClose: () => void;
}

export function SellModal({ stockId, onClose }: SellModalProps) {
  const { stockBalances, sellStock } = usePortfolio();
  const stock = MARKET_STOCKS[stockId];
  const userBalance = stockBalances[stockId] ?? 0;

  const [amountStr, setAmountStr] = useState<string>(
    userBalance >= 1 ? "1.00" : userBalance > 0 ? userBalance.toString() : "",
  );
  const [step, setStep] = useState<"edit" | "done">("edit");
  const [error, setError] = useState<string>("");

  const amountNum = Number(amountStr);
  const calc = calculateSell(amountNum, stock.price);

  const isValidInput =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    /^\d*\.?\d{0,6}$/.test(amountStr) &&
    amountNum <= userBalance &&
    calc.netPayout > 0;

  const isInsufficient = Number.isFinite(amountNum) && amountNum > userBalance;

  const handleShortcut = (pct: number) => {
    if (userBalance <= 0) return;
    const amount = Math.floor(userBalance * (pct / 100) * 1e6) / 1e6;
    setAmountStr(amount.toString());
    setError("");
  };

  const handleConfirm = () => {
    if (!isValidInput) {
      if (isInsufficient) {
        setError(`Insufficient ${stock.id} balance.`);
      } else {
        setError("Please enter a valid stock amount.");
      }
      return;
    }

    const result = sellStock(stockId, calc.stockQuantity);
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
        <span>Sell {stock.id}</span>
      </div>
    );

  return (
    <Modal title={modalTitle} onClose={onClose}>
      {step === "done" ? (
        <div className="trade-success">
          <CheckCircle2 size={48} />
          <h3>Stock sold!</h3>
          <p>
            Successfully sold {formatStockUnits(calc.stockQuantity)} {stock.id}{" "}
            for {formatUSD(calc.netPayout)} pUSDC.
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
          {/* Section 1: You sell */}
          <div>
            <label htmlFor="sell-amount-input" className="trade-section-label">
              You sell
            </label>
            <div className="trade-input-row">
              <input
                id="sell-amount-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setError("");
                }}
              />
              <div className="trade-output-asset">
                <img src={stock.logo} alt="" width={24} height={24} />
                <span>{stock.id}</span>
              </div>
            </div>

            <div className="trade-balance-row">
              Balance {formatStockUnits(userBalance)} {stock.id}
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
                {new Intl.NumberFormat("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(calc.netPayout)}
              </span>
              <span className="trade-currency">pUSDC</span>
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
                <dt>Total payout</dt>
                <dd>{calc.netPayout.toFixed(2)} pUSDC</dd>
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
              Insufficient {stock.id} balance.
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
              Confirm sell
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
