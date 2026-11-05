import {strict as assert} from 'node:assert';
import {writeFileSync} from 'node:fs';
import {createPublicClient,createWalletClient,http,parseAbi,formatUnits,type Abi,type Address,type Hex} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {portaldot} from '../src/features/wallet/chain';
import {legacyAddress,legacyAbi,legacySharesSlot,isLegacyRuntime} from '../src/lib/onchain/legacy';
const rpc='http://127.0.0.1:8548';
const account=privateKeyToAccount(generatePrivateKey());
const c=createPublicClient({chain:portaldot,transport:http(rpc),pollingInterval:50});
const w=createWalletClient({account,chain:portaldot,transport:http(rpc)});
const usdc='0x9df05e926a3860a3ccaffa85bb0776c47a9238f4' as const;
const abi=parseAbi(['function faucet(address,uint256)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)','function buyStockWithExactUSDC(address,uint256) returns (uint256)','function sellStock(address,uint256) returns (uint256)']);
async function readShares(){return BigInt(await c.getStorageAt({address:legacyAddress,slot:legacySharesSlot(account.address)})??'0x0');}
const proofs:{label:string;hash:Hex}[]=[];
async function send(label:string,address:Address,contractAbi:Abi,functionName:string,args:readonly unknown[]){
 const {request}=await c.simulateContract({account,address,abi:contractAbi,functionName,args});
 const hash=await w.writeContract(request);const receipt=await c.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');proofs.push({label,hash});
}
async function main(){
 assert.ok(isLegacyRuntime(await c.getCode({address:legacyAddress})));
 await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'anvil_setBalance',params:[account.address,'0x3635c9adc5dea00000']})});
 await send('faucet',usdc,abi,'faucet',[account.address,5000000000n]);
 await send('approve',usdc,abi,'approve',[legacyAddress,300000000n]);
 await send('buy',legacyAddress,abi,'buyStockWithExactUSDC',[legacyAddress,300000000n]);
 const stock=await c.readContract({address:legacyAddress,abi:legacyAbi,functionName:'balanceOf',args:[account.address]});assert.ok(stock>0n);
 await send('deposit',legacyAddress,legacyAbi,'depositAndInvest',[stock,account.address]);
 assert.equal(await c.readContract({address:legacyAddress,abi:legacyAbi,functionName:'balanceOf',args:[account.address]}),0n);
 const shares=await readShares();assert.ok(shares>0n);
 const half=shares/2n;
 const preview=await c.readContract({address:legacyAddress,abi:legacyAbi,functionName:'previewWithdrawCarry',args:[half]});
 assert.equal(preview[0],half/3n);
 await send('withdraw-half',legacyAddress,legacyAbi,'withdrawWithYield',[half,account.address,account.address]);
 assert.equal(await readShares(),shares-half);
 assert.equal(await c.readContract({address:legacyAddress,abi:legacyAbi,functionName:'balanceOf',args:[account.address]}),half/3n);
 await send('withdraw-remainder',legacyAddress,legacyAbi,'withdrawWithYield',[shares-half,account.address,account.address]);
 assert.equal(await readShares(),0n);
 const returned=await c.readContract({address:legacyAddress,abi:legacyAbi,functionName:'balanceOf',args:[account.address]});assert.equal(returned,stock);
 const before=await c.readContract({address:usdc,abi,functionName:'balanceOf',args:[account.address]});
 await send('sell',legacyAddress,abi,'sellStock',[legacyAddress,stock]);
 const after=await c.readContract({address:usdc,abi,functionName:'balanceOf',args:[account.address]});assert.ok(after>before,'Sale must actually pay pUSDC');
 writeFileSync('docs/qa/vault-runtime-regression.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'Local replica of current live bytecode with local liquidity; no live transactions or gas spent',account:account.address,stockBought:formatUnits(stock,18),sharesMinted:formatUnits(shares,18),finalPUSDC:formatUnits(after,6),proofs},null,2)+'\n');console.log('PASS: actual legacy runtime faucet → buy → deposit → half withdrawal → full withdrawal → sell, verified balances and storage shares.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Fork check failed');process.exitCode=1;});
