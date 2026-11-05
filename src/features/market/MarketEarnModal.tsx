"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { MARKET_STOCKS } from "./stocks";
import { BASELINE_MARKET_STOCKS } from "./fixtures";
import { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import { summarizeVault } from "@/lib/vault-market-data";
import { calculateBuy } from "@/lib/trade-calculations";
import { units, money, type VaultId } from "@/lib/assets";
import type { MarketStockId } from "./types";

interface MarketEarnModalProps {
  stockId: MarketStockId;
  initialVaultId?: VaultId | null;
  onClose: () => void;
}

export function MarketEarnModal({
  stockId,
  initialVaultId,
  onClose,
}: MarketEarnModalProps) {
  const router = useRouter();
  const account = usePortfolio();
  const vaultMarket = useVaultMarketData();

  const [vaultId, setVaultId] = useState<VaultId>(initialVaultId ?? "pxBoost");
  const [fundingMode, setFundingMode] = useState<"zap" | "stock">("zap");
  const [inputAmount, setInputAmount] = useState<string>("");
  const [working, setWorking] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [successHash, setSuccessHash] = useState<string>("");
  const [deployedStockAmount, setDeployedStockAmount] = useState<number>(0);

  const lock = useRef(false);
  const stock = MARKET_STOCKS[stockId];

  // Real-time dynamic APYs
  const primeSummary = summarizeVault("pxPrime", vaultMarket.histories);
  const boostSummary = summarizeVault("pxBoost", vaultMarket.histories);
  const primeApy = primeSummary ? `${primeSummary.apy.toFixed(2)}%` : "4.35%";
  const boostApy = boostSummary ? `${boostSummary.apy.toFixed(2)}%` : "12.78%";
  const selectedApy = vaultId === "pxPrime" ? primeApy : boostApy;

  // Real-time stock price matching the chart
  const stockPrice =
    account.prices[stockId] ??
    BASELINE_MARKET_STOCKS[stockId]?.price ??
    stock.price;
  const feeBps = account.feeBps ?? 10;

  // Balances
  const pUsdcBalance = account.pUSDC;
  const stockBalance = account.stockBalances[stockId] ?? 0;

  // Parse numeric input
  const numInput = Number(inputAmount);

  // Quote calculations
  const zapCalculation = useMemo(() => {
    if (fundingMode !== "zap" || !numInput || numInput <= 0 || stockPrice <= 0) {
      return null;
    }
    return calculateBuy(numInput, stockPrice, feeBps);
  }, [fundingMode, numInput, stockPrice, feeBps]);

  const estimatedStock =
    fundingMode === "zap"
      ? zapCalculation?.stockQuantity ?? 0
      : numInput > 0
        ? numInput
        : 0;

  const maxAvailable = fundingMode === "zap" ? pUsdcBalance : stockBalance;
  const hasEnoughBalance = numInput > 0 && numInput <= maxAvailable;
  const canSubmit =
    !!account.address &&
    account.ready &&
    hasEnoughBalance &&
    !working &&
    !account.pending;

  async function handleExecute() {
    if (lock.current || !canSubmit) return;
    lock.current = true;
    setWorking(true);
    setError("");

    try {
      if (fundingMode === "zap") {
        // Step 1: Buy the stock with exact pUSDC
        setProgressStep(`Step 1/2: Purchasing ${stockId} with pUSDC...`);
        const buyRes = await account.buyStock(
          stockId,
          zapCalculation!.stockQuantity,
          numInput,
        );
        if (!buyRes.ok) {
          throw new Error(buyRes.error || "Failed to purchase stock collateral.");
        }

        // Step 2: Deploy the stock to vault
        setProgressStep(`Step 2/2: Deploying ${stockId} to ${vaultId}...`);
        const depositRes = await account.depositToVault(
          vaultId,
          stockId,
          zapCalculation!.stockQuantity,
        );
        if (!depositRes.ok) {
          throw new Error(
            depositRes.error ||
              "Purchased stock, but vault deposit failed. Check your wallet balance.",
          );
        }

        setDeployedStockAmount(zapCalculation!.stockQuantity);
        setSuccessHash(depositRes.hash || buyRes.hash || "");
      } else {
        // Direct deposit of existing stock
        setProgressStep(`Deploying ${stockId} to ${vaultId}...`);
        const depositRes = await account.depositToVault(
          vaultId,
          stockId,
          numInput,
        );
        if (!depositRes.ok) {
          throw new Error(depositRes.error || "Vault deposit failed.");
        }
        setDeployedStockAmount(numInput);
        setSuccessHash(depositRes.hash || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      lock.current = false;
      setWorking(false);
      setProgressStep("");
    }
  }

  return (
    <Modal
      title={
        <div className="earn-modal-title">
          <img
            src={stock.logo}
            alt={stock.name}
            width={28}
            height={28}
            style={{ borderRadius: "50%" }}
          />
          <div>
            <span>Earn Carry Yield · {stockId}</span>
          </div>
        </div>
      }
      onClose={onClose}
    >
      {successHash ? (
        <div className="earn-modal-success" role="status">
          <CheckCircle2 size={44} className="positive" />
          <h3>Deployed to {vaultId}!</h3>
          <p className="earn-success-subtitle">
            Successfully deposited{" "}
            <strong>
              {units(deployedStockAmount)} {stockId}
            </strong>{" "}
            into the <strong>{vaultId}</strong> carry vault earning{" "}
            <span className="positive">+{selectedApy} APY</span>.
          </p>

          <TransactionLink hash={successHash} />
          <p className="muted" style={{ fontSize: "12px", margin: "12px 0 16px" }}>
            Transaction recorded on Portaldot block scanner & saved to your portfolio.
          </p>

          <div className="earn-modal-success-actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
            >
              Done
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => router.push("/vault")}
            >
              View in Portfolio <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="earn-modal-content">
          {/* Vault Target Selection */}
          <div className="earn-vault-selector">
            <label className="trade-section-label">Select Carry Vault</label>
            <div className="earn-vault-cards">
              <button
                type="button"
                className={`earn-vault-card ${vaultId === "pxPrime" ? "selected" : ""}`}
                onClick={() => setVaultId("pxPrime")}
              >
                <div className="earn-vault-card-header">
                  <div className="earn-vault-card-brand">
                    <img
                      src="/assets/vault-prime.png"
                      alt="pxPrime"
                      width={28}
                      height={28}
                    />
                    <strong>pxPrime</strong>
                  </div>
                  <span className="earn-item-risk lower">Lower Risk</span>
                </div>
                <div className="earn-vault-card-body">
                  <span className="earn-vault-card-desc">
                    Lending Carry (Morpho, Compound & Aave)
                  </span>
                  <div className="earn-vault-card-apy">
                    <span>APY</span>
                    <strong>{primeApy}</strong>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`earn-vault-card ${vaultId === "pxBoost" ? "selected" : ""}`}
                onClick={() => setVaultId("pxBoost")}
              >
                <div className="earn-vault-card-header">
                  <div className="earn-vault-card-brand">
                    <img
                      src="/assets/vault-boost.png"
                      alt="pxBoost"
                      width={28}
                      height={28}
                    />
                    <strong>pxBoost</strong>
                  </div>
                  <span className="earn-item-risk moderate">Moderate Risk</span>
                </div>
                <div className="earn-vault-card-body">
                  <span className="earn-vault-card-desc">
                    AMM Trading Fees (Uniswap V3 LP)
                  </span>
                  <div className="earn-vault-card-apy">
                    <span>APY</span>
                    <strong>{boostApy}</strong>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Funding Source Selector */}
          <div className="earn-funding-toggle">
            <button
              type="button"
              className={`earn-toggle-btn ${fundingMode === "zap" ? "active" : ""}`}
              onClick={() => {
                setFundingMode("zap");
                setInputAmount("");
                setError("");
              }}
            >
              <Zap size={15} />
              <span>1-Click Zap with pUSDC</span>
            </button>

            <button
              type="button"
              className={`earn-toggle-btn ${fundingMode === "stock" ? "active" : ""}`}
              onClick={() => {
                setFundingMode("stock");
                setInputAmount("");
                setError("");
              }}
            >
              <img
                src={stock.logo}
                alt=""
                width={16}
                height={16}
                style={{ borderRadius: "50%" }}
              />
              <span>Deploy Wallet Stock ({units(stockBalance)})</span>
            </button>
          </div>

          {/* Input Amount Section */}
          <div className="earn-input-section">
            <label htmlFor="earn-amount-input" className="trade-section-label">
              {fundingMode === "zap"
                ? "Enter pUSDC to Invest & Deploy"
                : `Enter ${stockId} Amount to Deploy`}
            </label>

            <div className="trade-input-row">
              <input
                id="earn-amount-input"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={inputAmount}
                disabled={working}
                onChange={(e) => {
                  setInputAmount(e.target.value);
                  setError("");
                }}
              />
              <span className="trade-currency">
                {fundingMode === "zap" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <img
                      src="/assets/usdc.png"
                      alt="pUSDC"
                      width={18}
                      height={18}
                      style={{ borderRadius: "50%" }}
                    />
                    <span>pUSDC</span>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <img
                      src={stock.logo}
                      alt={stockId}
                      width={18}
                      height={18}
                      style={{ borderRadius: "50%" }}
                    />
                    <span>{stockId}</span>
                  </span>
                )}
              </span>
            </div>

            <div className="trade-balance-row">
              Available{" "}
              {account.ready ? (
                fundingMode === "zap" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {units(pUsdcBalance)}{" "}
                    <img
                      src="/assets/usdc.png"
                      alt="pUSDC"
                      width={14}
                      height={14}
                      style={{ borderRadius: "50%", verticalAlign: "middle" }}
                    />{" "}
                    pUSDC
                  </span>
                ) : (
                  `${units(stockBalance)} ${stockId}`
                )
              ) : (
                "—"
              )}
            </div>

            {/* Percentage shortcuts */}
            <div className="trade-shortcuts" aria-label="Percentage shortcuts">
              {[25, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={working || !account.ready}
                  onClick={() => {
                    const val =
                      fundingMode === "zap"
                        ? String(Math.floor(((pUsdcBalance * p) / 100) * 1e6) / 1e6)
                        : String(Math.floor(((stockBalance * p) / 100) * 1e6) / 1e6);
                    setInputAmount(val);
                    setError("");
                  }}
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Carry Vault Deployment Breakdown */}
          <div className="trade-review-box earn-review-box">
            <dl style={{ margin: 0 }}>
              <div className="trade-review-row">
                <dt>Oracle price ({stockId})</dt>
                <dd>{stockPrice > 0 ? money(stockPrice) : "—"}</dd>
              </div>

              {fundingMode === "zap" && (
                <div className="trade-review-row">
                  <dt>Est. stock collateral</dt>
                  <dd>
                    {estimatedStock > 0 ? `~${units(estimatedStock)} ${stockId}` : "—"}
                  </dd>
                </div>
              )}

              <div className="trade-review-row">
                <dt>Target carry vault</dt>
                <dd style={{ fontWeight: 600, color: "#faf7ff" }}>{vaultId}</dd>
              </div>

              <div className="trade-review-row">
                <dt>Real-time carry APY</dt>
                <dd className="positive" style={{ fontWeight: 700 }}>
                  +{selectedApy}
                </dd>
              </div>

              <div className="trade-review-row">
                <dt>Spread share</dt>
                <dd>85% to you · 15% protocol</dd>
              </div>

              <div className="trade-review-row">
                <dt>Borrow allocation</dt>
                <dd>40% pUSDC</dd>
              </div>
            </dl>

            {fundingMode === "zap" && (
              <div className="earn-flow-steps">
                <div className="earn-flow-step">
                  <span className="earn-step-num">1</span>
                  <span>Buy {stockId} with pUSDC</span>
                </div>
                <ArrowRight size={13} className="muted" />
                <div className="earn-flow-step">
                  <span className="earn-step-num">2</span>
                  <span>Auto-deposit into {vaultId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Validation & Errors */}
          {!account.address ? (
            <p className="muted" style={{ textAlign: "center", margin: "12px 0 4px" }}>
              Connect your wallet to earn carry yield.
            </p>
          ) : numInput > maxAvailable ? (
            <p className="trade-error" role="alert">
              Insufficient balance. You have {units(maxAvailable)}{" "}
              {fundingMode === "zap" ? "pUSDC" : stockId}.
            </p>
          ) : error ? (
            <p className="trade-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* Action Button */}
          <div className="trade-actions">
            <button
              type="button"
              className="trade-btn-confirm"
              disabled={!canSubmit}
              onClick={() => void handleExecute()}
            >
              {working ? (
                progressStep || "Processing transactions…"
              ) : fundingMode === "zap" ? (
                <>
                  <Zap size={16} />
                  <span>Buy & Deploy to {vaultId}</span>
                </>
              ) : (
                `Deploy ${stockId} to ${vaultId}`
              )}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={working}
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
