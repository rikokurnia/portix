"use client";
import { useEffect, useState } from 'react';
import { usePortfolio, runLegacyCommand } from '@/lib/portfolio-store';
import { TransactionLink } from '@/components/shared/TransactionLink';
import { WalletControl } from '@/features/wallet/WalletControl';
import { legacyAddress } from '@/lib/onchain/legacy';
import { contracts, isolatedAccounting } from '@/lib/onchain/contracts';
import { formatUnits, parseUnits, type Hash } from 'viem';
export default function TestnetDemo(){
 const account=usePortfolio();
 const [funding,setFunding]=useState<{owner:string;address:string}>();
 useEffect(()=>{let active=true;if(account.address)void fetch(`/api/wallet-funding?address=${account.address}`).then(r=>r.json()).then(data=>{if(active&&data.substrateFundingAddress)setFunding({owner:account.address!,address:data.substrateFundingAddress});});return()=>{active=false;};},[account.address]);
 const [mode,setMode]=useState<'Buy'|'Sell'|'Deposit'|'Withdraw'>('Buy');
 const [amount,setAmount]=useState('');const [accepted,setAccepted]=useState(false);
 const [error,setError]=useState('');const [hash,setHash]=useState<Hash>();const [working,setWorking]=useState(false);
 const limit=mode==='Buy'?String(account.pUSDC):mode==='Withdraw'?account.legacyShares:account.legacyStock;
 const decimals=mode==='Buy'?6:18;
 const valid=!!account.address&&account.ready&&!isolatedAccounting&&accepted&&new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(amount)&&Number(amount)>0&&parseUnits(amount,decimals)<=parseUnits(limit,decimals);
 async function submit(){
  if(!valid||working||account.pending)return;setWorking(true);setError('');setHash(undefined);
  try{
   const result=await runLegacyCommand(mode==='Buy'?{type:'Buy',stockId:'AAPL',amount:1,spend:Number(amount)}:
    mode==='Sell'?{type:'Sell',stockId:'AAPL',amount:Number(amount),rawAmount:amount}:
    {type:mode,stockId:'AAPL',vaultId:'pxPrime',amount:Number(amount),rawAmount:amount});
   if(result.ok){setHash(result.hash);setAmount('');}else setError(result.error);
  }finally{setWorking(false);}
 }
 return <main style={{maxWidth:760,margin:'40px auto',padding:20}}>
  <h1>Existing-contract testnet demo</h1>
  <p>Use the currently deployed protocol. No replacement contracts or deployment funding are required.</p>
  <section className="panel" style={{padding:24,margin:'24px 0'}}>
   <h2>Connect an EVM wallet</h2>
   <p>A Talisman address starting with <code>5</code> is a Substrate account. Privy requires an Ethereum account starting with <code>0x</code>.</p>
   <p>In Talisman, add or select an Ethereum account and connect it as a browser wallet. Alternatively, sign in with email and create a PORTIX embedded wallet. Use Portaldot V3, chain ID 420420777. Its EVM wallet configuration uses 18 decimals for tPOT.</p>
   <p>Fund that EVM account with native testnet tPOT through a chain-supported transfer or faucet. Your Substrate balance does not automatically become the EVM wallet balance. Do not truncate or manually convert the address.</p>
   <WalletControl />
   {funding?.owner === account.address && <div style={{overflowWrap:'anywhere'}}><p>To fund this EVM wallet from your Substrate account, send a small test amount of native tPOT to its corresponding funding address, then check the wallet balance:</p><code>{funding?.address}</code><p>This is the funding destination for the selected 0x wallet, not an address to use for Privy login. It changes when you switch wallets.</p></div>}
  </section>
  <section className="panel" style={{padding:24}}>
   <h2>One stock balance · one vault position</h2>
   <p>This legacy contract does not distinguish equities or strategies. This page shows its shared demo stock and vault once, without claiming separate Apple, NVIDIA, Prime or Boost holdings.</p>
   <p role="note">Known contract limitation: another caller can withdraw a user’s vault shares. Its payout checks are also incomplete. Use test tokens only. The app checks available settlement liquidity before sell and withdrawal, but cannot repair immutable contract authorization.</p>
   <p style={{overflowWrap:'anywhere'}}>Protocol: <code>{legacyAddress}</code><br/>pUSDC: <code>{contracts.pUSDC}</code></p>
   <dl><dt>pUSDC</dt><dd>{account.ready?account.pUSDC:'—'}</dd><dt>Demo stock</dt><dd>{account.ready?account.legacyStock:'—'}</dd><dt>Demo vault shares</dt><dd>{account.ready?account.legacyShares:'—'}</dd></dl>
   <button className="button" disabled={!account.address||working||!!account.pending} onClick={async()=>{setWorking(true);setError('');try{const r=await account.claimFaucet();if(r.ok)setHash(r.hash);else setError(r.error);}finally{setWorking(false);}}}>Claim 5,000 pUSDC</button>
   <p><label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> I understand this is an insecure legacy test-token demo.</label></p>
   <label htmlFor="legacy-action">Action</label>{' '}
   <select id="legacy-action" value={mode} disabled={working} onChange={e=>{setMode(e.target.value as typeof mode);setAmount('');setError('');setHash(undefined);}}>{['Buy','Sell','Deposit','Withdraw'].map(m=><option key={m}>{m}</option>)}</select>
   <p><label htmlFor="legacy-amount">Amount ({mode==='Buy'?'pUSDC':mode==='Withdraw'?'vault shares':'demo stock'})</label></p>
   <input id="legacy-amount" inputMode="decimal" value={amount} disabled={working} onChange={e=>setAmount(e.target.value)} />{' '}
   <button type="button" disabled={!account.ready||working} onClick={()=>setAmount(formatUnits(parseUnits(limit,decimals),decimals))}>Max</button>
   <p>Available: {account.ready?limit:'—'}. Execution results come from the mined transaction and refreshed chain balances.</p>
   <button className="button" disabled={!valid||working||!!account.pending} onClick={()=>void submit()}>{working?account.pending||'Processing…':mode}</button>
   {error&&<p role="alert">{error}</p>}{account.error && account.error !== "Some oracle prices are unavailable. Please retry." &&<p role="alert">{account.error}</p>}
   {hash&&<p role="status">Transaction confirmed: <TransactionLink hash={hash}/></p>}
  </section>
 </main>;
}
