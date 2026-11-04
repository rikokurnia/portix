"use client";
import { useStockHistory } from "@/features/market/useStockHistory";
import { dailyChange } from "@/lib/onchain/history";
import type { CSSProperties } from "react";
import { MARKET_STOCKS } from "@/features/market/stocks";
import styles from "./hero-stocks.module.css";

const heroStocks = ["NFLX", "MSFT", "META", "SPY", "QQQ", "NVDA"] as const;
const arcOffsets = [0, -9, -15, -15, -9, 0];

function StockTile({id,index}: {id:typeof heroStocks[number];index:number}) {
  const stock = MARKET_STOCKS[id], history = useStockHistory(id), change = dailyChange(history.observations), available = change !== undefined;
  const percentage = available ? `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(2)}%` : '—';
  return <li className={styles.reveal} aria-label={`${stock.name}: daily change ${available ? percentage : 'unavailable'}`} style={{'--index':index,'--arc':`${arcOffsets[index]}px`} as CSSProperties}><div className={styles.arc}><div className={styles.tile} aria-hidden="true"><img src={stock.logo} alt="" width={48} height={48}/><span className={!available ? styles.unavailable : change < 0 ? styles.loss : styles.gain}>{percentage}</span></div></div></li>;
}
export function HeroStocks() {
  return <ul className={styles.stocks} aria-label="Stock and ETF daily percentage changes">{heroStocks.map((id,index)=><StockTile key={id} id={id} index={index}/>)}</ul>;
}
