"use client";
import { useEffect, useRef } from "react";
import { Check, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { stocks } from "@/lib/assets";
import { getVaultProcessState, type VaultProcess } from "./process-state";

export function CarryFlow({
  process,
  onHistory,
}: {
  process: VaultProcess;
  onHistory: () => void;
}) {
  const account = usePortfolio();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }, []);
  if (account.address?.toLowerCase() !== process.owner.toLowerCase())
    return null;
  const { phase, hash, error } = getVaultProcessState(
    process,
    account.activity,
  );
  const terminal = phase === "confirmed" || phase === "failed";
  const active = phase === "signing" ? 0 : phase === "confirming" ? 1 : 2;
  return (
    <section
      ref={ref}
      className="carry-flow panel vault-process"
      aria-label="Vault transaction progress"
    >
      <div className="carry-flow-header">
        <div className="vault-process-identity">
          <BrandIcon brand={process.vaultId} size={38} />
          <div>
            <h3>
              {process.type === "Deposit"
                ? "Depositing into"
                : "Withdrawing from"}{" "}
              {process.vaultId}
            </h3>
            <p>
              <img
                src={stocks[process.stockId].logo}
                width={16}
                height={16}
                alt=""
              />
              {process.stockId} · Portaldot
            </p>
          </div>
        </div>
        <button
          type="button"
          className="vault-process-history"
          onClick={onHistory}
        >
          View history
        </button>
      </div>
      <ol className="vault-process-steps" aria-label="Transaction stages">
        {["Wallet signature", "Network confirmation", "Complete"].map(
          (label, index) => (
            <li
              key={label}
              className={
                index < active || phase === "confirmed"
                  ? "complete"
                  : index === active
                    ? "current"
                    : ""
              }
              aria-current={index === active && !terminal ? "step" : undefined}
            >
              <span>
                {phase === "failed" && index === active ? (
                  <XCircle size={19} />
                ) : index < active || phase === "confirmed" ? (
                  <Check size={18} />
                ) : index === active ? (
                  <Loader2 size={18} className="process-spinner" />
                ) : (
                  <Circle size={18} />
                )}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      <div className="vault-process-result" role="status" aria-live="polite">
        {phase === "confirmed" ? (
          <>
            <CheckCircle2 size={18} />
            <span>{process.type} confirmed</span>
          </>
        ) : phase === "failed" ? (
          <>
            <XCircle size={18} />
            <span>{error || "Transaction failed."}</span>
          </>
        ) : (
          <span>
            {account.pending ||
              (phase === "confirming"
                ? "Waiting for network confirmation…"
                : "Continue in your wallet…")}
          </span>
        )}
      </div>
      {hash && (
        <div className="vault-process-proof">
          <span>Transaction</span>
          <TransactionLink hash={hash} />
        </div>
      )}
    </section>
  );
}
