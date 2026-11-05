import type { ApiPromise } from '@polkadot/api';
import type { Signer, SubmittableExtrinsic } from '@polkadot/api/types';
import type { EventRecord } from "@polkadot/types/interfaces";
import type { Vec } from "@polkadot/types";
import type { ISubmittableResult } from '@polkadot/types/types';
import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import { nativeEvmAddress } from './native-address';
export const nativeGenesis='0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
let pending:Promise<ApiPromise>|undefined;
export function nativeApi(){
 if(!pending)pending=import('@polkadot/api').then(async({ApiPromise,WsProvider})=>{
  const api=await ApiPromise.create({provider:new WsProvider('wss://test-node-v3.portaldot.dev'),noInitWarn:true});
  if(api.genesisHash.toHex()!==nativeGenesis){await api.disconnect();throw new Error('Wrong Portaldot network.');}return api;
 }).catch(error=>{pending=undefined;throw error;});
 return pending;
}
export type NativeStage={logs?:{address:string;data:Hex;topics:Hex[]}[];hash:Hash;status:'Pending'|'Completed'|'Failed';fromBlock:number;blockHash?:Hash};
function failed(api:ApiPromise,result:ISubmittableResult){
 if(result.dispatchError){const e=result.dispatchError;if(e.isModule){const meta=api.registry.findMetaError(e.asModule);return `${meta.section}.${meta.name}`;}return e.toString();}
 const reverted=result.events.some(({event})=>event.section==='revive'&&event.method==='EthExtrinsicRevert');
 return reverted?'Contract execution reverted.':'';
}
export async function submitNative(api:ApiPromise,tx:SubmittableExtrinsic<'promise'>,address:string,signer:Signer,onStage:(stage:NativeStage)=>void){
 const fromBlock=(await api.rpc.chain.getHeader()).number.toNumber();
 const hash=await new Promise<Hash>((resolve,reject)=>{
  let stop:(()=>void)|undefined;let settled=false;
  const finish=(error?:Error,hash?:Hash)=>{if(settled)return;settled=true;clearTimeout(timer);stop?.();if(error)reject(error);else resolve(hash!);};
  const timer=setTimeout(()=>finish(new Error('Confirmation timed out. Check Activity before trying again.')),180000);
  tx.signAndSend(address,{signer},result=>{
   const hash=result.txHash.toHex() as Hash;
   if(result.status.isInvalid||result.status.isDropped||result.status.isUsurped){onStage({hash,status:'Failed',fromBlock});finish(new Error('Transaction was not included.'));return;}
   if(result.status.isInBlock||result.status.isFinalized){
    const error=failed(api,result);const blockHash=(result.status.isFinalized?result.status.asFinalized:result.status.asInBlock).toHex() as Hash;
    const logs=result.events.filter(({event})=>event.section==='revive'&&event.method==='ContractEmitted').map(({event})=>({address:event.data[0].toString(),data:event.data[1].toString() as Hex,topics:Array.from(event.data[2] as unknown as Iterable<{toHex:()=>Hex}>,x=>x.toHex())}));
    onStage({logs,hash,status:error?'Failed':'Completed',fromBlock,blockHash});
    if(error)finish(new Error(error));else finish(undefined,hash);
   }else onStage({hash,status:'Pending',fromBlock});
  }).then(unsub=>{stop=unsub;if(settled)unsub();}).catch(error=>finish(error instanceof Error?error:new Error('Wallet request failed.')));
 });return hash;
}
export async function nativeBalance(address:string){const api=await nativeApi();const value=await api.query.system.account(address);const data=value.toJSON() as unknown as {data:{free:string|number;frozen:string|number}};return {free:BigInt(data.data.free),frozen:BigInt(data.data.frozen??0)};}
export async function sendNative(address:string,signer:Signer,target:Address,abi:Abi,functionName:string,args:readonly unknown[],onStage:(stage:NativeStage)=>void,assertCurrent:()=>void){
 const api=await nativeApi();const evm=nativeEvmAddress(address);const bytes=(await import('@polkadot/util-crypto')).decodeAddress(address);
 const ethDerived=bytes.slice(20).every(byte=>byte===0xee);
 const mapped=ethDerived||!(await api.query.revive.originalAccount(evm)).isEmpty;
 if(!mapped)throw new Error('Account mapping is not active. Open your wallet in Portix and activate contract access.');
 const data=encodeFunctionData({abi,functionName,args});
 const dry=await api.call.reviveApi.call(address,target,0,null,null,data);
 const r=dry.toJSON() as unknown as {weightRequired:{refTime:number|string;proofSize:number|string};maxStorageDeposit:{charge?:string|number};result:{err?:unknown;ok?:{flags:{bits:number}}}};
 if(r.result.err||!r.result.ok||(r.result.ok.flags.bits&1)!==0)throw new Error('Contract simulation failed. Check your balance and amount.');
 const margin=(n:string|number)=> (BigInt(n)*120n/100n+1n).toString();
 const storage=BigInt(r.maxStorageDeposit.charge??0);const limit=storage===0n?0n:storage*110n/100n+1n;
 const tx=api.tx.revive.call(target,0,{refTime:margin(r.weightRequired.refTime),proofSize:margin(r.weightRequired.proofSize)},limit.toString(),data);
 const fee=await tx.paymentInfo(address);const balance=await nativeBalance(address);
 if(balance.free-balance.frozen<fee.partialFee.toBigInt()+limit)throw new Error('Not enough spendable tPOT for the network fee and storage deposit.');
 assertCurrent();return submitNative(api,tx,address,signer,onStage);
}
export async function recoverNative(hash:Hash,fromBlock:number,knownBlock?:Hash){
 const api=await nativeApi();const latest=(await api.rpc.chain.getFinalizedHead());const height=(await api.rpc.chain.getHeader(latest)).number.toNumber();
 const blocks=knownBlock?[knownBlock]:await Promise.all(Array.from({length:Math.max(0,Math.min(128,height-fromBlock+1))},(_,i)=>api.rpc.chain.getBlockHash(height-i)));
 for(const block of blocks){const signed=await api.rpc.chain.getBlock(block);const index=signed.block.extrinsics.findIndex(tx=>tx.hash.toHex()===hash);if(index<0)continue;
  if(signed.block.header.number.toNumber()>height)return undefined;
  const events=await api.query.system.events.at(block) as unknown as Vec<EventRecord>;const records=events.filter(({phase})=>phase.isApplyExtrinsic&&phase.asApplyExtrinsic.toNumber()===index);
  const isFailed=records.some(({event})=>(event.section==='system'&&event.method==='ExtrinsicFailed')||(event.section==='revive'&&event.method==='EthExtrinsicRevert'));
  if(isFailed)return 'Failed';
  return records.some(({event})=>event.section==='system'&&event.method==='ExtrinsicSuccess')?'Completed':undefined;
 }return undefined;
}
export async function activateNative(address:string,signer:Signer,onStage:(stage:NativeStage)=>void){const api=await nativeApi();return submitNative(api,api.tx.revive.mapAccount(),address,signer,onStage);}
