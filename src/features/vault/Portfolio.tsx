"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
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
import { usePortfolio } from "@/lib/portfolio-store";
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
      ready,
      stockReady,
      positionsReady,
      address,
      error,
      pending,
    } = usePortfolio(),
    [tab, setTab] = useState("Vault positions");
  const earned = positions.reduce((sum, p) => sum + p.earnedYield, 0),
    value =
      stockIds.reduce(
        (sum, id) => sum + stockBalances[id] * (prices[id] ?? 0),
        0,
      ) +
      positions.reduce(
        (sum, p) => sum + p.collateral * (prices[p.stockId] ?? 0),
        0,
      ) +
      earned +
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
          <span>Earned yield</span>
          <strong className="positive">
            {ready && positionsReady ? money(earned) : "—"}
          </strong>
        </div>
        <div>
          <span>Available pUSDC</span>
          <strong>{ready ? units(pUSDC) : "—"}</strong>
        </div>
      </div>
      <div
        className="portfolio-tabs"
        role="tablist"
        aria-label="Portfolio views"
      >
        {["Vault positions", "Wallet stocks", "Activity"].map((t) => (
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
                <th>Collateral / shares</th>
                <th>Value</th>
                <th>Earned</th>
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
                          {units(p.shares)} {p.vaultId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {prices[p.stockId]
                      ? money(p.collateral * prices[p.stockId]!)
                      : "—"}
                  </td>
                  <td className="positive">+{money(p.earnedYield)}</td>
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
              {stockIds.map((id) => (
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
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Asset / amount</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.type}
                    {a.vaultId && <small>{a.vaultId}</small>}
                    <TransactionLink hash={a.hash} />
                  </td>
                  <td>
                    {units(a.amount)} {a.stockId}
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
              ))}
            </tbody>
          </table>
        )}
        {((tab === "Vault positions" && !positions.length) ||
          (tab === "Activity" && !activity.length)) && (
          <div className="empty-state">
            {tab === "Activity"
              ? "Your activity will appear here after your first trade or vault action."
              : ready && !positionsReady
                ? "Vault positions are currently unavailable."
                : "No vault positions yet. Choose a strategy above to start earning."}
          </div>
        )}
      </div>
    </Panel>
  );
}
