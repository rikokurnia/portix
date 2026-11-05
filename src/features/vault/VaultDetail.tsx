"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import {
  stockIds,
  vaults,
  type StockId,
  type VaultId,
} from "@/lib/assets";
import {
  protocols,
  vaultProtocols,
  summarizeVault,
  formatBenchmarkTVL,
} from "@/lib/vault-market-data";
import { PoolVolume } from "./PoolVolume";
import { useVaultMarketData } from "./useVaultMarketData";
import { VaultForm } from "./VaultForm";
import { VaultAbout } from "./VaultAbout";
import { VaultHistory } from "./VaultHistory";
import type { VaultProcess } from "./process-state";
import { CarryFlow } from "./CarryFlow";
import "./vault.css";
const Chart = dynamic(
  () => import("@/components/shared/Chart").then((m) => m.Chart),
  {
    ssr: false,
    loading: () => (
      <div className="vault-chart-placeholder">Loading chart…</div>
    ),
  },
);
export function VaultDetail({ vaultId }: { vaultId: VaultId }) {
  const search = useSearchParams(),
    requested = search.get("stock"),
    initialStock = stockIds.includes(requested as StockId)
      ? (requested as StockId)
      : "GOOGL",
    initialMode = search.get("mode") === "withdraw" ? "Withdraw" : "Deposit";
  const market = useVaultMarketData(),
    [tab, setTab] = useState<"Chart" | "About" | "History">("Chart"),
    [days, setDays] = useState(7),
    [process, setProcess] = useState<VaultProcess | null>(null);
  const summary = summarizeVault(vaultId, market.histories),
    ids = vaultProtocols[vaultId],
    hasData = ids.every((id) => market.histories[id]?.length);
  const series = useMemo(
    () =>
      vaultProtocols[vaultId].flatMap((id) => {
        const points = market.histories[id];
        if (!points) return [];
        const p = protocols[id];
        return [
          {
            name: p.name,
            color: p.color,
            logo: p.logo,
            values: points
              .slice(-days)
              .map((row) => ({ time: row.time, value: row.apy })),
          },
        ];
      }),
    [market.histories, vaultId, days],
  );
  return (
    <main className="vault-detail-page">
      <Link className="all-vaults" href="/vault">
        <ArrowLeft size={16} />
        All vaults
      </Link>
      <header className="vault-detail-header">
        <div className="detail-vault-identity">
          <BrandIcon brand={vaultId} size={64} />
          <div>
            <h1>{vaultId}</h1>
            <p>{vaults[vaultId].description}</p>
          </div>
        </div>
        <nav className="detail-vault-switch" aria-label="Select vault">
          {(["pxPrime", "pxBoost"] as const).map((id) => (
            <Link
              key={id}
              href={`/vault/${id}`}
              aria-current={id === vaultId ? "page" : undefined}
            >
              {id}
            </Link>
          ))}
        </nav>
      </header>
      <div className="vault-detail-grid">
        <section className="vault-information panel">
          <div className="vault-data-metrics">
            <div>
              <span>
                {vaultId === "pxPrime"
                  ? "Blended supply APY"
                  : "Uniswap fee APY"}
              </span>
              <strong className="vault-apy">
                {summary ? `${summary.apy.toFixed(2)}%` : "—"}
              </strong>
            </div>
            <div>
              <span>Benchmark TVL</span>
              <b>{summary ? formatBenchmarkTVL(summary.tvl) : "—"}</b>
          <PoolVolume vaultId={vaultId}/>
            </div>
            <div>
              <span>Initial LTV</span>
              <b>40%</b>
            </div>
          </div>
          <div
            className="vault-information-tabs"
            role="tablist"
            aria-label="Vault information"
          >
            {(["Chart", "About", "History"] as const).map((t) => (
              <button
                type="button"
                key={t}
                role="tab"
                id={`vault-tab-${t}`}
                aria-controls="vault-information-content"
                aria-selected={tab === t}
                onClick={() => {setTab(t); if(t === "History") setProcess(null);}}
              >
                {t}
              </button>
            ))}
            {tab === "Chart" && (
              <div className="vault-periods" aria-label="Chart period">
                {[7, 30].map((n) => (
                  <button
                    type="button"
                    aria-pressed={days === n}
                    key={n}
                    onClick={() => setDays(n)}
                  >
                    {n}D
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            role="tabpanel"
            id="vault-information-content"
            aria-labelledby={`vault-tab-${tab}`}
          >
            {tab === "Chart" ? (
              <>
                <div className="vault-chart-heading">
                  <div>
                    <h2>
                      {vaultId === "pxPrime"
                        ? "Lending supply APY"
                        : "Uniswap fee APY"}
                    </h2>
                    <p>
                      {vaultId === "pxPrime"
                        ? "Morpho · Aave V3 · Compound III"
                        : "Uniswap V3 · USDC / WETH · 0.05% fee"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="refresh-yields"
                    aria-label="Refresh benchmark data"
                    disabled={market.refreshing}
                    onClick={() => void market.refresh()}
                  >
                    <RefreshCw
                      size={15}
                      className={market.refreshing ? "is-refreshing" : ""}
                    />
                  </button>
                </div>
                {hasData ? (
                  <Chart series={series} height={350} />
                ) : (
                  <div className="vault-chart-placeholder">
                    {market.status === "loading"
                      ? "Fetching benchmark history…"
                      : "Benchmark history is unavailable."}
                    {market.status === "error" && (
                      <button
                        type="button"
                        onClick={() => void market.refresh()}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                )}
                <div className="vault-feed-status">
                  <span>
                    {summary
                      ? `Source observation: ${new Date(summary.updatedAt).toLocaleString()}`
                      : "Waiting for source observations"}
                  </span>
                  <span>Auto-refresh 60s</span>
                </div>
              </>
            ) : tab === "History" ? <VaultHistory vaultId={vaultId} /> : (
              <VaultAbout vaultId={vaultId} histories={market.histories} />
            )}
          </div>
          {market.error && (
            <p className="vault-feed-error" role="status">
              {market.error}{" "}
              <button type="button" onClick={() => void market.refresh()}>
                Retry
              </button>
            </p>
          )}
        </section>
        <VaultForm
          key={`${vaultId}-${initialStock}-${initialMode}`}
          vaultId={vaultId}
          initialStock={initialStock}
          initialMode={initialMode}
          onProcess={(event) => {
            if(event.type === 'start') setProcess(event.process);
            else {
              setProcess(current => current?.id === event.id ? null : current);
              if (event.result.ok) {setTab('History');document.getElementById('vault-tab-History')?.focus();}
            }
          }}
        />
      </div>
      {process && tab !== 'History' && <CarryFlow process={process} onHistory={() => {setTab('History');setProcess(null);document.getElementById('vault-tab-History')?.focus();}} />}
    </main>
  );
}
