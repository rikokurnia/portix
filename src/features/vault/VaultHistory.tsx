"use client";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { stocks, units, type VaultId, type StockId } from "@/lib/assets";
import { Check } from "lucide-react";

export function VaultHistory({ vaultId }: { vaultId: VaultId }) {
  const { address, activity } = usePortfolio();
  const entries = activity.filter(
    (a) => a.type === "Deposit" && a.vaultId === vaultId,
  );
  return (
    <div className="vault-detail-history">
      <h2>Deposit history</h2>
      {!entries.length ? (
        <div className="empty-state">
          {address
            ? "Your deposits into this vault will appear here."
            : "Connect your wallet to view your history."}
        </div>
      ) : (
        <ol className="vault-history-list">
          {entries.map((a) => (
            <li key={a.hash}>
              <div className="vault-history-main">
                <div className="vault-history-asset">
                  {a.stockId === "pUSDC" ? (
                    <img
                      src="/assets/usdc.png"
                      width={28}
                      height={28}
                      alt="pUSDC"
                      style={{ borderRadius: "50%" }}
                    />
                  ) : stocks[a.stockId as StockId] ? (
                    <img
                      src={stocks[a.stockId as StockId].logo}
                      width={28}
                      height={28}
                      alt=""
                    />
                  ) : null}
                  <div>
                    <strong>Vault Deposit</strong>
                    <small>
                      {units(a.amount)} {a.stockId}
                    </small>
                  </div>
                </div>
                <div className="vault-history-status-block">
                  <span
                    className={
                      a.status === "Completed"
                        ? "positive onchain-pill"
                        : a.status === "Failed"
                          ? "negative"
                          : "muted"
                    }
                  >
                    {a.status === "Completed" ? (
                      <>
                        <Check size={12} /> On-chain Confirmed
                      </>
                    ) : (
                      a.status
                    )}
                  </span>
                </div>
              </div>
              <div className="vault-history-meta">
                <TransactionLink hash={a.hash} />
                <time dateTime={a.timestamp}>
                  {new Date(a.timestamp).toLocaleString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
