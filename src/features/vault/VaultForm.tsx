"use client";
import { useRef, useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/shared/Button";
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
export function VaultForm({
  vaultId,
  initialStock,
  initialMode,
  onProcess,
  onStockChange,
}: {
  vaultId: VaultId;
  initialStock: StockId;
  initialMode: "Deposit" | "Withdraw";
  onProcess: () => void;
  onStockChange: (id: StockId) => void;
}) {
  const account = usePortfolio(),
    [mode, setMode] = useState(initialMode),
    [stockId, setStock] = useState(initialStock),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const submitting = useRef(false);
  const deposit = mode === "Deposit",
    position = account.positions.find(
      (p) => p.vaultId === vaultId && p.stockId === stockId,
    ),
    limit = deposit ? account.stockBalances[stockId] : (position?.shares ?? 0),
    n = Number(amount),
    valid =
      Number.isFinite(n) &&
      n > 0 &&
      /^\d*\.?\d{0,6}$/.test(amount) &&
      n <= limit;
  const quantity = deposit
      ? n
      : position
        ? position.collateral * Math.min(n / position.shares, 1)
        : 0,
    value = quantity * stocks[stockId].price,
    receipt = Math.round((value / vaults[vaultId].sharePrice) * 1e6) / 1e6,
    yieldReturn = position
      ? position.earnedYield * Math.min(n / position.shares, 1)
      : 0;
  function clear() {
    setAmount("");
    setMessage("");
    setError("");
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting.current) return;
    submitting.current = true;
    const result = deposit
      ? account.depositToVault(vaultId, stockId, n)
      : account.withdrawFromVault(vaultId, stockId, n);
    if (result.ok) {
      setMessage(
        deposit
          ? `${units(n)} ${stockId} deposited. ${units(receipt)} ${vaultId} added.`
          : `${units(quantity)} ${stockId} and ${money(yieldReturn)} earned pUSDC returned.`,
      );
      setAmount("");
      onProcess();
    } else setError(result.error);
    submitting.current = false;
  }
  return (
    <form className="vault-order panel" onSubmit={submit}>
      <div
        className="segmented vault-order-tabs"
        role="tablist"
        aria-label="Vault action"
      >
        {(["Deposit", "Withdraw"] as const).map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={mode === t}
            key={t}
            onClick={() => {
              setMode(t);
              clear();
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="input-label" htmlFor="vault-stock">
        Collateral stock
      </label>
      <div className="vault-stock-select">
        <img src={stocks[stockId].logo} alt="" width="24" height="24" />
        <select
          id="vault-stock"
          value={stockId}
          onChange={(e) => {
            setStock(e.target.value as StockId);
            onStockChange(e.target.value as StockId);
            clear();
          }}
        >
          {stockIds.map((id) => (
            <option key={id} value={id}>
              {id} · {stocks[id].name}
            </option>
          ))}
        </select>
      </div>
      <label className="input-label" htmlFor="vault-amount">
        {deposit ? "You deposit" : "Shares to redeem"}
      </label>
      <div className="amount-input">
        <input
          id="vault-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          aria-describedby="vault-balance"
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
            setMessage("");
          }}
        />
        <span>{deposit ? stockId : vaultId}</span>
      </div>
      <div className="balance-line" id="vault-balance">
        <span>≈ {money(Number.isFinite(value) ? value : 0)}</span>
        <span>Available {units(limit)}</span>
      </div>
      <div className="shortcuts">
        {[25, 50, 75, 100].map((p) => (
          <button
            type="button"
            key={p}
            onClick={() => {
              setAmount(String(Math.floor(((limit * p) / 100) * 1e6) / 1e6));
              setMessage("");
              setError("");
            }}
          >
            {p === 100 ? "Max" : `${p}%`}
          </button>
        ))}
      </div>
      {amount && !valid && (
        <p className="error" role="alert">
          {n > limit
            ? "Insufficient balance."
            : "Use a positive amount with up to 6 decimals."}
        </p>
      )}
      <div className="receipt">
        <span>You receive</span>
        <strong>
          {units(
            Number.isFinite(deposit ? receipt : quantity)
              ? deposit
                ? receipt
                : quantity
              : 0,
          )}{" "}
          {deposit ? vaultId : stockId}
        </strong>
        {!deposit && (
          <small className="positive">
            + {money(Number.isFinite(yieldReturn) ? yieldReturn : 0)} earned
            pUSDC
          </small>
        )}
      </div>
      <dl className="carry-summary">
        <div>
          <dt>Collateral value</dt>
          <dd>{money(Number.isFinite(value) ? value : 0)}</dd>
        </div>
        <div>
          <dt>{deposit ? "Borrow allocation" : "Debt released"}</dt>
          <dd>{money(Number.isFinite(value) ? value * 0.4 : 0)}</dd>
        </div>
        <div>
          <dt>Initial LTV</dt>
          <dd>40%</dd>
        </div>
        <div>
          <dt>Share reference value</dt>
          <dd>{money(vaults[vaultId].sharePrice)}</dd>
        </div>
      </dl>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button className="full-width" disabled={!valid} type="submit">
        {deposit ? "Deposit & earn" : "Withdraw assets"}
        <ArrowRight size={17} />
      </Button>
      {message && (
        <div className="vault-order-success" role="status">
          <CheckCircle2 size={18} />
          <p>{message}</p>
        </div>
      )}
      <p className="vault-order-footnote">
        Updates your local portfolio. No wallet signature required.
      </p>
    </form>
  );
}
