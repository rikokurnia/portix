"use client";
import { useState } from "react";
import { Copy, Check, ExternalLink, ArrowRight } from "lucide-react";
import {
  protocols,
  vaultProtocols,
  type ProtocolId,
  type YieldPoint,
} from "@/lib/vault-market-data";
import {
  contracts,
  vaultAddress,
  explorerContract,
} from "@/lib/onchain/contracts";
import { money, stockIds, type VaultId } from "@/lib/assets";
function ContractAddress({
  address,
  chain,
}: {
  address: string;
  chain: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="contract-address">
      <a
        href={`https://${chain === "Base" ? "basescan.org" : "etherscan.io"}/address/${address}`}
        target="_blank"
        rel="noreferrer"
      >
        {address}
        <ExternalLink size={12} />
      </a>
      <button
        type="button"
        aria-label={`Copy ${address}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {error && <small role="status">Select the address to copy it.</small>}
    </div>
  );
}
export function VaultAbout({
  vaultId,
  histories,
}: {
  vaultId: VaultId;
  histories: Partial<Record<ProtocolId, YieldPoint[]>>;
}) {
  const prime = vaultId === "pxPrime";
  return (
    <div className="vault-about">
      <section className="about-intro">
        <h3>
          {prime ? "Diversified lending carry" : "Concentrated liquidity carry"}
        </h3>
        <p>
          {prime
            ? "Stock collateral supports a 40% pUSDC borrowing allocation, designed to route into Morpho, Aave V3 and Compound III lending markets."
            : "Stock collateral supports a 40% pUSDC borrowing allocation, designed to route into Uniswap V3 liquidity for trading-fee income."}
        </p>
        <p className="about-risk">
          {prime
            ? "Risks: collateral price declines, liquidation, borrowing costs, and protocol or bridge failures."
            : "Risks: impermanent loss, inactive liquidity ranges, variable fees, liquidation, and protocol or bridge failures."}{" "}
          Public benchmark APYs are not guaranteed net returns on stock
          collateral.
        </p>
      </section>
      <section>
        <h3>Destination protocols</h3>
        {vaultProtocols[vaultId].map((id, index) => {
          const p = protocols[id],
            latest = histories[id]?.at(-1);
          return (
            <details className="protocol-detail" key={id} open={index === 0}>
              <summary>
                <img src={p.logo} width="28" height="28" alt="" />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.chain} · {p.symbol}
                  </small>
                </span>
                <b className="vault-apy">
                  {latest ? `${latest.apy.toFixed(2)}%` : "—"}
                </b>
              </summary>
              <div className="protocol-detail-body">
                <p>{p.strategy}</p>
                <dl>
                  <div>
                    <dt>Benchmark TVL</dt>
                    <dd>{latest ? money(latest.tvl) : "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Contract role</dt>
                    <dd>{p.contractRole}</dd>
                  </div>
                  <div>
                    <dt>Observation</dt>
                    <dd>
                      {latest
                        ? new Date(latest.timestamp).toLocaleString()
                        : "Waiting for feed"}
                    </dd>
                  </div>
                </dl>
                <ContractAddress address={p.contract} chain={p.chain} />
                <div className="protocol-source-links">
                  <a href={p.docs} target="_blank" rel="noreferrer">
                    Protocol docs <ExternalLink size={12} />
                  </a>
                  <a href={p.contractSource} target="_blank" rel="noreferrer">
                    Address source <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://defillama.com/yields/pool/${p.pool}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Benchmark pool <ExternalLink size={12} />
                  </a>
                </div>
                <small>
                  Protocol core contract shown; PORTIX adapters and benchmark
                  pool instances are separate contracts.
                </small>
              </div>
            </details>
          );
        })}
      </section>
      <section className="about-bridge">
        <h3>Built around a multichain route</h3>
        <div className="bridge-route">
          <span>
            <img src="/assets/portaldot.png" width="22" height="22" alt="" />
            Portaldot V3
          </span>
          <ArrowRight size={16} />
          <span>Bridge</span>
          <ArrowRight size={16} />
          <span>{prime ? "Base / Ethereum" : "Ethereum"}</span>
        </div>
        <p>
          Collateral and vault receipts are designed to stay on Portaldot. The
          bridge route would deliver settlement liquidity to destination
          adapters and return it for withdrawals. This frontend visualizes that
          route; bridge execution and destination adapters are not connected.
        </p>
      </section>
      <section>
        <h3>PORTIX contracts on Portaldot</h3>
        <p>
          Chain ID <b>420420777</b>
        </p>
        <div className="deployment-table">
          {Object.entries({
            pUSDC: contracts.pUSDC,
            Market: contracts.market,
            Oracle: contracts.oracle,
            "Debt pool": contracts.debtPool,
            "Vault factory": contracts.factory,
          }).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              {value ? (
                <a
                  href={explorerContract(value)}
                  target="_blank"
                  rel="noreferrer"
                  title={value}
                >
                  {value.slice(0, 8)}…{value.slice(-6)}{" "}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <b>Awaiting deployment</b>
              )}
            </div>
          ))}
          {stockIds.map((stock) => {
            const target = vaultAddress(vaultId, stock);
            return (
              <div key={stock}>
                <span>
                  {stock} / {vaultId}
                </span>
                {target ? (
                  <a
                    href={explorerContract(target)}
                    target="_blank"
                    rel="noreferrer"
                    title={target}
                  >
                    {target.slice(0, 8)}…{target.slice(-6)}{" "}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <b>Awaiting deployment</b>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="about-sources">
        <h3>Reading the data</h3>
        <p>
          DefiLlama provides lending APYs, Uniswap base fee APY, and pool TVL.
          pxPrime uses a TVL-weighted benchmark of its three markets. Refresh
          requests run every 60 seconds; underlying observations follow the
          provider’s update schedule. Source timestamps remain visible and
          failed requests never generate substitute rates.
        </p>
      </section>
    </div>
  );
}
