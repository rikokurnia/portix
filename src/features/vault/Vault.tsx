"use client";
import { useState } from "react";
import { StrategyCard } from "./StrategyCard";
import { Portfolio } from "./Portfolio";
import { DepositModal } from "./DepositModal";
import type { StockId, VaultId } from "@/lib/assets";
export function Vault() {
  const [selection, setSelection] = useState<{
    vaultId: VaultId;
    stockId: StockId;
    mode: "Deposit" | "Withdraw";
  } | null>(null);
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
            onDeposit={() =>
              setSelection({ vaultId: id, stockId: "GOOGL", mode: "Deposit" })
            }
          />
        ))}
      </div>
      <Portfolio
        onManage={(vaultId, stockId, mode) =>
          setSelection({ vaultId, stockId, mode })
        }
      />
      {selection && (
        <DepositModal
          vaultId={selection.vaultId}
          initialStock={selection.stockId}
          initialMode={selection.mode}
          onClose={() => setSelection(null)}
        />
      )}
    </main>
  );
}
