import {decodeEventLog,formatUnits,parseAbi,type Hex,type Address} from 'viem';
import type {Activity} from '../portfolio-store';
const abi=parseAbi([
 'event Transfer(address indexed from,address indexed to,uint256 value)',
 'event StockBought(address indexed buyer,address indexed stock,uint256 stockAmount,uint256 usdcPaid,uint256 feePaid)',
]);
export interface ReceiptLog {address:string;data:Hex;topics:readonly Hex[]}
export function confirmedAmounts(event:Activity,logs:readonly ReceiptLog[],owner:Address,settlement:Address,protocol:Address):Activity {
 let next={...event};let sent=0n,received=0n;
 for(const log of logs){try{
  const decoded=decodeEventLog({abi,data:log.data,topics:log.topics as [Hex,...Hex[]]});
  if(decoded.eventName==='Transfer'&&log.address.toLowerCase()===settlement.toLowerCase()){
   if(decoded.args.from.toLowerCase()===owner.toLowerCase())sent+=decoded.args.value;
   if(decoded.args.to.toLowerCase()===owner.toLowerCase())received+=decoded.args.value;
  }
  if(decoded.eventName==='StockBought'&&event.type==='Buy'&&log.address.toLowerCase()===protocol.toLowerCase()&&decoded.args.buyer.toLowerCase()===owner.toLowerCase()){
   next={...next,amount:Number(formatUnits(decoded.args.stockAmount,18)),rawAmount:formatUnits(decoded.args.stockAmount,18),usdcAmount:Number(formatUnits(decoded.args.usdcPaid,6))};
  }
 }catch{/* Other events are not accounting evidence. */}}
 if(event.type==='Buy'&&sent>0n)next.usdcAmount=Number(formatUnits(sent,6));
 if((event.type==='Sell'||event.type==='Withdraw')&&received>0n)next.usdcAmount=Number(formatUnits(received,6));
 return next;
}
