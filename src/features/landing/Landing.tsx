"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import { CloudDialogue } from "./CloudDialogue";
import { LandingBackground } from "./LandingBackground";
import { LandingVaultCard } from "./LandingVaultCard";
import styles from "./landing.module.css";

const steps = [
  { title: "Pick a stock", message: "Start with a tokenized stock and keep your stock exposure.", left: "Apple", right: "AAPL", detail: "Tokenized stock" },
  { title: "Choose a vault", message: "Use your stock as collateral to access a yield strategy.", left: "AAPL", right: "pxPrime", detail: "Lending" },
  { title: "Put it to work", message: "Put your stock to work while keeping your stock exposure.", left: "pxPrime", right: "Earn yield", detail: "Put it to work" },
];
export function Landing() {
  const [step, setStep] = useState(1);
  const [active, setActive] = useState("hero");
  const root = useRef<HTMLDivElement>(null);
  const market = useVaultMarketData();
  useEffect(() => {
    // A narrow band at the viewport center gives one unambiguous active section.
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    root.current?.querySelectorAll("section").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const selected = steps[step];
  return <div className={styles.landing} ref={root}>
    <LandingBackground />
    <a className={styles.skip} href="#how-it-works">Skip to how Portix works</a>
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark} aria-label="PORTIX home"><BrandIcon size={44} /><span>PORTIX</span></Link>
      <Link href="/vault" className={styles.openApp}>Open app</Link>
    </header>
    <main>
      <section id="hero" className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroDialogue}>{active === "hero" && <CloudDialogue speaker="seated" changeKey="hero">Hi, I’m Kyki from Portaldot!</CloudDialogue>}</div>
        <div className={styles.heroCopy}><h1 id="landing-title">Make your stocks productive.</h1>
          <p>Earn extra income from tokenized stocks without selling them.</p>
          <a href="#find-your-vault" className={styles.cta}>Explore Vault</a>
        </div>
      </section>
      <section id="how-it-works" className={styles.how} aria-labelledby="how-title">
        <h2 id="how-title">How Portix works</h2>
        <div className={styles.howGrid}>
          <div className={styles.steps} role="group" aria-label="How Portix works steps">
            {steps.map((item, index) => <button key={item.title} type="button" aria-pressed={step === index} aria-controls="book-content" onClick={() => setStep(index)}>
              <span>0{index + 1}</span><b>{item.title}</b>
            </button>)}
          </div>
          <div className={styles.book}>
            <img className={styles.artwork} src="/assets/kyki-open-book.png" width="1672" height="941" alt="Standing Kyki points to an open PORTIX book on a stone podium, wearing the Portaldot emblem." />
            <div id="book-content" className={styles.bookContent} key={step} aria-live="polite">
              <div className={styles.leftPage}><img src={step === 2 ? "/assets/vault-prime.png" : "/assets/AAPL.png"} alt="" /><strong>{selected.left}</strong></div>
              <span className={styles.bookArrow} aria-hidden="true">→</span>
              <div className={styles.rightPage}>{step === 0 ? <img src="/assets/logos/AAPL.svg" alt="" /> : step === 1 ? <BrandIcon brand="pxPrime" size={90} /> : <span className={styles.yieldIcon} aria-hidden="true">↗</span>}<strong>{selected.right}</strong><span>{selected.detail}</span></div>
            </div>
          </div>
        </div>
        <div className={styles.howDialogue}>{active === "how-it-works" && <CloudDialogue speaker="standing" changeKey={step}>{selected.message}</CloudDialogue>}</div>
      </section>
      <section id="find-your-vault" className={styles.closing} aria-label="Compare Portix vaults">
        <div className={styles.closingDialogue}>{active === "find-your-vault" && <CloudDialogue speaker="seated" changeKey="closing">Which vault fits your strategy?</CloudDialogue>}</div>
        <div className={styles.cards}><LandingVaultCard vaultId="pxPrime" market={market} /><LandingVaultCard vaultId="pxBoost" market={market} /></div>
        <Link href="/vault" className={styles.cta}>Find Your Vault →</Link>
        <p className={styles.credit}>Protocol benchmarks, not PORTIX returns. Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>.</p>
      </section>
    </main>
  </div>;
}
