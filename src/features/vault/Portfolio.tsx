"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { price6, vaultValueUnits } from "@/lib/vault-amounts";
import { ArrowRight, Check } from "lucide-react";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { Panel } from "@/components/shared/Panel";
import { Button } from "@/components/shared/Button";
import { BrandIcon } from "@/components/shared/BrandIcon";
import {
  stocks,
  stockIds,
  money,
  units,
  type StockId,
  type VaultId,
} from "@/lib/assets";
import { useVaultMarketData } from "./useVaultMarketData";
import { summarizeVault } from "@/lib/vault-market-data";
import { projectedYield } from "@/lib/yield-projection";
import { usePortfolio, type Activity } from "@/lib/portfolio-store";

function getHistoryActionDetails(a: Activity) {
  switch (a.type) {
    case "Buy":
      return {
        title: "Buy Stock",
        category: "Stock Market",
        badge: "action-badge-buy",
      };
    case "Sell":
      return {
        title: "Sell Stock",
        category: "Stock Market",
        badge: "action-badge-sell",
      };
    case "Deposit":
      return {
        title: "Vault Deposit",
        category: "Carry Vault",
        badge: "action-badge-deposit",
      };
    case "Withdraw":
      return {
        title: "Vault Withdraw",
        category: "Carry Vault",
        badge: "action-badge-withdraw",
      };
    case "Faucet":
      return {
        title: "Faucet Claim",
        category: "Testnet Funding",
        badge: "action-badge-faucet",
      };
    case "Approve":
      return {
        title: "Token Approval",
        category: "Authorization",
        badge: "action-badge-approve",
      };
    default:
      return {
        title: String(a.type),
        category: "On-chain",
        badge: "action-badge-default",
      };
  }
}
export function Portfolio({
  onManage,
}: {
  onManage: (
    vaultId: VaultId,
    stockId: StockId,
    mode: "Deposit" | "Withdraw",
  ) => void;
}) {
  const {
      pUSDC,
      stockBalances,
      positions,
      activity,
      prices,
      settlementPrices,
      ready,
      stockReady,
      positionsReady,
      address,
      error,
      pending,
    } = usePortfolio(),
    [tab, setTab] = useState("Vault positions");

  const market=useVaultMarketData();
  const [now,setNow]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  const projection=(p:typeof positions[number])=>projectedYield(p,activity,summarizeVault(p.vaultId,market.histories)?.apy,settlementPrices[p.stockId],now);
  const displayUnits = (p: typeof positions[number]) => vaultValueUnits(parseUnits(p.rawCollateral ?? String(p.collateral), 18), price6(prices[p.stockId]));
  const historyItems = activity;
  const earned = positions.reduce((sum, p) => sum + (projection(p)??0), 0),
    value =
      stockIds.reduce(
        (sum, id) => sum + stockBalances[id] * (prices[id] ?? 0),
        0,
      ) +
      positions.reduce(
        (sum, p) => sum + p.collateral * (prices[p.stockId] ?? 0),
        0,
      ) +
      pUSDC;
  return (
    <Panel className="portfolio">
      <h2>Your portfolio</h2>
      {!address && (
        <p className="muted">Connect your wallet to view your portfolio.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("portix:refresh"))}
          >
            Retry
          </button>
        </p>
      )}
      {pending && (
        <p className="muted" role="status">
          {pending}
        </p>
      )}
      <div className="portfolio-summary">
        <div>
          <span>Portfolio value</span>
          <strong>
            {ready &&
            positionsReady &&
            stockIds.every(
              (id) =>
                !(
                  stockBalances[id] > 0 ||
                  positions.some((p) => p.stockId === id)
                ) || prices[id],
            )
              ? money(value)
              : "—"}
          </strong>
        </div>
        <div>
          <span>Projected gross yield</span>
          <strong className="positive">
            {ready && positionsReady && positions.every(p=>projection(p)!==undefined) ? money(earned) : "—"}
          </strong>
        </div>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            Available{" "}
            <img
              src="/assets/usdc.png"
              alt="pUSDC"
              width={14}
              height={14}
              style={{ borderRadius: "50%", verticalAlign: "middle" }}
            />{" "}
            pUSDC
          </span>
          <div className="portfolio-pusdc-row">
            <strong>{ready ? Math.trunc(pUSDC).toLocaleString("en-US") : "—"}</strong>
            <img
              src="/assets/usdc.png"
              alt="pUSDC"
              width={24}
              height={24}
              className="portfolio-pusdc-logo"
            />
          </div>
        </div>
      </div>
      <div
        className="portfolio-tabs"
        role="tablist"
        aria-label="Portfolio views"
      >
        {["Vault positions", "Wallet stocks", "History"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="table-scroll" role="tabpanel" aria-label={tab}>
        {tab === "Vault positions" ? (
          <table>
            <thead>
              <tr>
                <th>Vault</th>
                <th>Collateral / value units</th>
                <th>Value</th>
                <th title="Time-based estimate using the latest benchmark APY on 40% borrowed allocation; not a claimable balance.">Projected yield</th>
                <th>Health</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-identity">
                      <BrandIcon brand={p.vaultId} size={43} />
                      <b>{p.vaultId}</b>
                    </div>
                  </td>
                  <td>
                    <div className="table-identity">
                      <img
                        src={stocks[p.stockId].logo}
                        width="26"
                        height="26"
                        alt=""
                      />
                      <div>
                        {units(p.collateral)} {p.stockId}
                        <small>
                          {displayUnits(p) !== undefined ? units(Number(displayUnits(p))) : "—"} {p.vaultId} value units
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {prices[p.stockId]
                      ? money(p.collateral * prices[p.stockId]!)
                      : "—"}
                  </td>
                  <td className="positive" title="Benchmark projection, not earned or claimable funds">{projection(p)===undefined?"—":`+${money(projection(p)!)}`}</td>
                  <td>
                    <span className={p.healthy ? "positive" : "negative"}>
                      {p.healthy ? "Healthy" : "At risk"}
                    </span>
                    <small>{p.ltv.toFixed(2)}% LTV</small>
                  </td>
                  <td>
                    <Button
                      onClick={() => onManage(p.vaultId, p.stockId, "Withdraw")}
                    >
                      Manage <ArrowRight size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === "Wallet stocks" ? (
          (() => {
            const ownedStocks = stockIds.filter(
              (id) => (stockBalances[id] ?? 0) > 0,
            );
            if (!ownedStocks.length) {
              return (
                <div className="empty-state">
                  <p>You do not hold any tokenized stocks in your wallet yet.</p>
                  <Link
                    href="/market"
                    className="button"
                    style={{
                      display: "inline-flex",
                      marginTop: "12px",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    Buy stock in Market <ArrowRight size={16} />
                  </Link>
                </div>
              );
            }
            return (
              <table>
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Holdings</th>
                    <th>Price</th>
                    <th>Value</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ownedStocks.map((id) => (
                    <tr key={id}>
                      <td>
                        <div className="table-identity">
                          <img
                            src={stocks[id].logo}
                            width="34"
                            height="34"
                            alt=""
                          />
                          <div>
                            <b>{id}</b>
                            <small>{stocks[id].name}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {ready && stockReady[id] ? units(stockBalances[id]) : "—"}
                      </td>
                      <td>{prices[id] ? money(prices[id]!) : "—"}</td>
                      <td>
                        {ready && stockReady[id] && prices[id]
                          ? money(stockBalances[id] * prices[id]!)
                          : "—"}
                      </td>
                      <td>
                        <Button
                          disabled={stockBalances[id] <= 0}
                          onClick={() => onManage("pxPrime", id, "Deposit")}
                        >
                          Deposit to vault <ArrowRight size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action / Type</th>
                <th>Asset / Amount</th>
                <th>On-chain proof</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.map((a) => {
                const info = getHistoryActionDetails(a);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="history-action-cell">
                        <span className={`action-badge ${info.badge}`}>
                          {info.title}
                        </span>
                        <small>{info.category}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {a.stockId === "pUSDC" ? (
                          <img
                            src="/assets/usdc.png"
                            alt="pUSDC"
                            width={18}
                            height={18}
                            style={{ borderRadius: "50%" }}
                          />
                        ) : (
                          stocks[a.stockId as StockId]?.logo && (
                            <img
                              src={stocks[a.stockId as StockId].logo}
                              alt={a.stockId}
                              width={18}
                              height={18}
                              style={{ borderRadius: "50%" }}
                            />
                          )
                        )}
                        <b>{units(a.type==="Withdraw"?Number(a.stockReturned??a.amount/3):a.amount)}</b>{" "}
                        <span>
                          {a.legacy
                            ? a.stockId === "pUSDC"
                              ? "pUSDC"
                              : "demo stock"
                            : a.stockId}
                        </span>
                      </div>
                      {a.stockId!=="pUSDC"&&<small>{(a.usdcAmount??a.spend)!==undefined?`${units((a.usdcAmount??a.spend)!)} pUSDC ${a.type==="Buy"?(a.status==="Completed"?"spent":"to spend"):"received"}`:prices[a.stockId]?`≈ ${money((a.type==="Withdraw"?Number(a.stockReturned??a.amount/3):a.amount)*prices[a.stockId]!)} pUSDC`:"— pUSDC"}</small>}
                    </td>
                    <td>
                      <div className="table-proof-cell">
                        <TransactionLink hash={a.hash} />
                        {a.status === "Completed" && (
                          <span className="onchain-pill" title="Verified on Portaldot block scanner">
                            <Check size={11} /> On-chain
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <time dateTime={a.timestamp}>
                        {new Date(a.timestamp).toLocaleString()}
                      </time>
                    </td>
                    <td
                      className={
                        a.status === "Completed"
                          ? "positive"
                          : a.status === "Failed"
                            ? "negative"
                            : "muted"
                      }
                    >
                      {a.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {((tab === "Vault positions" && !positions.length) ||
          (tab === "History" && !historyItems.length)) && (
          <div className="empty-state">
            {tab === "History"
              ? "Your transaction history will appear here."
              : ready && !positionsReady
                ? "Vault positions are currently unavailable."
                : "No vault positions yet. Choose a strategy above to start earning."}
          </div>
        )}
      </div>
    </Panel>
  );
}
