"use client";
import "./vault.css";
import { useRouter } from "next/navigation";
import { StrategyCard } from "./StrategyCard";
import { Portfolio } from "./Portfolio";
import { useVaultMarketData } from "./useVaultMarketData";
export function Vault() {
  const router = useRouter(),
    market = useVaultMarketData();
  return (
    <main className="page vault-page">
      <div className="hero">
        <h1>Make your stocks productive.</h1>
        <p>Deposit tokenized stocks. Choose how your borrowed pUSDC earns.</p>
      </div>
      <div className="strategy-grid">
        {(["pxPrime", "pxBoost"] as const).map((id) => (
          <StrategyCard
            key={id}
            vaultId={id}
            market={market}
            onDeposit={() => router.push(`/vault/${id}`)}
          />
        ))}
      </div>
      {market.error && (
        <p className="vault-feed-error" role="status">
          {market.error}{" "}
          <button type="button" onClick={() => void market.refresh()}>
            Retry
          </button>
        </p>
      )}
      <Portfolio
        onManage={(vaultId, stockId, mode) =>
          router.push(
            `/vault/${vaultId}?stock=${stockId}&mode=${mode.toLowerCase()}`,
          )
        }
      />
    </main>
  );
}
