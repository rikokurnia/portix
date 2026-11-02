"use client";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/shared/Panel";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { Button } from "@/components/shared/Button";
import { vaults, type VaultId } from "@/lib/assets";
import { primeSeries, boostSeries } from "./data";
const Chart = dynamic(
  () => import("@/components/shared/Chart").then((m) => m.Chart),
  { ssr: false, loading: () => <div style={{ height: 218 }} /> },
);
export function StrategyCard({
  vaultId,
  onDeposit,
}: {
  vaultId: VaultId;
  onDeposit: () => void;
}) {
  const prime = vaultId === "pxPrime",
    series = prime ? primeSeries : boostSeries;
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
          {series.map((s) => (
            <div key={s.name}>
              <img src={s.logo} alt={`${s.name} logo`} width="42" height="42" />
              <span>{s.name}</span>
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
      <div className="strategy-metrics">
        <div>
          <span>Avg {prime ? "Supply" : "Fee"} APY</span>
          <strong>{vaults[vaultId].apy.toFixed(1)}%</strong>
        </div>
        <div>
          <span>Total TVL</span>
          <b>{prime ? "$1.45M" : "$820K"}</b>
        </div>
        <div>
          <span>24h Volume</span>
          <b>{prime ? "$120K" : "$340K"}</b>
        </div>
        <span className="period">7D</span>
      </div>
      <Chart series={series} />
      <Button className="full-width deposit-button" onClick={onDeposit}>
        Deposit <ArrowRight size={21} />
      </Button>
    </Panel>
  );
}
