import { writeFileSync } from 'node:fs';
import { parseAbi, formatUnits } from 'viem';
import { publicClient, contracts } from '../src/lib/onchain/contracts';
import previousAudit from '../docs/qa/live-audit.json';
async function main() {
 const owner = "0x3528ea50B67236a31d6BC1Fb94f36cDcf0e71995" as const;
 const code = await publicClient.getCode({address: contracts.market!});
 let isolatedGetter = false;
 try {
  await publicClient.readContract({address: contracts.market!, abi: parseAbi(['function getVaultShares(address,uint8,address) view returns (uint256)']), functionName:'getVaultShares', args:[contracts.market!,0,owner]});
  isolatedGetter = true;
 } catch { /* An absent getter is an incompatibility, not proof of a corrected deployment. */ }
 const receipts = [];
 for (const entry of previousAudit.receipts) {
  const hash = entry.hash as `0x${string}`;
  try {
   const receipt = await publicClient.getTransactionReceipt({hash});
   receipts.push({action:entry.action,hash,status:receipt.status,block:String(receipt.blockNumber)});
  } catch { receipts.push({action:entry.action,hash,status:'READ FAILED'}); }
 }
 const report = {checkedAt:new Date().toISOString(),chainId:await publicClient.getChainId(),runtimeBytes:code ? (code.length-2)/2:0,isolatedGetter,deployerBalanceTPOT:formatUnits(await publicClient.getBalance({address:owner}),14),receipts,note:'Read-only verification of existing receipts. No new signed transaction broadcast.'};
 writeFileSync('docs/qa/live-audit.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
main().catch(()=>{console.error('Live audit failed: RPC unavailable.');process.exitCode=1;});
