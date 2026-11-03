"use client";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { Button } from "@/components/shared/Button";
import { vaults, type VaultId } from "@/lib/assets";
import {
  protocols,
  vaultProtocols,
  summarizeVault,
  formatBenchmarkTVL,
} from "@/lib/vault-market-data";
import { useVaultMarketData } from "./useVaultMarketData";
export function StrategyCard({
  vaultId,
  onDeposit,
  market,
}: {
  vaultId: VaultId;
  onDeposit: () => void;
  market: ReturnType<typeof useVaultMarketData>;
}) {
  const prime = vaultId === "pxPrime",
    summary = summarizeVault(vaultId, market.histories);
  return (
    <Panel className={`strategy-card ${prime ? "prime" : "boost"}`}>
      <div className="strategy-identity">
        <BrandIcon brand={vaultId} size={100} />
        <div>
          <h2>{vaultId}</h2>
          <p>{vaults[vaultId].description}</p>
        </div>
      </div>
      <div className="protocol-risk">
        <div className="protocols">
          {vaultProtocols[vaultId].map((id) => (
            <div key={id}>
              <img
                src={protocols[id].logo}
                alt={`${protocols[id].name} logo`}
                width="42"
                height="42"
              />
              <span>{protocols[id].name}</span>
            </div>
          ))}
        </div>
        <div className="risk">
          <span>Risk</span>
          <div
            className="risk-bars"
            aria-label={`${prime ? "Lower" : "Moderate"} risk`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} className={i < (prime ? 2 : 3) ? "lit" : ""} />
            ))}
          </div>
          <span>{prime ? "Lower" : "Moderate"}</span>
        </div>
      </div>
      <div className="overview-vault-metrics">
        <div>
          <span>{prime ? "Blended supply APY" : "Uniswap fee APY"}</span>
          <strong className="vault-apy">
            {summary ? `${summary.apy.toFixed(2)}%` : "—"}
          </strong>
        </div>
        <div>
          <span>Benchmark TVL</span>
          <b>{summary ? formatBenchmarkTVL(summary.tvl) : "—"}</b>
        </div>
        <div>
          <span>Initial LTV</span>
          <b>40%</b>
        </div>
      </div>
      {!summary && (
        <p className="vault-source-note">
          {market.status === "error"
            ? "Benchmark feed unavailable."
            : "Fetching protocol benchmarks…"}
        </p>
      )}
      <Button className="full-width deposit-button" onClick={onDeposit}>
        Deposit <ArrowRight size={21} />
      </Button>
    </Panel>
  );
}
