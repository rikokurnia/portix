import {formatUnits,parseUnits} from 'viem';
const SCALE=10n**18n;
export function price6(price:number|undefined):bigint {
 if(!price||!Number.isFinite(price)||price<=0)return 0n;
 return parseUnits(price.toFixed(6),6);
}
export const stockValue6=(stock:bigint,price:bigint)=>stock*price/SCALE;
export function usdToStock(amount:string,price:bigint){if(price<=0n)return 0n;return parseUnits(amount,6)*SCALE/price;}
export function usdToShares(amount:string,shares:bigint,collateral:bigint,price:bigint){const value=stockValue6(collateral,price);return value>0n?parseUnits(amount,6)*shares/value:0n;}
export function rawAmountUsd(raw:bigint,mode:'Deposit'|'Withdraw',price:bigint,shares=0n,collateral=0n){const stock=mode==='Deposit'?raw:shares>0n?raw*collateral/shares:0n;return formatUnits(stockValue6(stock,price),6);}

// Display denomination: one value unit is $1 of live collateral, not one raw receipt.
export function vaultValueUnits(collateral:bigint,price:bigint):string|undefined {
 if(price<=0n||collateral<0n)return undefined;
 return formatUnits((collateral*price+SCALE/2n)/SCALE,6);
}
