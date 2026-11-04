import { decodeAddress } from '@polkadot/util-crypto';
import { bytesToHex, getAddress, keccak256, type Address } from 'viem';
export function nativeEvmAddress(address:string):Address {
 try {
  const bytes=decodeAddress(address);
  if(bytes.length!==32)throw new Error('Choose a Substrate account.');
  const ethDerived=bytes.slice(20).every(byte=>byte===0xee);
  return getAddress(ethDerived?bytesToHex(bytes.slice(0,20)):`0x${keccak256(bytesToHex(bytes)).slice(-40)}`);
 } catch {
  throw new Error('Choose a Substrate account.');
 }
}
