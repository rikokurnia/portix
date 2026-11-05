import {boostPool,normalizePoolVolume} from '@/lib/vault-volume';
export const dynamic='force-dynamic';
let cache:{expires:number;data:ReturnType<typeof normalizePoolVolume>&{observedAt:string}}|undefined;
export async function GET(){
 if(cache&&cache.expires>Date.now())return Response.json({...cache.data,available:true});
 try{const r=await fetch(`https://api.geckoterminal.com/api/v2/networks/eth/pools/${boostPool}`,{signal:AbortSignal.timeout(8000),cache:'no-store'});if(!r.ok)throw Error('Volume unavailable');const data={...normalizePoolVolume(await r.json()),observedAt:new Date().toISOString()};cache={expires:Date.now()+60000,data};return Response.json({...data,available:true});}
 catch{return Response.json({available:false,error:'Pool volume is temporarily unavailable.'},{status:503});}
}
