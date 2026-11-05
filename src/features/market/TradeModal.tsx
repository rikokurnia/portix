"use client";
import { useRef, useState } from "react";
import { parseUnits } from "viem";
import { ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { getPortfolioSnapshot } from "@/lib/portfolio-store";
import { usePortfolio } from "@/lib/portfolio-store";
import { vaultIntegrationIssue } from "@/lib/onchain/contracts";
import { useStockHistory } from "./useStockHistory";
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
  const history=useStockHistory(stockId);
  const account = usePortfolio(),
    stock = stocks[stockId],
    buy = mode === "Buy";
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [hash, setHash] = useState(""),
    [confirmed,setConfirmed]=useState<{amount:number;usdcAmount?:number}>(),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  const {
    configured,
    quote,
    error: quoteError,
  } = useQuote(mode, stockId, input);
  const n = Number(input),
    limit = buy ? account.pUSDC : account.stockBalances[stockId],
    oraclePrice = history.price > 0 ? history.price : account.prices[stockId];
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
      if (result.ok) {const event=getPortfolioSnapshot().activity.find(a=>a.hash===result.hash);if(event)setConfirmed({amount:event.amount,usdcAmount:event.usdcAmount});setHash(result.hash); }
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
          {confirmed && (
            <p className="trade-receipt-amount" style={{ fontSize: "15px", fontWeight: 600, margin: "6px 0 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span className="muted" style={{ fontWeight: 400 }}>Received:</span>
              <b>{buy?units(confirmed.amount):confirmed.usdcAmount!==undefined?units(confirmed.usdcAmount):"—"}</b>
              {buy ? (
                <span>{stockId}</span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <img src="/assets/usdc.png" alt="pUSDC" width={18} height={18} style={{ borderRadius: "50%" }} />
                  <span>pUSDC</span>
                </span>
              )}
            </p>
          )}
          {buy&&confirmed?.usdcAmount!==undefined&&<p className="muted">Spent {units(confirmed.usdcAmount)} pUSDC</p>}
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
            <span className="trade-currency">
              {buy ? (
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
                stockId
              )}
            </span>
          </div>
          <div className="trade-balance-row">
            Available{" "}
            {account.ready && (buy || account.stockReady[stockId])
              ? units(limit)
              : "—"}{" "}
            {buy ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <img
                  src="/assets/usdc.png"
                  alt="pUSDC"
                  width={14}
                  height={14}
                  style={{ borderRadius: "50%", verticalAlign: "middle" }}
                />
                <span>pUSDC</span>
              </span>
            ) : (
              stockId
            )}
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
            <span>
              {buy ? (
                stockId
              ) : (
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
              )}
            </span>
          </div>
          <div className="trade-review-box">
            <dl style={{ margin: 0 }}>
              <div className="trade-review-row">
                <dt>Live equity price</dt>
                <dd>
                  {oraclePrice
                    ? money(oraclePrice)
                    : "—"}
                </dd>
              </div>
              <div className="trade-review-row"><dt>Testnet settlement price</dt><dd>{account.settlementPrices[stockId]?money(account.settlementPrices[stockId]!):"—"}</dd></div>
              <div className="trade-review-row">
                <dt>
                  Trading fee
                  {account.feeBps !== undefined
                    ? ` (${account.feeBps / 100}%)`
                    : ""}
                </dt>
                <dd>
                  {quote ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {units(quote.fee)}{" "}
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
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {!account.address ? (
            <p className="muted">Connect your wallet to trade.</p>
          ) : !configured ? (
            <p className="muted">
              {vaultIntegrationIssue || "Trading opens when this stock’s deployment is available."}
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
