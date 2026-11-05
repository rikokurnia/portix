import type {Activity,VaultPosition} from './portfolio-store';
export function projectedYield(position:VaultPosition,activity:Activity[],apy:number|undefined,settlementPrice:number|undefined,now:number):number|undefined {
 if(apy===undefined||!Number.isFinite(apy)||apy<0||!settlementPrice)return undefined;
 const entries=activity.filter(a=>a.status==='Completed'&&a.stockId===position.stockId&&a.vaultId===position.vaultId).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 const lots:{stock:number;time:number;price:number}[]=[];
 for(const e of entries){const time=Date.parse(e.timestamp);if(!Number.isFinite(time))continue;
  if(e.type==='Deposit')lots.push({stock:Number(e.rawAmount??e.amount),time,price:e.settlementPrice??settlementPrice});
  if(e.type==='Withdraw'){let stock=Number(e.stockReturned??Number(e.rawAmount??e.amount)/3);for(const lot of lots){const take=Math.min(lot.stock,stock);lot.stock-=take;stock-=take;if(stock<=0)break;}}
 }
 const total=lots.reduce((sum,l)=>sum+l.stock,0);const scale=total>position.collateral?position.collateral/total:1;
 return lots.reduce((sum,lot)=>sum+lot.stock*scale*lot.price*.4*Math.expm1(Math.log1p(apy/100)*Math.max(0,now-lot.time)/(365*24*3600*1000)),0);
}
