import { createHash } from 'node:crypto';
import { isAddress } from 'viem';
// Portaldot V3 revive mapping: H160 followed by twelve 0xEE bytes, SS58 prefix 42.
// Verified against the published deployer SS58/H160 pair and live System.Account storage.
export function evmFundingAddress(address:string):string {
 if(!isAddress(address))throw new Error('An EVM 0x address is required');
 const payload=Buffer.concat([Buffer.from([42]),Buffer.from(address.slice(2),'hex'),Buffer.alloc(12,0xee)]);
 const checksum=createHash('blake2b512').update(Buffer.concat([Buffer.from('SS58PRE'),payload])).digest().subarray(0,2);
 const data=Buffer.concat([payload,checksum]);let n=BigInt('0x'+data.toString('hex'));let encoded='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 while(n>0n){encoded=alphabet[Number(n%58n)]+encoded;n/=58n;}return encoded;
}
