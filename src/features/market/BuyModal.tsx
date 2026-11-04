"use client";

import { useState } from "react";
import { ArrowUpDown, CheckCircle2, Sparkles } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { usePortfolio, updatePortfolio, getPortfolioSnapshot } from "@/lib/portfolio-store";
import { MARKET_STOCKS } from "./fixtures";
import { calculateBuy, formatUSD, formatStockUnits } from "./calculations";
import type { MarketStockId } from "./types";

interface BuyModalProps {
  stockId: MarketStockId;
  onClose: () => void;
}

export function BuyModal({ stockId, onClose }: BuyModalProps) {
  const account = usePortfolio();
  const stock = MARKET_STOCKS[stockId];
  const price = account.prices[stockId] || stock.price;

  const currentPUSDC = account.pUSDC;

  // Default input ($300.00 if affordable, else available pUSDC balance)
  const [spendStr, setSpendStr] = useState<string>(
    currentPUSDC >= 300 ? "300.00" : currentPUSDC > 0 ? currentPUSDC.toFixed(2) : "",
  );
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    stockQuantity: number;
    totalPayment: number;
  } | null>(null);

  const spendNum = Number(spendStr);
  const calc = calculateBuy(spendNum, price, account.feeBps ?? 10);

  const isValidInput =
    Number.isFinite(spendNum) &&
    spendNum > 0 &&
    /^\d*\.?\d{0,2}$/.test(spendStr) &&
    spendNum <= currentPUSDC &&
    calc.stockQuantity > 0;

  const isInsufficient = Number.isFinite(spendNum) && spendNum > currentPUSDC;

  const handleShortcut = (pct: number) => {
    if (currentPUSDC <= 0) return;
    const amount = Math.floor(currentPUSDC * (pct / 100) * 100) / 100;
    setSpendStr(amount.toFixed(2));
    setError("");
  };

  const handleClaimDemoFunds = () => {
    updatePortfolio({
      pUSDC: (account.pUSDC || 0) + 5000,
      ready: true,
    });
    setSpendStr("300.00");
    setError("");
  };

  // Direct buy execution — no intermediate review confirmation popup
  const handleDirectBuy = async () => {
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

    try {
      // If wallet is connected, try account.buyStock
      if (account.address) {
        const result = await account.buyStock(stockId, calc.stockQuantity, calc.totalPayment);
        if (!result.ok) {
          setError(result.error);
          setIsProcessing(false);
          return;
        }
      } else {
        // Local frontend execution
        const snap = getPortfolioSnapshot();
        const newBalance = Math.round((snap.pUSDC - calc.totalPayment) * 1e6) / 1e6;
        const currentStock = snap.stockBalances[stockId] ?? 0;
        const newStock = Math.round((currentStock + calc.stockQuantity) * 1e6) / 1e6;

        updatePortfolio({
          pUSDC: newBalance,
          stockBalances: {
            ...snap.stockBalances,
            [stockId]: newStock,
          },
        });
      }

      setSuccessInfo({
        stockQuantity: calc.stockQuantity,
        totalPayment: calc.totalPayment,
      });

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to execute purchase.");
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
              <span>
                Balance{" "}
                {new Intl.NumberFormat("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(currentPUSDC)}{" "}
                pUSDC
              </span>
              {currentPUSDC <= 0 && !account.address && (
                <button
                  type="button"
                  className="trade-demo-faucet-btn"
                  onClick={handleClaimDemoFunds}
                  title="Fund account with test pUSDC"
                >
                  <Sparkles size={13} />
                  <span>+5,000 Demo pUSDC</span>
                </button>
              )}
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
                <dd>{price.toFixed(2)} pUSDC</dd>
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
              onClick={() => void handleDirectBuy()}
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
