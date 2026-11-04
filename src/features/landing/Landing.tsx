"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/shared/BrandIcon";
import { useVaultMarketData } from "@/features/vault/useVaultMarketData";
import { CloudDialogue } from "./CloudDialogue";
import { LandingBackground } from "./LandingBackground";
import { HeroStocks } from "./HeroStocks";
import { LandingVaultCard } from "./LandingVaultCard";
import { Walkthrough } from "./Walkthrough";
import { Reveal } from "./Reveal";
import styles from "./landing.module.css";

export function Landing() {
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
          <HeroStocks />
          <a href="#find-your-vault" className={styles.cta}>Explore Vault</a>
        </div>
      </section>
      <Walkthrough market={market} active={active === "how-it-works"} />
      <section id="find-your-vault" className={styles.closing} aria-label="Compare Portix vaults">
        <Reveal className={styles.closingDialogue}><div style={{ height: "100%", visibility: active === "find-your-vault" ? "visible" : "hidden" }} aria-hidden={active !== "find-your-vault"}><CloudDialogue speaker="seated" changeKey="closing">Which vault fits your strategy?</CloudDialogue></div></Reveal>
        <div className={styles.cards}><Reveal delay={120}><LandingVaultCard vaultId="pxPrime" market={market} /></Reveal><Reveal delay={220}><LandingVaultCard vaultId="pxBoost" market={market} /></Reveal></div>
        <Reveal delay={320} className={styles.closingAction}><Link href="/vault" className={styles.cta}>Find Your Vault →</Link></Reveal>
        <p className={styles.credit}>Protocol benchmarks, not PORTIX returns. Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>.</p>
      </section>
    </main>
  </div>;
}
