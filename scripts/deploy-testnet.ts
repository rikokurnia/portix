import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeDeployData, http, type Abi, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { portaldot } from '../src/features/wallet/chain';
const local = process.argv.includes('--local');
const rpc = local ? 'http://127.0.0.1:8547' : portaldot.rpcUrls.default.http[0];
const keyPath = local ? '.env.testnet-deployment-local' : '.env.testnet-deployment';
if (!existsSync(keyPath)) writeFileSync(keyPath, `DEPLOYER_PRIVATE_KEY=${generatePrivateKey()}\n`, {mode:0o600});
const key = readFileSync(keyPath,'utf8').trim().split('=')[1] as Hex;
const account = privateKeyToAccount(key);
const client = createPublicClient({chain:portaldot,transport:http(rpc,{retryCount:1,timeout:20000})});
const wallet = createWalletClient({account,chain:portaldot,transport:http(rpc)});
const statePath = `contracts/artifacts-for-integration/isolated-deployment${local ? '.local' : ''}.json`;
mkdirSync('contracts/artifacts-for-integration',{recursive:true});
type DeploymentState = {deployer: string; contracts: Record<string, Address>; stocks: Record<string, {name:string;token:Address;decimals:number;primeVault?:Address;boostVault?:Address}>; transactions: {label:string;hash:Hex;block:string}[];pending?:{label:string;hash:Hex;deployment:boolean}};
const state: DeploymentState = existsSync(statePath) ? JSON.parse(readFileSync(statePath,'utf8')) : {deployer:account.address,contracts:{},stocks:{},transactions:[]};
if (state.deployer !== account.address) throw Error('Deployment signer does not match saved progress');
const save=()=>writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
const artifact=(name:string)=>JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8'));
async function confirm(label:string,hash:Hex,deployment:boolean){
 state.pending={label,hash,deployment};save();
 const receipt=await client.waitForTransactionReceipt({hash,timeout:180000});
 if(receipt.status!=='success'){delete state.pending;save();throw Error(`${label} reverted`);}
 if(deployment){if(!receipt.contractAddress)throw Error('Missing deployed address');state.contracts[label]=receipt.contractAddress;}
 state.transactions.push({label,hash,block:String(receipt.blockNumber)});delete state.pending;save();
}
async function deploy(label:string,name:string,args:readonly unknown[]) {
 if(state.contracts[label]) return state.contracts[label] as Address;
 const a=artifact(name); const data=encodeDeployData({abi:a.abi,bytecode:a.bytecode.object,args});
 const gas=await client.estimateGas({account:account.address,data});
 const hash=await wallet.deployContract({abi:a.abi,bytecode:a.bytecode.object,args,gas,gasPrice:await client.getGasPrice()});
 console.log(label,hash);await confirm(label,hash,true);return state.contracts[label];
}
async function send(label:string,target:Address,name:string,fn:string,args:readonly unknown[]) {
 if(state.transactions.some((t)=>t.label===label)) return;
 const {request}=await client.simulateContract({account,address:target,abi:artifact(name).abi as Abi,functionName:fn,args});
 const gas=await client.estimateContractGas(request);
 const hash=await wallet.writeContract({address:target,abi:artifact(name).abi as Abi,functionName:fn,args,gas,gasPrice:await client.getGasPrice(),type:'legacy'});console.log(label,hash);
 await confirm(label,hash,false);
}
async function main(){
 console.log('Deployment wallet:',account.address);
 if(local) await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'anvil_setBalance',params:[account.address,'0x3635c9adc5dea00000']})});
 if(await client.getChainId()!==420420777)throw Error('Wrong network');
 const balance=await client.getBalance({address:account.address});const gasPrice=await client.getGasPrice();
 console.log('Balance (raw):',String(balance),'Gas price:',String(gasPrice));
 const a=artifact('MockPUSDC');
 try { const gas=await client.estimateGas({account:account.address,data:encodeDeployData({abi:a.abi,bytecode:a.bytecode.object,args:[account.address]})});console.log('First deployment gas:',String(gas),'Estimated fee (raw):',String(gas*gasPrice)); }
 catch { console.log('First deployment cannot be estimated with the current wallet balance.'); }
 if(!process.argv.includes('--broadcast'))return;
 if(balance===0n)throw Error('Fund the deployment wallet before broadcasting');
 if(state.pending)await confirm(state.pending.label,state.pending.hash,state.pending.deployment);
 const owner=account.address;
 const usdc=await deploy('pUSDC','MockPUSDC',[owner]);
 // Testnet reference prices remain valid until an explicit operator update.
 const oracle=await deploy('priceOracle','PortixPriceOracle',[owner,315360000]);
 const market=await deploy('stockMarket','StockMarket',[usdc,oracle,10,owner]);
 const pool=await deploy('debtPool','PortixDebtPool',[usdc,0,owner]);
 const factory=await deploy('vaultFactory','PortixVaultFactory',[usdc,oracle,pool,owner]);
 for(const [id,name,price] of [['AAPL','Apple Inc.',300],['GOOGL','Alphabet Inc.',300],['NFLX','Netflix Inc.',120],['MSFT','Microsoft Corp.',510],['META','Meta Platforms Inc.',720],['SPY','SPDR S&P 500 ETF',585],['QQQ','Invesco QQQ Trust',495],['NVDA','NVIDIA Corp.',140]] as const){
  const token=await deploy(id,'MockStockToken',[name,id,owner]);
  await send(`${id}:bounds`,oracle,'PortixPriceOracle','configureToken',[token,1n,10000000000n]);
  await send(`${id}:price`,oracle,'PortixPriceOracle','setPrice',[token,BigInt(price)*1000000n]);
  await send(`${id}:supported`,market,'StockMarket','setStockSupported',[token,true]);
  await send(`${id}:inventory`,token,'MockStockToken','mint',[market,5000n*10n**18n]);
  state.stocks[id]={name,token,decimals:18};
  for(const [strategy,kind] of [['primeVault',0],['boostVault',1]] as const){
   await send(`${id}:${strategy}`,factory,'PortixVaultFactory','createVault',[token,kind,4000n,8000n,`Portix ${strategy} ${id}`,`${kind===0?'pxP':'pxB'}-${id}`]);
   const vault=await client.readContract({address:factory,abi:artifact('PortixVaultFactory').abi,functionName:'getVault',args:[token,kind]}) as Address;
   await send(`${id}:${strategy}:authorize`,pool,'PortixDebtPool','setVaultAuthorized',[vault,true]);
   state.stocks[id][strategy]=vault;save();
  }
 }
 await send('market:liquidity',usdc,'MockPUSDC','mint',[market,2000000n*1000000n]);
 await send('pool:liquidity',usdc,'MockPUSDC','mint',[pool,5000000n*1000000n]);
 const manifest={network:{name:portaldot.name,chainId:portaldot.id,rpcUrl:portaldot.rpcUrls.default.http[0],blockExplorer:portaldot.blockExplorers.default.url},contracts:Object.fromEntries(['pUSDC','priceOracle','stockMarket','debtPool','vaultFactory'].map(k=>[k,state.contracts[k]])),stocks:state.stocks,deploymentBlock:Number(state.transactions[0].block)};
 writeFileSync(local ? 'contracts/artifacts-for-integration/isolated-manifest.local.json' : 'contracts/artifacts-for-integration/address-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('Compatible manifest published. Run npm run sync:contracts and npm run verify:onchain.');
}
main().catch(e=>{console.error(e instanceof Error ? e.message.split('\n')[0]:'Deployment failed');process.exitCode=1;});
