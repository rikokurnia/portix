"use client";
import {useEffect,useState} from 'react';
import {Wallet,Copy,LogOut,Check} from 'lucide-react';
import {Button} from '@/components/shared/Button';
import {Modal} from '@/components/shared/Modal';
import {usePortfolio} from '@/lib/portfolio-store';
import {useNativeWallet} from './NativeWalletProvider';
import {EvmWalletControl} from './EvmWalletControl';
import {useWalletConfigured} from './WalletProvider';
import {shortAddress} from './chain';
import {formatUnits} from 'viem';
import './wallet.css';
export function WalletControl(){
 const account=usePortfolio();const native=useNativeWallet();const configured=useWalletConfigured();const [copied,setCopied]=useState(false);const [balance,setBalance]=useState<string>();const [mapped,setMapped]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [evm,setEvm]=useState(false);
 useEffect(()=>{let active=true;if(native.selected)void import('./native-client').then(async({nativeApi,nativeBalance})=>{const api=await nativeApi();const b=await nativeBalance(native.selected!.address);const {nativeEvmAddress}=await import('./native-address');const mapping=await api.query.revive.originalAccount(nativeEvmAddress(native.selected!.address));if(active){setBalance(formatUnits(b.free-b.frozen,14));setMapped(!mapping.isEmpty);}}).catch(()=>{if(active)setBalance(undefined);});return()=>{active=false;};},[native.selected,native.open]);
 async function activate(){if(!native.selected||!native.signer)return;setBusy(true);setError('');try{const {activateNative}=await import('./native-client');await activateNative(native.selected.address,native.signer,()=>{});setMapped(true);}catch(e){setError(e instanceof Error?e.message:'Account activation failed.');}finally{setBusy(false);}}
 return <><Button variant="secondary" disabled={native.connecting} onClick={()=>native.setOpen(true)}><Wallet size={16}/>{native.selected?shortAddress(native.selected.address):account.address?shortAddress(account.address):'Connect wallet'}</Button>
 {native.open&&<Modal title={native.selected?'Your wallet':'Connect wallet'} onClose={()=>native.setOpen(false)}>
 {native.selected?<><div className="wallet-account-heading"><Wallet size={25}/><div><strong>{native.selected.name||'Talisman'}</strong><span>Portaldot V3 · Substrate</span></div></div>
 {native.accounts.length>1&&<label className="wallet-select-label">Account<select value={native.selected.address} onChange={e=>native.select(e.target.value)}>{native.accounts.map(a=><option key={a.address} value={a.address}>{a.name||'Account'} · {shortAddress(a.address)}</option>)}</select></label>}
 <div className="wallet-address"><code>{native.selected.address}</code><button aria-label="Copy address" onClick={()=>void navigator.clipboard.writeText(native.selected!.address).then(()=>setCopied(true))}>{copied?<Check size={17}/>:<Copy size={17}/>}</button></div>
 <div className="wallet-network"><span>Available tPOT</span><strong>{balance??'—'}</strong></div>
 {!mapped&&<><p className="muted">Activate this account once to use contracts. Talisman will show the network fee.</p><Button disabled={busy} className="full-width" onClick={()=>void activate()}>{busy?'Confirm in Talisman…':'Activate account'}</Button></>}
 <Button variant="ghost" className="full-width" disabled={busy} onClick={native.disconnect}><LogOut size={16}/>Disconnect</Button>
 </>:<><p className="muted" style={{margin:'16px 0 24px'}}>Use your existing Talisman account and tPOT balance.</p><Button className="full-width" disabled={native.connecting} onClick={()=>void native.connect()}><Wallet size={19}/>{native.connecting?'Approve in Talisman…':'Connect Talisman'}</Button>
 {configured&&<div className="wallet-account-actions"><button className="wallet-alternative" onClick={()=>setEvm(!evm)}>Use an Ethereum wallet or email</button>{(evm||!!account.address)&&<EvmWalletControl/>}</div>}</>}
 {(native.error||error)&&<p className="wallet-error" role="alert">{error||native.error}</p>}
 </Modal>}</>;
}
