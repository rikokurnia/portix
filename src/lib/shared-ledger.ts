import {parseUnits} from 'viem';
import {stockIds,type StockId,type VaultId} from './assets';
import type {Activity} from './portfolio-store';
const raw=(text:string|number|undefined)=>{try{return parseUnits(typeof text==='number'?text.toFixed(18):text??'0',18);}catch{return 0n;}};
export function sharedLedger(activity:Activity[],stockTotal:bigint,shareTotal:bigint){
 const confirmed=activity.filter(a=>a.status==='Completed'&&a.stockId!=='pUSDC'&&stockIds.includes(a.stockId)).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 const net=new Map<StockId,bigint>();const positions=new Map<string,{stockId:StockId;vaultId:VaultId;shares:bigint}>();
 for(const a of confirmed){const stock=a.stockId as StockId;const amount=raw(a.rawAmount??a.amount);
  if(a.type==='Buy')net.set(stock,(net.get(stock)??0n)+amount);
  if(a.type==='Sell')net.set(stock,(net.get(stock)??0n)-amount);
  if(a.type==='Deposit'||a.type==='Withdraw'){
   const vault=a.vaultId??'pxPrime';const id=`${vault}-${stock}`;const p=positions.get(id)??{stockId:stock,vaultId:vault,shares:0n};
   if(a.type==='Deposit'){net.set(stock,(net.get(stock)??0n)-amount);p.shares+=a.sharesMinted?raw(a.sharesMinted):amount*3n;}
   else{net.set(stock,(net.get(stock)??0n)+(a.stockReturned?raw(a.stockReturned):amount/3n));p.shares-=amount;}
   positions.set(id,p);
  }
 }
 const fallback=(confirmed.at(-1)?.stockId??'AAPL') as StockId;
 const stocks=Object.fromEntries(stockIds.map(id=>[id,0n])) as Record<StockId,bigint>;
 // The chain aggregate is authoritative. Allocate only to labels backed by confirmed history.
 let remaining=stockTotal;
 for(const [id,n]of net){const amount=n>0n?(n>remaining?remaining:n):0n;stocks[id]=amount;remaining-=amount;}
 if(remaining>0n)stocks[fallback]+=remaining;
 const positive=[...positions.values()].filter(p=>p.shares>0n);let shares=shareTotal;
 const result=positive.map(p=>{const count=p.shares>shares?shares:p.shares;shares-=count;return {...p,shares:count};}).filter(p=>p.shares>0n);
 if(shares>0n){const latest=confirmed.filter(a=>a.type==='Deposit').at(-1);const stockId=(latest?.stockId??fallback) as StockId;const vaultId=latest?.vaultId??'pxPrime';const found=result.find(p=>p.stockId===stockId&&p.vaultId===vaultId);if(found)found.shares+=shares;else result.push({stockId,vaultId,shares});}
 return {stocks,positions:result};
}
