"use client";
import { useRef, useState } from "react";
import { parseUnits } from "viem";
import { ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { useQuote } from "@/lib/onchain/useQuote";
import { stocks, money, units, type StockId } from "@/lib/assets";
export function TradeModal({
  stockId,
  mode,
  onClose,
}: {
  stockId: StockId;
  mode: "Buy" | "Sell";
  onClose: () => void;
}) {
  const account = usePortfolio(),
    stock = stocks[stockId],
    buy = mode === "Buy";
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [hash, setHash] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  const {
    configured,
    quote,
    error: quoteError,
  } = useQuote(mode, stockId, input);
  const n = Number(input),
    limit = buy ? account.pUSDC : account.stockBalances[stockId];
  const valid =
    !!account.address &&
    account.ready &&
    (buy || account.stockReady[stockId]) &&
    configured &&
    !!quote &&
    n > 0 &&
    (buy ? /^\d*\.?\d{0,6}$/ : /^\d*\.?\d{0,18}$/).test(input) &&
    (buy
      ? n <= limit
      : parseUnits(input, 18) <=
        parseUnits(account.rawStockBalances[stockId], 18)) &&
    quote.receive > 0;
  async function submit() {
    if (!valid || lock.current || !quote) return;
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      const result = buy
        ? await account.buyStock(stockId, quote.receive, n)
        : await account.sellStock(stockId, input);
      if (result.ok) setHash(result.hash);
      else setError(result.error);
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  return (
    <Modal
      title={
        <div className="trade-modal-title">
          <img src={stock.logo} alt="" width={28} height={28} />
          <span>
            {mode} {stockId}
          </span>
        </div>
      }
      onClose={onClose}
    >
      {hash ? (
        <div className="trade-success" role="status">
          <CheckCircle2 size={40} className="positive" />
          <h3>{buy ? "Purchase" : "Sale"} confirmed</h3>
          <TransactionLink hash={hash} />
          <p className="muted">Saved to your portfolio Activity.</p>
          <button className="button" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="trade-amount" className="trade-section-label">
            {buy ? "You pay" : "You sell"}
          </label>
          <div className="trade-input-row">
            <input
              id="trade-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={input}
              disabled={working}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
            />
            <span className="trade-currency">{buy ? "pUSDC" : stockId}</span>
          </div>
          <div className="trade-balance-row">
            Available{" "}
            {account.ready && (buy || account.stockReady[stockId])
              ? units(limit)
              : "—"}{" "}
            {buy ? "pUSDC" : stockId}
          </div>
          <div className="trade-shortcuts" aria-label="Percentage shortcuts">
            {[25, 50, 100].map((p) => (
              <button
                key={p}
                type="button"
                disabled={working || !account.ready}
                onClick={() => {
                  setInput(
                    p === 100 && !buy
                      ? account.rawStockBalances[stockId]
                      : String(Math.floor(((limit * p) / 100) * 1e6) / 1e6),
                  );
                  setError("");
                }}
              >
                {p === 100 ? "Max" : `${p}%`}
              </button>
            ))}
          </div>
          <div className="trade-divider" aria-hidden="true">
            <div className="trade-divider-icon">
              <ArrowUpDown size={14} />
            </div>
          </div>
          <span className="trade-section-label">Estimated receive</span>
          <div className="trade-output-row">
            <span className="trade-output-value">
              {quote ? units(quote.receive) : "—"}
            </span>
            <span>{buy ? stockId : "pUSDC"}</span>
          </div>
          <div className="trade-review-box">
            <dl style={{ margin: 0 }}>
              <div className="trade-review-row">
                <dt>Oracle price</dt>
                <dd>
                  {account.prices[stockId]
                    ? money(account.prices[stockId]!)
                    : "—"}
                </dd>
              </div>
              <div className="trade-review-row">
                <dt>
                  Trading fee
                  {account.feeBps !== undefined
                    ? ` (${account.feeBps / 100}%)`
                    : ""}
                </dt>
                <dd>{quote ? `${units(quote.fee)} pUSDC` : "—"}</dd>
              </div>
            </dl>
          </div>
          {!account.address ? (
            <p className="muted">Connect your wallet to trade.</p>
          ) : !configured ? (
            <p className="muted">
              Trading opens when this stock’s deployment is available.
            </p>
          ) : null}
          {(error || quoteError || n > limit) && (
            <p className="trade-error" role="alert">
              {error || quoteError || "Insufficient balance."}
            </p>
          )}
          <div className="trade-actions">
            <button
              className="trade-btn-confirm"
              disabled={!valid || working || !!account.pending}
              onClick={() => void submit()}
            >
              {working
                ? account.pending || "Processing…"
                : `${mode} ${stockId}`}
            </button>
            <button className="trade-btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
