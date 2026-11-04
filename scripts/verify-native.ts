import {writeFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {encodeFunctionData,parseAbi} from 'viem';
import {decodeAddress} from '@polkadot/util-crypto';
import {nativeApi,nativeGenesis} from '../src/features/wallet/native-client';
import {nativeEvmAddress} from '../src/features/wallet/native-address';
async function main(){const api=await nativeApi();try{
 assert.equal(api.genesisHash.toHex(),nativeGenesis);assert.ok(api.tx.revive.call);assert.ok(api.tx.revive.mapAccount);
 const entries=await api.query.system.account.entriesPaged({args:[],pageSize:64});
 const entry=entries.find(([key,value])=>{const bytes=decodeAddress(key.args[0].toString());const data=value.toJSON() as unknown as {data:{free:string|number}};return !bytes.slice(20).every(b=>b===0xee)&&BigInt(data.data.free)>100000000000000n;});
 if(!entry)throw Error('No funded native account available for read-only simulation');
 const native=entry[0].args[0].toString();const evm=nativeEvmAddress(native);
 const mapped=await api.query.revive.originalAccount(evm);assert.ok(!mapped.isEmpty);assert.equal(Buffer.from(decodeAddress(mapped.toString())).toString('hex'),Buffer.from(decodeAddress(native)).toString('hex'));
 const data=encodeFunctionData({abi:parseAbi(['function faucet(address,uint256)']),functionName:'faucet',args:[evm,5000000000n]});
 const result=(await api.call.reviveApi.call(native,'0x9df05e926a3860a3ccaffa85bb0776c47a9238f4',0,null,null,data)).toJSON();
 const r=result as unknown as {weightRequired:{refTime:number;proofSize:number};result:{ok?:{flags:{bits:number}}}};
 assert.equal(r.result.ok?.flags.bits,0);assert.ok(r.weightRequired.refTime>0);assert.ok(r.weightRequired.proofSize>0);
 const tx=api.tx.revive.call('0x9df05e926a3860a3ccaffa85bb0776c47a9238f4',0,r.weightRequired,0,data);const fee=await tx.paymentInfo(native);
 const proof={checkedAt:new Date().toISOString(),genesisHash:nativeGenesis,specVersion:api.runtimeVersion.specVersion.toString(),autoMap:api.consts.revive.autoMap.toJSON(),nativeAddress:native,evmAddress:evm,mappingVerified:true,callArgs:api.tx.revive.call.meta.toJSON(),simulation:result,estimatedNativeFee:fee.partialFee.toString(),note:'Read-only simulation of a genuine funded Substrate account. No signature, transfer or broadcast.'};
 writeFileSync('docs/qa/native-interface-proof.json',JSON.stringify(proof,null,2)+'\n');console.log('PASS: real native account mapping, faucet simulation, weight/storage encoding and fee estimate on Portaldot V3. No transaction broadcast.');
 }finally{await api.disconnect();}}
main().catch(e=>{console.error(e instanceof Error?e.message:'Native verification failed');process.exitCode=1;});
