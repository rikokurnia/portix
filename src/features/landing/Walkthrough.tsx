"use client";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { protocols, summarizeVault, vaultProtocols } from "@/lib/vault-market-data";
import type { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import { CloudDialogue } from "./CloudDialogue";
import { Reveal } from "./Reveal";
import styles from "./walkthrough.module.css";

const steps = [
  { title: "Pick a stock", message: "Start with a tokenized stock and keep your stock exposure.", left: "Apple", right: "AAPL", detail: "Tokenized stock" },
  { title: "Choose a vault", message: "Use your stock as collateral to access a yield strategy.", left: "AAPL", right: "pxPrime", detail: "Lending" },
  { title: "Put it to work", message: "Put your stock to work while keeping your stock exposure.", left: "pxPrime", right: "Earn yield", detail: "Put it to work" },
];
const pinQuery = "(min-width: 1100px) and (min-height: 760px)";

export function Walkthrough({ market, active }: {
  market: ReturnType<typeof useVaultMarketData>;
  active: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const flowStages = useRef<(HTMLDivElement | null)[]>([]);
  const [step, setStep] = useState(0);
  const summary = summarizeVault("pxPrime", market.histories);

  useEffect(() => {
    const media = matchMedia(pinQuery);
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = root.current;
      if (!element) return;
      if (media.matches) {
        // The sticky travel is three equal reading intervals, including step 03.
        const travel = element.offsetHeight - window.innerHeight;
        const distance = -element.getBoundingClientRect().top;
        setStep(Math.max(0, Math.min(2, Math.floor(distance / (travel / 3)))));
      } else {
        const center = window.innerHeight * 0.5;
        let next = 0;
        flowStages.current.forEach((stage, index) => {
          if (stage && stage.getBoundingClientRect().top <= center) next = index;
        });
        setStep(next);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", schedule);
    };
  }, []);

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
      <div className={styles.bookContent} key={`${current}-${step === current}`} aria-live="polite" aria-atomic="true" data-book-step={current + 1}>
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
      <CloudDialogue speaker="standing" changeKey={`${current}-${step === current}`}>{steps[current].message}</CloudDialogue>
    </div>;
  }

  return <section id="how-it-works" ref={root} className={styles.walkthrough} aria-label="How Portix works" data-active-step={step + 1}>
    <div className={styles.pinned}>
      <Reveal><h2 id="how-title" className={styles.heading}>How Portix works</h2></Reveal>
      <div className={styles.grid}>
        <Reveal delay={90}>{indicators(step)}</Reveal>
        <Reveal delay={180}>{book(step)}</Reveal>
      </div>
      <Reveal delay={260}>{dialogue(step, active)}</Reveal>
    </div>
    <div className={styles.flow}>
      <Reveal><h2 className={styles.heading}>How Portix works</h2></Reveal>
      {steps.map((item, index) => <div key={item.title} className={styles.flowStage}
        ref={element => { flowStages.current[index] = element; }} data-flow-step={index + 1}>
        <div className={styles.grid}>
          <Reveal delay={80}>{indicators(step)}</Reveal>
          <Reveal delay={160}>{book(index)}</Reveal>
        </div>
        <Reveal delay={220}>{dialogue(index, active && step === index)}</Reveal>
      </div>)}
    </div>
  </section>;
}
