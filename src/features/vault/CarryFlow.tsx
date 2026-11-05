"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, XCircle } from "lucide-react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { stocks } from "@/lib/assets";
import { getVaultProcessState, type VaultProcess } from "./process-state";

const FlowDiagram = dynamic(
  () => import("./FlowDiagram").then((module) => module.FlowDiagram),
  {
    ssr: false,
    loading: () => (
      <div className="vault-route-loading" role="status">
        Preparing your carry route…
      </div>
    ),
  },
);

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
    ref.current?.scrollIntoView({
      block: "nearest",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);
  if (account.address?.toLowerCase() !== process.owner.toLowerCase())
    return null;
  const { phase, hash, error } = getVaultProcessState(
    process,
    account.activity,
  );
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
      <FlowDiagram
        vaultId={process.vaultId}
        stockId={process.stockId}
        phase={phase}
        type={process.type}
        message={account.pending}
      />
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
        ) : null}
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
