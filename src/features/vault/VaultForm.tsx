"use client";
import { useRef, useState } from "react";
import { parseUnits } from "viem";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { TransactionLink } from "@/components/shared/TransactionLink";
import {
  stockIds,
  stocks,
  money,
  units,
  type StockId,
  type VaultId,
} from "@/lib/assets";
import { usePortfolio } from "@/lib/portfolio-store";
import { useQuote } from "@/lib/onchain/useQuote";
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
  const account = usePortfolio();
  const [mode, setMode] = useState(initialMode),
    [stockId, setStock] = useState(initialStock),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [hash, setHash] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false),
    deposit = mode === "Deposit";
  const position = account.positions.find(
      (p) => p.vaultId === vaultId && p.stockId === stockId,
    ),
    limit = deposit ? account.stockBalances[stockId] : (position?.shares ?? 0);
  const rawLimit = deposit
    ? account.rawStockBalances[stockId]
    : (position?.rawShares ?? "0");
  const n = Number(amount),
    {
      configured,
      quote,
      error: quoteError,
    } = useQuote(mode, stockId, amount, vaultId);
  const valid =
    !!account.address &&
    account.ready &&
    (deposit ? account.stockReady[stockId] : account.positionsReady) &&
    configured &&
    !!quote &&
    n > 0 &&
    /^\d*\.?\d{0,18}$/.test(amount) &&
    parseUnits(amount, 18) <= parseUnits(rawLimit, 18) &&
    quote.receive > 0;
  function clear() {
    setAmount("");
    setHash("");
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    onProcess();
    try {
      const result = deposit
        ? await account.depositToVault(vaultId, stockId, amount)
        : await account.withdrawFromVault(vaultId, stockId, amount);
      if (result.ok) {
        setHash(result.hash);
        setAmount("");
      } else setError(result.error);
    } finally {
      lock.current = false;
      setWorking(false);
    }
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
            disabled={working}
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
        <img src={stocks[stockId].logo} alt="" width={24} height={24} />
        <select
          id="vault-stock"
          value={stockId}
          disabled={working}
          onChange={(e) => {
            const id = e.target.value as StockId;
            setStock(id);
            onStockChange(id);
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
          disabled={working}
          value={amount}
          aria-describedby="vault-balance"
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
            setHash("");
          }}
        />
        <span>{deposit ? stockId : vaultId}</span>
      </div>
      <div className="balance-line" id="vault-balance">
        <span>{quote ? `≈ ${money(quote.value)}` : "—"}</span>
        <span>
          Available{" "}
          {account.ready &&
          (deposit ? account.stockReady[stockId] : account.positionsReady)
            ? units(limit)
            : "—"}
        </span>
      </div>
      <div className="shortcuts">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            type="button"
            disabled={working || !account.ready}
            onClick={() => {
              setAmount(
                p === 100
                  ? rawLimit
                  : String(Math.floor(((limit * p) / 100) * 1e6) / 1e6),
              );
              setError("");
              setHash("");
            }}
          >
            {p === 100 ? "Max" : `${p}%`}
          </button>
        ))}
      </div>
      {amount &&
        (!/^\d*\.?\d{0,18}$/.test(amount) || !(n > 0) || n > limit) && (
          <p className="error" role="alert">
            {n > limit
              ? "Insufficient balance."
              : "Use a positive amount with up to 18 decimals."}
          </p>
        )}
      <div className="receipt">
        <span>Estimated receive</span>
        <strong>
          {quote ? units(quote.receive) : "—"} {deposit ? vaultId : stockId}
        </strong>
        {!deposit && quote && (
          <small className="positive">
            + {units(quote.yield)} earned pUSDC
          </small>
        )}
      </div>
      <dl className="carry-summary">
        <div>
          <dt>Collateral value</dt>
          <dd>{quote ? money(quote.value) : "—"}</dd>
        </div>
        <div>
          <dt>{deposit ? "Borrow allocation" : "Debt released"}</dt>
          <dd>{quote ? `${units(quote.borrow)} pUSDC` : "—"}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>Portaldot V3</dd>
        </div>
      </dl>
      {!account.address ? (
        <p className="muted">Connect your wallet to continue.</p>
      ) : !configured ? (
        <p className="muted">This vault is awaiting its deployment address.</p>
      ) : null}
      {(error || quoteError) && (
        <p className="error" role="alert">
          {error || quoteError}
        </p>
      )}
      <Button
        className="full-width"
        disabled={!valid || working || !!account.pending}
        type="submit"
      >
        {working
          ? account.pending || "Processing…"
          : deposit
            ? "Deposit & earn"
            : "Withdraw assets"}
        <ArrowRight size={17} />
      </Button>
      {hash && (
        <div className="vault-order-success" role="status">
          <CheckCircle2 size={18} />
          <div>
            <p>{deposit ? "Deposit" : "Withdrawal"} confirmed</p>
            <TransactionLink hash={hash} />
          </div>
        </div>
      )}
    </form>
  );
}
