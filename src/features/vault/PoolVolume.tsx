"use client";
import {useEffect,useState} from 'react';
import type {VaultId} from '@/lib/assets';
import {formatBenchmarkTVL} from '@/lib/vault-market-data';
export function PoolVolume({vaultId,benchmarkTVL}:{vaultId:VaultId;benchmarkTVL?:number}){
 const [data,setData]=useState<{volume24h:number;turnover24h:number;observedAt:string}>();const [failed,setFailed]=useState(false);
 useEffect(()=>{if(vaultId!=='pxBoost')return;let active=true;async function load(){try{const r=await fetch('/api/vault-volume',{signal:AbortSignal.timeout(10000)});const v=await r.json();if(!r.ok||!v.available)throw Error();if(active){setData(v);setFailed(false);}}catch{if(active)setFailed(true);}}void load();const id=setInterval(()=>void load(),60000);return()=>{active=false;clearInterval(id);};},[vaultId]);
 return <small className="pool-volume" title={vaultId==='pxBoost'?'Actual Uniswap V3 USDC/WETH 0.05% pool swap volume; refreshed every 60 seconds.':'Swap volume is not a metric for these lending markets.'}>
 <span>24h swap volume</span><b>{vaultId==='pxPrime'?'Not applicable':data&&!failed?formatBenchmarkTVL(data.volume24h):'—'}</b>
 {vaultId==='pxBoost'&&data&&!failed&&benchmarkTVL!==undefined&&benchmarkTVL>0&&<span title={`24h volume divided by the benchmark TVL shown above. Volume observed ${data.observedAt}`}>{(data.volume24h/benchmarkTVL).toFixed(2)}× benchmark TVL</span>}
 </small>;
}
