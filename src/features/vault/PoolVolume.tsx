"use client";
import {useEffect,useState} from 'react';
import type {VaultId} from '@/lib/assets';
import {formatBenchmarkTVL} from '@/lib/vault-market-data';
export function PoolVolume({vaultId}:{vaultId:VaultId}){
 const [data,setData]=useState<{volume24h:number;observedAt:string}>();const [failed,setFailed]=useState(false);
 useEffect(()=>{if(vaultId!=='pxBoost')return;let active=true;async function load(){try{const r=await fetch('/api/vault-volume',{signal:AbortSignal.timeout(10000)});const v=await r.json();if(!r.ok||!v.available)throw Error();if(active){setData(v);setFailed(false);}}catch{if(active)setFailed(true);}}void load();const id=setInterval(()=>void load(),60000);return()=>{active=false;clearInterval(id);};},[vaultId]);
 return <div className="pool-volume" title={vaultId==='pxBoost'?'Actual Uniswap V3 USDC/WETH 0.05% pool swap volume; refreshed every 60 seconds.':'Swap volume is not a metric for these lending markets.'}>
 <span>Vol:</span><b>{vaultId==='pxBoost'&&data&&!failed?formatBenchmarkTVL(data.volume24h):'—'}</b>
 </div>;
}
