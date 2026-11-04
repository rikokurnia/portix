"use client";
import {useEffect,useRef,useState} from 'react';
import {parseUnits,formatUnits,type Hash} from 'viem';
import {ArrowDownUp,CheckCircle2} from 'lucide-react';
import {Modal} from '@/components/shared/Modal';
import {Button} from '@/components/shared/Button';
import {TransactionLink} from '@/components/shared/TransactionLink';
import {usePortfolio,runLegacyCommand} from '@/lib/portfolio-store';
import {publicClient,marketAbi} from '@/lib/onchain/contracts';
import {legacyAddress,legacyAbi} from '@/lib/onchain/legacy';
import {useNativeWallet} from '@/features/wallet/NativeWalletProvider';
import './carry.css';
export type CarryAction='Buy'|'Sell'|'Deposit'|'Withdraw';
export function CarryOrder({mode,onClose}:{mode:CarryAction;onClose:()=>void}){
 const account=usePortfolio();const wallet=useNativeWallet();const [input,setInput]=useState('');const [working,setWorking]=useState(false);const [error,setError]=useState('');const [hash,setHash]=useState<Hash>();const [quote,setQuote]=useState<{key:string;value:string}>();const lock=useRef(false);
 const buy=mode==='Buy';const decimals=buy?6:18;const limit=buy?String(account.pUSDC):mode==='Withdraw'?account.legacyShares:account.legacyStock;
 const valid=!!account.address&&account.ready&&new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(input)&&Number(input)>0&&parseUnits(input,decimals)<=parseUnits(limit,decimals);
 useEffect(()=>{let active=true;if(!valid)return;const timer=setTimeout(async()=>{try{
  const raw=parseUnits(input,decimals);let value='';
  if(mode==='Deposit'||mode==='Withdraw'){const result=await publicClient.readContract({address:legacyAddress,abi:legacyAbi,functionName:mode==='Deposit'?'previewDepositCarry':'previewWithdrawCarry',args:[raw]});value=`${formatUnits(result[0],18)} ${mode==='Deposit'?'vault shares':'demo stock'}`;}
  else if(mode==='Sell'){const result=await publicClient.readContract({address:legacyAddress,abi:marketAbi,functionName:'quoteSell',args:[legacyAddress,raw]}) as readonly bigint[];value=`${formatUnits(result[2],6)} pUSDC`;}
  else {const fee=(raw*10n)/10000n;const netSpend=raw-fee;const stock=(netSpend*10n**18n)/300_000_000n;value=`${formatUnits(stock,18)} demo stock`;}
  if(active)setQuote({key:input,value});
 }catch{if(active)setQuote(undefined);}},200);return()=>{active=false;clearTimeout(timer);};},[input,mode,valid,decimals]);
 async function submit(){if(!valid||lock.current)return;lock.current=true;setWorking(true);setError('');try{
 const spend=Number(input);const fee=spend*0.001;const netSpend=spend-fee;const estimatedStock=netSpend/300;
 const result=await runLegacyCommand(buy?{type:'Buy',stockId:'AAPL',amount:estimatedStock,spend}:mode==='Sell'?{type:'Sell',stockId:'AAPL',amount:Number(input),rawAmount:input}:{type:mode,stockId:'AAPL',vaultId:'pxPrime',amount:Number(input),rawAmount:input});
 if(result.ok)setHash(result.hash);else setError(result.error);
 }finally{lock.current=false;setWorking(false);}}
 return <Modal title={`${mode} ${mode==='Withdraw'?'from vault':mode==='Deposit'?'to vault':'demo stock'}`} onClose={onClose}>
 {hash?<div className="trade-success" role="status"><CheckCircle2 size={38}/><h3>{mode} confirmed</h3><TransactionLink hash={hash}/><p className="muted">Your balances have been refreshed.</p><Button className="full-width" onClick={onClose}>Done</Button></div>:<form className="carry-order" onSubmit={e=>{e.preventDefault();void submit();}}>
 <label htmlFor="carry-input">{buy?'You pay':mode==='Withdraw'?'Shares to redeem':mode==='Deposit'?'Stock to deposit':'You sell'}</label>
 <div className="carry-input"><input id="carry-input" inputMode="decimal" autoComplete="off" value={input} disabled={working} placeholder="0.00" onChange={e=>{setInput(e.target.value);setError('');}}/><span>{buy?'pUSDC':mode==='Withdraw'?'shares':'stock'}</span></div>
 <div className="carry-available"><span>Available {account.ready?limit:'—'}</span><button type="button" disabled={!account.ready||working} onClick={()=>setInput(limit)}>Max</button></div>
 <div className="carry-estimate"><ArrowDownUp size={16}/><span>Estimated receive</span><strong>{quote?.key===input?quote.value:'—'}</strong></div>
 {!account.address&&<Button type="button" variant="secondary" onClick={()=>wallet.setOpen(true)}>Connect wallet</Button>}
 {error&&<p className="error" role="alert">{error}</p>}
 <Button className="full-width" type="submit" disabled={!valid||working||!!account.pending}>{working?account.pending||'Confirm in your wallet…':mode==='Deposit'?'Deposit stock':mode==='Withdraw'?'Withdraw assets':`${mode} stock`}</Button>
 <p className="carry-fine">Portaldot V3 · Test tokens only</p>
 </form>}
 </Modal>;
}
