import {readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,http,encodeDeployData,formatUnits} from 'viem';
import {portaldot} from '../src/features/wallet/chain';
async function main(){
 const c=createPublicClient({chain:portaldot,transport:http()});
 const owner='0x3528ea50B67236a31d6BC1Fb94f36cDcf0e71995' as const;
 const token='0xb5f071B9e9b159C5Df573678400aB864d0Ec5415';const usdc='0x9df05e926a3860a3ccaffa85bb0776c47a9238f4';
 const rows=[];let total=0n;const gasPrice=await c.getGasPrice();
 for(const [name,args,count] of [
 ['MockPUSDC',[owner],1],['PortixPriceOracle',[owner,315360000],1],['MockStockToken',['Apple Inc.','AAPL',owner],8],
 ['StockMarket',[usdc,token,10,owner],1],['PortixDebtPool',[usdc,0,owner],1],['PortixVaultFactory',[usdc,token,token,owner],1],
 ['MockLendingStrategyAdapter',[usdc,owner],8],['MockAmmStrategyAdapter',[usdc,owner],8],
 ['PortixVault',[token,usdc,token,token,token,4000,8000,0,'Portix primeVault AAPL','pxP-AAPL',owner],16]
 ] as const){
 const a=JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8'));
 const data=encodeDeployData({abi:a.abi,bytecode:a.bytecode.object,args});
 try{const gas=await c.estimateGas({account:owner,data});const fee=gas*gasPrice;total+=fee*BigInt(count);rows.push({name,count,gas:String(gas),feeRaw:String(fee),feeTPOT:formatUnits(fee,18)});}catch{rows.push({name,count,error:'Estimate failed'});}
 }
 const report={checkedAt:new Date().toISOString(),evmDecimals:18,substrateDecimals:14,rows,estimatedDeploymentTotalRaw:String(total),estimatedDeploymentTotalTPOT:formatUnits(total,18),provisionalBudgetTPOT:formatUnits(total*120n/100n,18),note:'Unsigned creation estimates with reference addresses; factory-created vaults, configuration calls and storage refunds can differ. Budget includes 20% margin. No broadcasts.'};
 writeFileSync('docs/qa/deployment-budget.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(()=>{console.error('Estimation failed');process.exitCode=1;});
