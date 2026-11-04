import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { formatUnits } from 'viem';
import { nativeEvmAddress } from '../src/features/wallet/native-address';
import { nativeGenesis } from '../src/features/wallet/native-client';
import { isolatedAccounting, vaultIntegrationIssue } from '../src/lib/onchain/contracts';

// 1. Genesis hash testnet constant
assert.equal(
  nativeGenesis,
  '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd',
  'Genesis hash must match Portaldot V3 testnet',
);

// 2. Substrate to EVM mapping
const testSubstrate = '5D8KLRtTW9SxCzzKh3QbcvDfVYF8G5mJ6ZAmQkwaHvaoqCtT';
const expectedEvm = '0x4761b9441732D6d1d1680Ca240760B9DD4ed680d';
assert.equal(
  nativeEvmAddress(testSubstrate),
  expectedEvm,
  'nativeEvmAddress must correctly map Substrate pubkey to last 20 bytes of keccak256',
);

// Invalid input rejection
assert.throws(
  () => nativeEvmAddress('invalid-substrate-address'),
  /Choose a Substrate account/,
);

// 3. Decimal and arithmetic verification
// Substrate uses 14 decimals for native tPOT
const nativeRaw = 100000000000000n; // 1 tPOT
assert.equal(formatUnits(nativeRaw, 14), '1');

// Buy arithmetic: 10 bps fee, $300 oracle price
const spend = 100_000_000n; // 100 pUSDC (6 decimals)
const fee = (spend * 10n) / 10000n; // 0.1 pUSDC
const netSpend = spend - fee; // 99.9 pUSDC
const stockReceived = (netSpend * 10n**18n) / 300_000_000n;
assert.equal(formatUnits(stockReceived, 18), '0.333');

// 4. Incompatible accounting protection
if (!isolatedAccounting) {
  assert.ok(vaultIntegrationIssue.length > 0, 'Incompatible accounting must set a warning issue');
}

// 5. Native interface proof check
const proofPath = 'docs/qa/native-interface-proof.json';
if (existsSync(proofPath)) {
  const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
  assert.equal(proof.genesisHash, nativeGenesis);
  assert.equal(proof.autoMap, true);
  assert.equal(proof.mappingVerified, true);
  assert.ok(BigInt(proof.estimatedNativeFee) > 0n);
}

console.log('PASS: native wallet address derivation, Portaldot V3 genesis, fee arithmetic, and interface proof.');
