"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { BrandIcon } from "@/components/shared/BrandIcon";
import type { VaultId } from "@/lib/assets";
import { protocols, vaultProtocols, summarizeVault, formatBenchmarkTVL } from "@/lib/vault-market-data";
import { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import styles from "./landing.module.css";

const Chart = dynamic(() => import("@/components/shared/Chart").then(m => m.Chart), { ssr: false });
export function LandingVaultCard({ vaultId, market }: {
  vaultId: VaultId;
  market: ReturnType<typeof useVaultMarketData>;
}) {
  const prime = vaultId === "pxPrime";
  const summary = summarizeVault(vaultId, market.histories);
  const series = useMemo(() => vaultProtocols[vaultId].flatMap(id => {
    const history = market.histories[id];
    return history?.length ? [{ name: protocols[id].name, color: protocols[id].color, logo: protocols[id].logo,
      values: history.slice(-7).map(p => ({ time: p.time, value: p.apy })) }] : [];
  }), [vaultId, market.histories]);
  return <article className={styles.card}>
    <div className={styles.identity}><BrandIcon brand={vaultId} size={72} /><div>
      <h2>{vaultId}</h2><p>{prime ? "Earn from stablecoin lending." : "Earn from AMM trading fees."}</p>
    </div></div>
    <div className={styles.protocolRisk}>
      <div className={styles.protocols}>{vaultProtocols[vaultId].map(id => <div key={id}>
        <img src={protocols[id].logo} width="36" height="36" alt="" /><span>{protocols[id].name}</span>
      </div>)}</div>
      <div className={styles.risk}><span>Risk</span><div className={styles.bars} aria-label={`${prime ? "Lower" : "Moderate"} risk`}>
        {[0,1,2,3,4].map(i => <i key={i} style={i < (prime ? 2 : 3) ? { background: prime ? "#32e4de" : "#ffc24f" } : undefined} />)}
      </div><span>{prime ? "Lower" : "Moderate"}</span></div>
    </div>
    <div className={styles.metrics}>
      <div><span>Benchmark {prime ? "supply" : "fee"} APY</span><strong>{summary ? `${summary.apy.toFixed(2)}%` : "—"}</strong></div>
      <div><span>Benchmark TVL</span><b>{summary ? formatBenchmarkTVL(summary.tvl) : "—"}</b></div>
      <div><span>Initial LTV</span><b>40%</b></div>
    </div>
    <div className={styles.chartHeading}><span>{prime ? "Supply APY" : "Uniswap fee APY"}</span><span>7D</span></div>
    <div className={styles.chart}>{summary ? <Chart series={series} height={128} /> : <div className={styles.unavailable} role="status">{market.status === "error" ? "Seven-day history unavailable." : "Fetching seven-day history…"}</div>}</div>
  </article>;
}
