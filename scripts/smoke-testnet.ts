import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {createPublicClient,createWalletClient,http,type Address,type Abi,type Hex} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {portaldot} from '../src/features/wallet/chain';
const local=process.argv.includes('--local');
const rpc=local?'http://127.0.0.1:8547':portaldot.rpcUrls.default.http[0];
const path=local?'.env.testnet-tester-local':'.env.testnet-tester';
if(!existsSync(path))writeFileSync(path,`PRIVATE_KEY=${generatePrivateKey()}\n`,{mode:0o600});
const account=privateKeyToAccount(readFileSync(path,'utf8').trim().split('=')[1] as Hex);
const client=createPublicClient({chain:portaldot,transport:http(rpc),pollingInterval:local?50:4000});
const wallet=createWalletClient({account,chain:portaldot,transport:http(rpc)});
const artifact=(name:string)=>JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8')).abi as Abi;
const proofs:{label:string;hash:Hex;block:string}[]=[];
async function send(label:string,address:Address,name:string,functionName:string,args:readonly unknown[]){
 await client.simulateContract({account,address,abi:artifact(name),functionName,args});
 const gas=await client.estimateContractGas({account,address,abi:artifact(name),functionName,args});
 const hash=await wallet.writeContract({address,abi:artifact(name),functionName,args,gas,gasPrice:await client.getGasPrice(),type:'legacy'});
 const receipt=await client.waitForTransactionReceipt({hash,timeout:180000});assert.equal(receipt.status,'success');proofs.push({label,hash,block:String(receipt.blockNumber)});console.log(label,hash);
}
async function read(address:Address,name:string,functionName:string,args:readonly unknown[]=[]){return await client.readContract({address,abi:artifact(name),functionName,args});}
async function main(){
 console.log('Test wallet:',account.address);
 assert.equal(await client.getChainId(),420420777);
 if(local)await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'anvil_setBalance',params:[account.address,'0x3635c9adc5dea00000']})});
 const m=JSON.parse(readFileSync(local?'contracts/artifacts-for-integration/isolated-manifest.local.json':'src/lib/onchain/addresses.json','utf8'));
 const usdc=m.contracts.pUSDC as Address,market=m.contracts.stockMarket as Address;
 assert.equal(new Set(Object.values(m.stocks).map(s=>(s as {token:string}).token)).size,8,'Refuse aliased legacy deployment');
 await send('faucet',usdc,'MockPUSDC','faucet',[account.address,5000n*1000000n]);
 for(const [symbol,entry] of Object.entries(m.stocks)){
 const s=entry as {token:Address;primeVault:Address;boostVault:Address};
 const before=await read(s.token,'MockStockToken','balanceOf',[account.address]) as bigint;
 await send(`${symbol}:approve-buy`,usdc,'MockPUSDC','approve',[market,300n*1000000n]);
 await send(`${symbol}:buy`,market,'StockMarket','buyStockWithExactUSDC',[s.token,300n*1000000n]);
 const bought=(await read(s.token,'MockStockToken','balanceOf',[account.address]) as bigint)-before;assert.ok(bought>0n);
 for(const [key,amount] of [['primeVault',bought/2n],['boostVault',bought-bought/2n]] as const){
 const vault=s[key];await send(`${symbol}:${key}:approve`,s.token,'MockStockToken','approve',[vault,amount]);
 await send(`${symbol}:${key}:deposit`,vault,'PortixVault','depositAndInvest',[amount,account.address]);
 const shares=await read(vault,'PortixVault','balanceOf',[account.address]) as bigint;assert.ok(shares>0n);
 const strategy=await read(vault,'PortixVault','strategyContract') as Address;
 const adapter=key==='primeVault'?'MockLendingStrategyAdapter':'MockAmmStrategyAdapter';
 await send(`${symbol}:${key}:approve-yield`,usdc,'MockPUSDC','approve',[strategy,1000000n]);
 await send(`${symbol}:${key}:fund-yield`,strategy,adapter,'fundYield',[1000000n]);
 await send(`${symbol}:${key}:withdraw`,vault,'PortixVault','withdrawWithYield',[shares,account.address,account.address]);
 assert.equal(await read(vault,'PortixVault','balanceOf',[account.address]),0n);
 }
 assert.equal(await read(s.token,'MockStockToken','balanceOf',[account.address]),before+bought);
 await send(`${symbol}:approve-sell`,s.token,'MockStockToken','approve',[market,bought]);
 const beforeSale=await read(usdc,'MockPUSDC','balanceOf',[account.address]) as bigint;
 await send(`${symbol}:sell`,market,'StockMarket','sellStock',[s.token,bought]);
 assert.ok((await read(usdc,'MockPUSDC','balanceOf',[account.address]) as bigint)>beforeSale);
 assert.equal(await read(s.token,'MockStockToken','balanceOf',[account.address]),before);
 }
 writeFileSync(`docs/qa/${local?'local':'live'}-lifecycle.json`,JSON.stringify({checkedAt:new Date().toISOString(),account:account.address,chainId:420420777,environment:local?'local Anvil':'Portaldot testnet',proofs},null,2)+'\n');
 console.log('PASS: signed faucet, buy/sell all eight stocks, deposit/withdraw all sixteen vaults, funded yield and final balances.');
}
main().catch(e=>{console.error(e instanceof Error?e.message.split('\n')[0]:'Smoke test failed');process.exitCode=1;});
