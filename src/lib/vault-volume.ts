export const boostPool='0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
export function normalizePoolVolume(body:unknown){
 const value=body as {data?:{attributes?:{address?:string;volume_usd?:{h24?:string};reserve_in_usd?:string};relationships?:{dex?:{data?:{id?:string}}}}};
 const a=value?.data?.attributes;
 if(a?.address?.toLowerCase()!==boostPool||value.data?.relationships?.dex?.data?.id!=='uniswap_v3')throw Error('Unexpected pool');
 const volume=Number(a?.volume_usd?.h24),tvl=Number(a?.reserve_in_usd);
 if(a?.volume_usd?.h24==null||a?.reserve_in_usd==null||!Number.isFinite(volume)||volume<0||!Number.isFinite(tvl)||tvl<=0)throw Error('Volume unavailable');
 return {volume24h:volume,tvl,turnover24h:volume/tvl,pool:boostPool,source:'GeckoTerminal · Uniswap V3 Ethereum USDC/WETH 0.05%'};
}
