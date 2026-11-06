"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { price6,usdToStock,usdToShares,rawAmountUsd,vaultValueUnits } from "@/lib/vault-amounts";
import { formatUnits, parseUnits } from "viem";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { TransactionLink } from "@/components/shared/TransactionLink";
import {
  stockIds,
  assets,
  stocks,
  money,
  units,
  type StockId,
  type VaultId,
} from "@/lib/assets";
import { usePortfolio } from "@/lib/portfolio-store";
import { vaultIntegrationIssue } from "@/lib/onchain/contracts";
import type { VaultProcessEvent } from "./process-state";
import { useQuote } from "@/lib/onchain/useQuote";
import { useStockHistory } from "@/features/market/useStockHistory";
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
  onProcess: (event: VaultProcessEvent) => void;
  onStockChange?: (id: StockId) => void;
}) {
  const account = usePortfolio();
  const [mode, setMode] = useState(initialMode),
    [stockId, setStock] = useState(initialStock),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [hash, setHash] = useState(""),
    [working, setWorking] = useState(false),
    [exact,setExact]=useState<{key:string;raw:string}>();
  const lock = useRef(false),
    deposit = mode === "Deposit";

  const availableStocks = deposit
    ? stockIds.filter((id) => (account.stockBalances[id] ?? 0) > 0)
    : account.positions
        .filter((p) => p.vaultId === vaultId && p.shares > 0)
        .map((p) => p.stockId);

  const selectedStockId =
    availableStocks.length > 0 && !availableStocks.includes(stockId)
      ? availableStocks[0]
      : stockId;

  const position = account.positions.find(
      (p) => p.vaultId === vaultId && p.stockId === selectedStockId,
    );
  const rawLimit = deposit
    ? (account.rawStockBalances[selectedStockId] ?? "0")
    : (position?.rawShares ?? "0");
  const history = useStockHistory(selectedStockId);
  const valuationPrice = history.price > 0 ? history.price : account.prices[selectedStockId];
  const marketPrice=price6(valuationPrice);
  const rawShares=parseUnits(position?.rawShares??"0",18);
  const rawCollateral=parseUnits(position?.rawCollateral??String(position?.collateral??0),18);
  const inputValid=/^\d*\.?\d{0,6}$/.test(amount)&&Number(amount)>0;
  const rawUnits=exact?.key===amount?parseUnits(exact.raw,18):inputValid?(deposit?usdToStock(amount,marketPrice):usdToShares(amount,rawShares,rawCollateral,marketPrice)):0n;
  const rawInput=rawUnits>0n?formatUnits(rawUnits,18):"";
  const usdLimit=rawAmountUsd(parseUnits(rawLimit,18),mode,marketPrice,rawShares,rawCollateral);
  const n=Number(amount);
  const {configured,quote,error:quoteError}=useQuote(mode,selectedStockId,rawInput,vaultId);
  const depositValueUnits = quote ? vaultValueUnits(rawUnits, marketPrice) : undefined;
  const withdrawalValueUnits = rawShares > 0n ? vaultValueUnits(rawUnits * rawCollateral / rawShares, marketPrice) : undefined;
  const collateralValue = quote && valuationPrice ? (deposit ? Number(rawInput) : quote.receive) * valuationPrice : undefined;
  const confirmedPayout=hash?account.activity.find(a=>a.hash===hash)?.usdcAmount:undefined;
  const valid =
    !!account.address &&
    account.ready &&
    availableStocks.length > 0 &&
    availableStocks.includes(selectedStockId) &&
    (deposit ? account.stockReady[selectedStockId] : account.positionsReady) &&
    configured &&
    !!quote &&
    n > 0 &&
    inputValid && marketPrice>0n &&
    rawUnits <= parseUnits(rawLimit, 18) &&
    quote.receive > 0;
  function clear() {
    setAmount("");
    setExact(undefined);
    setHash("");
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    const processId = `${Date.now()}:${mode}:${selectedStockId}`;
    onProcess({type:'start',process:{id:processId,owner:account.address!,stockId:selectedStockId,vaultId,type:mode,existingHashes:account.activity.map(a=>a.hash)}});
    try {
      const result = deposit
        ? await account.depositToVault(vaultId, selectedStockId, rawInput)
        : await account.withdrawFromVault(vaultId, selectedStockId, rawInput);
      onProcess({type:"settled",id:processId,result});
      if (result.ok) {
        setHash(result.hash);
        setAmount("");
      } else setError(result.error);
    } catch {
      const error = 'The request could not be completed. Check History before retrying.';
      setError(error);
      onProcess({type:'settled',id:processId,result:{ok:false,error}});
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
      {availableStocks.length === 0 ? (
        <div className="vault-stock-empty">
          <p>
            {deposit
              ? "You don't hold any tokenized stocks in your wallet to deposit."
              : `No active positions in ${vaultId} to withdraw.`}
          </p>
          {deposit ? (
            <Link
              href="/market"
              className="button small"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Buy stock in Market <ArrowRight size={14} />
            </Link>
          ) : (
            <button
              type="button"
              className="button small"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              onClick={() => {
                setMode("Deposit");
                clear();
              }}
            >
              Deposit to this vault
            </button>
          )}
        </div>
      ) : (
        <div className="vault-stock-select">
          <img src={stocks[selectedStockId]?.logo ?? ""} alt="" width={24} height={24} />
          <select
            id="vault-stock"
            value={selectedStockId}
            disabled={working}
            onChange={(e) => {
              const id = e.target.value as StockId;
              setStock(id);
              onStockChange?.(id);
              clear();
            }}
          >
            {availableStocks.map((id) => (
              <option key={id} value={id}>
                {id} · {stocks[id].name}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="input-label" htmlFor="vault-amount">
        {deposit ? "Deposit value" : "Withdrawal value"}
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
            setExact(undefined);
            setError("");
            setHash("");
          }}
        />
        <span className="vault-denomination"><img src="/assets/usdc.png" alt="" width={20} height={20}/>pUSDC</span>
      </div>
      <div className="balance-line" id="vault-balance">
        <span>{rawInput ? deposit ? `${units(Number(rawInput))} ${selectedStockId}` : withdrawalValueUnits !== undefined ? `${units(Number(withdrawalValueUnits))} ${vaultId} value units` : "—" : "Value of your stock"}</span>
        <span>
          Available{" "}
          {account.ready &&
          (deposit ? account.stockReady[selectedStockId] : account.positionsReady)
            ? `${units(Number(usdLimit))} pUSDC`
            : "—"}
        </span>
      </div>
      {!valuationPrice && <small className="vault-unit-note">Live price unavailable. Retrying…</small>}
      <div className="shortcuts">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            type="button"
            disabled={working || !account.ready}
            onClick={() => {
              const raw=parseUnits(rawLimit,18)*BigInt(p)/100n;
              const key=rawAmountUsd(raw,mode,marketPrice,rawShares,rawCollateral);
              setAmount(key);setExact({key,raw:formatUnits(raw,18)});
              setError("");
              setHash("");
            }}
          >
            {p === 100 ? "Max" : `${p}%`}
          </button>
        ))}
      </div>
      {amount &&
        (!inputValid || rawUnits > parseUnits(rawLimit,18)) && (
          <p className="error" role="alert">
            {rawUnits > parseUnits(rawLimit,18)
              ? "Insufficient balance."
              : "Use a positive pUSDC value with up to 6 decimals."}
          </p>
        )}
      <div className="receipt">
        <span title={deposit ? "One value unit equals $1 of collateral at the live stock price. This denomination differs from the contract receipt units." : undefined}>Estimated receive{deposit ? " · value units" : ""}</span>
        <strong className="vault-denomination">
          <img src={deposit ? assets[vaultId] : stocks[selectedStockId].logo} alt="" width={26} height={26}/>
          <span className="vault-receipt-text">{quote ? deposit ? depositValueUnits !== undefined ? units(Number(depositValueUnits)) : "—" : units(quote.receive) : "—"} {deposit ? vaultId : selectedStockId}</span>
        </strong>

      </div>
      <dl className="carry-summary">
        <div>
          <dt>Live collateral value</dt>
          <dd>{collateralValue !== undefined ? money(collateralValue) : "—"}</dd>
        </div>
        <div>
          <dt>{deposit ? "Borrow allocation" : "Debt released"}</dt>
          <dd>
            {quote ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {units(quote.borrow)}{" "}
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
        <div>
          <dt>Network</dt>
          <dd>Portaldot V3</dd>
        </div>
      </dl>
      {!account.address ? (
        <p className="muted">Connect your wallet to continue.</p>
      ) : !configured ? (
        <p className="muted">
          {vaultIntegrationIssue ||
            "This vault is awaiting its deployment address."}
        </p>
      ) : null}
      {(error || quoteError) && (
        <p className="error" role="alert">
          {error || quoteError}
        </p>
      )}
      <Button
        className="full-width"
        disabled={!valid || working || !!account.pending || availableStocks.length === 0}
        type="submit"
      >
        {working
          ? account.pending || "Processing…"
          : availableStocks.length === 0
            ? deposit
              ? "No stock available"
              : "No position to withdraw"
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
            {!deposit&&confirmedPayout!==undefined&&<small className="vault-denomination"><img src="/assets/usdc.png" alt="" width={14} height={14}/>{units(confirmedPayout)} pUSDC received</small>}
            <TransactionLink hash={hash} />
          </div>
        </div>
      )}
    </form>
  );
}
