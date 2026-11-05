"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
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
import { PoolVolume } from "./PoolVolume";
import { useVaultMarketData } from "./useVaultMarketData";
const Chart = dynamic(
  () => import("@/components/shared/Chart").then((module) => module.Chart),
  {
    ssr: false,
    loading: () => (
      <div className="overview-chart-placeholder">Loading chart…</div>
    ),
  },
);

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
  const series = useMemo(
    () =>
      vaultProtocols[vaultId].flatMap((id) => {
        const history = market.histories[id];
        if (!history?.length) return [];
        const protocol = protocols[id];
        return [
          {
            name: protocol.name,
            color: protocol.color,
            logo: protocol.logo,
            values: history
              .slice(-7)
              .map((point) => ({ time: point.time, value: point.apy })),
          },
        ];
      }),
    [vaultId, market.histories],
  );
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
          <PoolVolume vaultId={vaultId} benchmarkTVL={summary?.tvl}/>
        </div>
        <div>
          <span>Initial LTV</span>
          <b>40%</b>
        </div>
      </div>
      <div className="overview-vault-chart-heading">
        <span>{prime ? "Supply APY" : "Uniswap fee APY"}</span>
        <span className="period" aria-label="Seven-day chart">
          7D
        </span>
      </div>
      {summary ? (
        <Chart series={series} height={190} />
      ) : (
        <div className="overview-chart-placeholder" role="status">
          {market.status === "error"
            ? "Seven-day history unavailable."
            : "Fetching seven-day history…"}
        </div>
      )}
      <Button className="full-width deposit-button" onClick={onDeposit}>
        Deposit <ArrowRight size={21} />
      </Button>
    </Panel>
  );
}
