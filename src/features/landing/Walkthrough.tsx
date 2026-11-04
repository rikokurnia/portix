"use client";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { protocols, summarizeVault, vaultProtocols } from "@/lib/vault-market-data";
import type { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import { CloudDialogue } from "./CloudDialogue";
import styles from "./walkthrough.module.css";

const steps = [
  { title: "Pick a stock", message: "Start with a tokenized stock and keep your stock exposure.", left: "Apple", right: "AAPL", detail: "Tokenized stock" },
  { title: "Choose a vault", message: "Use your stock as collateral to access a yield strategy.", left: "AAPL", right: "pxPrime", detail: "Lending" },
  { title: "Put it to work", message: "Put your stock to work while keeping your stock exposure.", left: "pxPrime", right: "Earn yield", detail: "Put it to work" },
];

export function Walkthrough({ market, active, onReleaseChange }: {
  market: ReturnType<typeof useVaultMarketData>;
  active: boolean;
  onReleaseChange: (released: boolean) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const summary = summarizeVault("pxPrime", market.histories);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = root.current;
      if (!element) return;
      const viewport = scene.current;
      if (!viewport) return;
      // Measure the actual sticky viewport, including mobile's stable viewport units.
      // Each step owns a full third of the travel; Closing is outside this wrapper.
      const travel = Math.max(1, element.getBoundingClientRect().height - viewport.getBoundingClientRect().height);
      const distance = -element.getBoundingClientRect().top;
      setStep(Math.max(0, Math.min(2, Math.floor(distance / (travel / steps.length)))));
      onReleaseChange(distance >= travel);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(root.current!);
    resize.observe(scene.current!);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resize.disconnect();
    };
  }, [onReleaseChange]);

  function indicators(current: number) {
    return <ol className={styles.steps} aria-label="How Portix works progress">
      {steps.map((item, index) => <li key={item.title} aria-current={current === index ? "step" : undefined}>
        <span>0{index + 1}</span><b>{item.title}</b>
      </li>)}
    </ol>;
  }

  function book(current: number) {
    const selected = steps[current];
    return <div className={styles.book}>
      <img className={styles.artwork} src="/assets/kyki-open-book.png" width="1672" height="941"
        alt="Standing Kyki points to an open PORTIX book on a stone podium, wearing the Portaldot emblem." />
      <div className={styles.bookContent} key={current} aria-live="polite" aria-atomic="true" data-book-step={current + 1}>
        <div className={styles.leftPage}>
          <img src={current === 2 ? "/assets/vault-prime.png" : "/assets/AAPL.png"} alt="" />
          <strong>{selected.left}</strong>
        </div>
        <span className={styles.bookArrow} aria-hidden="true">→</span>
        {current === 2 ? <div className={styles.yieldPage}>
          <span className={styles.apyLabel}>Blended supply APY</span>
          <strong className={styles.apy}>{summary ? `${summary.apy.toFixed(2)}%` : "—"}</strong>
          <div className={styles.yieldProtocols}>
            {vaultProtocols.pxPrime.map(id => <img key={id} src={protocols[id].logo} alt={protocols[id].name} width="32" height="32" />)}
          </div>
        </div> : <div className={styles.rightPage}>
          {current === 0 ? <img src="/assets/logos/AAPL.svg" alt="" /> : <BrandIcon brand="pxPrime" size={90} />}
          <strong>{selected.right}</strong><span>{selected.detail}</span>
        </div>}
      </div>
    </div>;
  }

  function dialogue(current: number, visible: boolean) {
    return <div className={styles.dialogue} data-active={visible} aria-hidden={!visible}>
      <CloudDialogue speaker="standing" changeKey={current}>{steps[current].message}</CloudDialogue>
    </div>;
  }

  return <section id="how-it-works" ref={root} className={styles.walkthrough} aria-label="How Portix works" data-active-step={step + 1}>
    <div className={styles.pinned} ref={scene}>
      <h2 id="how-title" className={styles.heading}>How Portix works</h2>
      <div className={styles.grid}>
        <div>{indicators(step)}</div>
        <div>{book(step)}</div>
      </div>
      <div>{dialogue(step, active)}</div>
    </div>
  </section>;
}
