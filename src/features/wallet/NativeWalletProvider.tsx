"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Signer} from '@polkadot/api/types';
import {nativeEvmAddress} from './native-address';
export type NativeAccount={address:string;name?:string;type?:string};
type Injected={accounts:{get:()=>Promise<NativeAccount[]>;subscribe?:(fn:(accounts:NativeAccount[])=>void)=>()=>void};signer:Signer};
type Extension={enable:(name:string)=>Promise<Injected>};
type State={accounts:NativeAccount[];selected?:NativeAccount;signer?:Signer;connecting:boolean;error:string;open:boolean;setOpen:(v:boolean)=>void;connect:()=>Promise<void>;select:(address:string)=>void;disconnect:()=>void};
const Context=createContext<State|undefined>(undefined);
export const useNativeWallet=()=>{const value=useContext(Context);if(!value)throw Error('Missing native wallet provider');return value;};
export function NativeWalletProvider({children}:{children:ReactNode}){
 const [accounts,setAccounts]=useState<NativeAccount[]>([]);const [selectedAddress,setSelectedAddress]=useState('');const [signer,setSigner]=useState<Signer>();
 const [connecting,setConnecting]=useState(false);const [error,setError]=useState('');const [open,setOpen]=useState(false);const unsubscribe=useRef<()=>void>(undefined);
 useEffect(()=>()=>unsubscribe.current?.(),[]);
 const validAccounts=(list:NativeAccount[])=>list.filter(a=>{try{return a.type!=='ethereum'&&!!nativeEvmAddress(a.address);}catch{return false;}});
 async function connect(){if(connecting)return;setConnecting(true);setError('');
  try{const injected=(window as unknown as {injectedWeb3?:Record<string,Extension>}).injectedWeb3;
   const extension=injected?.talisman;if(!extension)throw Error('Open Talisman, enable site access, then refresh this page.');
   const enabled=await extension.enable('PORTIX');const list=validAccounts(await enabled.accounts.get());if(!list.length)throw Error('Select a Substrate account in Talisman to continue.');
   unsubscribe.current?.();setAccounts(list);setSelectedAddress(list[0].address);setSigner(enabled.signer);
   unsubscribe.current=enabled.accounts.subscribe?.(items=>{const next=validAccounts(items);setAccounts(next);setSelectedAddress(old=>next.some(a=>a.address===old)?old:next[0]?.address??'');});
  }catch(e){setError(e instanceof Error?e.message:'Wallet connection was not completed.');}finally{setConnecting(false);}
 }
 function disconnect(){unsubscribe.current?.();unsubscribe.current=undefined;setAccounts([]);setSelectedAddress('');setSigner(undefined);setOpen(false);}
 return <Context.Provider value={{accounts,selected:accounts.find(a=>a.address===selectedAddress),signer,connecting,error,open,setOpen,connect,select:setSelectedAddress,disconnect}}>{children}</Context.Provider>;
}
