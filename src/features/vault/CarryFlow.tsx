"use client";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Pause, Play, RotateCcw } from "lucide-react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { protocols, vaultProtocols } from "@/lib/vault-market-data";
import { stocks, type StockId, type VaultId } from "@/lib/assets";
export function CarryFlow({
  vaultId,
  stockId,
}: {
  vaultId: VaultId;
  stockId: StockId;
  run: number;
}) {
  const [stage, setStage] = useState(0),
    [playing, setPlaying] = useState(false);
  const descriptions = [
    "Stock collateral keeps your equity exposure.",
    "A 40% LTV sets the pUSDC borrowing allocation.",
    vaultId === "pxPrime"
      ? "The planned bridge route connects Portaldot to Base and Ethereum."
      : "The planned bridge route connects Portaldot to Ethereum.",
    "Borrowed liquidity is allocated to the destination strategy.",
    "Vault shares represent your position and its proportional collateral.",
  ];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStage((s) => (s + 1) % 5), 2000);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPlaying(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  // The caller can restart this educational route when an account action begins.
  return (
    <section
      className={`carry-flow panel ${playing ? "is-playing" : ""}`}
      aria-label="How vault carry works"
    >
      <div className="carry-flow-header">
        <div>
          <h3>One position. A multichain strategy.</h3>
          <p>Explore the planned carry route.</p>
        </div>
        <div className="flow-controls">
          <button
            type="button"
            aria-label={
              playing ? "Pause route animation" : "Play route animation"
            }
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            aria-label="Restart route animation"
            onClick={() => {
              setStage(0);
              setPlaying(true);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div className="flow-track">
        {[
          "Stock collateral",
          "Borrow pUSDC",
          "Portaldot bridge",
          vaultId === "pxPrime" ? "Lending pools" : "Uniswap pool",
          vaultId,
        ].map((title, i) => (
          <button
            key={title}
            type="button"
            className={`flow-node ${stage === i ? "active" : ""}`}
            aria-pressed={stage === i}
            onClick={() => {
              setStage(i);
              setPlaying(false);
            }}
          >
            <span className="flow-node-art">
              {i === 0 ? (
                <img src={stocks[stockId].logo} width="34" height="34" alt="" />
              ) : i === 1 ? (
                <img src="/assets/usdc.png" width="38" height="38" alt="USDC" />
              ) : i === 2 ? (
                <>
                  <ArrowLeftRight size={24} />
                  <img
                    src="/assets/portaldot.png"
                    width="29"
                    height="29"
                    alt="Portaldot"
                  />
                </>
              ) : i === 3 ? (
                <span className="flow-protocols">
                  {vaultProtocols[vaultId].map((id) => (
                    <img
                      src={protocols[id].logo}
                      key={id}
                      width="30"
                      height="30"
                      alt={protocols[id].name}
                    />
                  ))}
                </span>
              ) : (
                <BrandIcon brand={vaultId} size={42} />
              )}
            </span>
            <strong>{title}</strong>
            <small>
              {
                [
                  "Keep exposure",
                  "40% initial LTV",
                  vaultId === "pxPrime" ? "Base / Ethereum" : "Ethereum",
                  vaultId === "pxPrime"
                    ? "Morpho · Aave · Compound"
                    : "USDC / WETH",
                  "Vault receipt",
                ][i]
              }
            </small>
          </button>
        ))}
      </div>
      <p className="flow-caption">
        {descriptions[stage]}{" "}
        <span>Bridge execution is not connected.</span>
      </p>
    </section>
  );
}
