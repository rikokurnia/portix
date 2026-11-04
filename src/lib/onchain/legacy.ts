import { encodeAbiParameters, keccak256, parseAbi, type Address } from 'viem';
export const legacyAddress = '0xb5f071B9e9b159C5Df573678400aB864d0Ec5415' as const;
export const legacyAbi = parseAbi([
 'function balanceOf(address) view returns (uint256)',
 'function previewDepositCarry(uint256) view returns (uint256,uint256,uint256)',
 'function previewWithdrawCarry(uint256) view returns (uint256,uint256,uint256,uint256)',
 'function depositAndInvest(uint256,address) returns (uint256)',
 'function withdrawWithYield(uint256,address,address) returns (uint256)',
]);
// Verified against the deployed runtime and historical deposit at block 314312.
export const legacySharesSlot = (owner: Address) => keccak256(encodeAbiParameters([{type:'address'},{type:'uint256'}],[owner,2n]));

export const legacyRuntimeHash = "0xbb4a9f30149eeeb4a6f9267d84c24dc3a6639e6ca0bef48afb726d905dcd2c46";
export const isLegacyRuntime = (code: `0x${string}` | undefined) => !!code && keccak256(code) === legacyRuntimeHash;
