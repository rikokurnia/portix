"use client";
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { BrandIcon } from "@/components/shared/BrandIcon";
import {
  stockIds,
  stocks,
  vaults,
  money,
  units,
  type StockId,
  type VaultId,
} from "@/lib/assets";
import { usePortfolio } from "@/lib/portfolio-store";
export function DepositModal({
  vaultId,
  initialStock = "GOOGL",
  initialMode = "Deposit",
  onClose,
}: {
  vaultId: VaultId;
  initialStock?: StockId;
  initialMode?: "Deposit" | "Withdraw";
  onClose: () => void;
}) {
  const account = usePortfolio(),
    [mode, setMode] = useState(initialMode),
    [stockId, setStock] = useState<StockId>(initialStock),
    [amount, setAmount] = useState(""),
    [step, setStep] = useState<"edit" | "review" | "done">("edit"),
    [error, setError] = useState("");
  const position = account.positions.find(
      (p) => p.vaultId === vaultId && p.stockId === stockId,
    ),
    deposit = mode === "Deposit",
    stock = stocks[stockId],
    n = Number(amount),
    limit = deposit ? account.stockBalances[stockId] : (position?.shares ?? 0),
    valid =
      Number.isFinite(n) &&
      n > 0 &&
      /^\d*\.?\d{0,6}$/.test(amount) &&
      n <= limit + 1e-9;
  const collateral = deposit
      ? n
      : position && n > 0
        ? position.collateral * Math.min(n / position.shares, 1)
        : 0,
    value = collateral * stock.price,
    receipt = value / vaults[vaultId].sharePrice,
    yieldReturn =
      position && n > 0
        ? position.earnedYield * Math.min(n / position.shares, 1)
        : 0;
  const reset = () => {
    setAmount("");
    setError("");
    setStep("edit");
  };
  const confirm = () => {
    const result = deposit
      ? account.depositToVault(vaultId, stockId, n)
      : account.withdrawFromVault(vaultId, stockId, n);
    if (result.ok) setStep("done");
    else {
      setError(result.error);
      setStep("edit");
    }
  };
  return (
    <Modal
      title={step === "done" ? "Portfolio updated" : `${mode} · ${vaultId}`}
      onClose={onClose}
    >
      {step === "done" ? (
        <div className="success-state">
          <CheckCircle2 size={48} />
          <h3>
            {deposit
              ? "Your stocks are earning."
              : "Your assets are available."}
          </h3>
          <p>
            {units(collateral)} {stockId}{" "}
            {deposit ? `added to ${vaultId}` : "returned to your wallet"}.
          </p>
          <Button className="full-width" onClick={onClose}>
            View portfolio
          </Button>
        </div>
      ) : (
        <>
          <div className="modal-vault">
            <BrandIcon brand={vaultId} size={52} />
            <div>
              <strong>{vaultId}</strong>
              <p className="muted">
                {vaults[vaultId].apy}% APY · 40% initial LTV
              </p>
            </div>
          </div>
          {step === "edit" ? (
            <>
              <div
                className="segmented modal-tabs"
                role="tablist"
                aria-label="Vault action"
              >
                {(["Deposit", "Withdraw"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={mode === t}
                    onClick={() => {
                      setMode(t);
                      reset();
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="stock-selector" aria-label="Stock">
                {stockIds.map((id) => (
                  <button
                    aria-pressed={stockId === id}
                    key={id}
                    onClick={() => {
                      setStock(id);
                      reset();
                    }}
                  >
                    <img src={stocks[id].logo} width="24" height="24" alt="" />
                    {id}
                  </button>
                ))}
              </div>
              <label className="input-label" htmlFor="vault-amount">
                {deposit ? "You deposit" : "Shares to withdraw"}
              </label>
              <div className="amount-input">
                <input
                  id="vault-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  aria-describedby="amount-help"
                />
                <span>{deposit ? stockId : vaultId}</span>
              </div>
              <div className="balance-line" id="amount-help">
                <span>≈ {money(Number.isFinite(value) ? value : 0)}</span>
                <span>
                  Balance {units(limit)} {deposit ? stockId : vaultId}
                </span>
              </div>
              <div className="shortcuts">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setAmount(
                        String(Math.floor(((limit * p) / 100) * 1e6) / 1e6),
                      )
                    }
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>
              {amount && !valid && (
                <p className="error" role="alert">
                  {n > limit
                    ? "Insufficient balance."
                    : "Enter an amount above zero with up to 6 decimals."}
                </p>
              )}
            </>
          ) : (
            <div className="review-heading">
              <h3>Review {mode.toLowerCase()}</h3>
              <p>
                {units(n)} {deposit ? stockId : vaultId}{" "}
                <ArrowRight size={16} /> {units(deposit ? receipt : collateral)}{" "}
                {deposit ? vaultId : stockId}
              </p>
            </div>
          )}
          <div className="receipt">
            <span>You receive</span>
            <strong>
              {units(
                Number.isFinite(deposit ? receipt : collateral)
                  ? deposit
                    ? receipt
                    : collateral
                  : 0,
              )}{" "}
              {deposit ? vaultId : stockId}
            </strong>
            {!deposit && (
              <small className="positive">
                + {money(yieldReturn)} earned yield in pUSDC
              </small>
            )}
          </div>
          <dl className="carry-summary">
            <div>
              <dt>Collateral value</dt>
              <dd>{money(Number.isFinite(value) ? value : 0)}</dd>
            </div>
            <div>
              <dt>{deposit ? "Borrowed pUSDC" : "Borrowing released"}</dt>
              <dd>{money(Number.isFinite(value) ? value * 0.4 : 0)}</dd>
            </div>
            <div>
              <dt>Initial LTV</dt>
              <dd>40%</dd>
            </div>
            <div>
              <dt>Share value</dt>
              <dd>{money(vaults[vaultId].sharePrice)} / share</dd>
            </div>
          </dl>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {step === "review" ? (
            <div className="review-actions">
              <Button variant="secondary" onClick={() => setStep("edit")}>
                Back
              </Button>
              <Button onClick={confirm}>
                Confirm {mode.toLowerCase()} <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <Button
              className="full-width"
              disabled={!valid}
              onClick={() => setStep("review")}
            >
              Review {mode.toLowerCase()} <ArrowRight size={18} />
            </Button>
          )}
        </>
      )}
    </Modal>
  );
}
