import {strict as assert} from 'node:assert';
import {evmFundingAddress} from '../src/lib/evm-funding';
import {portaldot} from '../src/features/wallet/chain';
assert.equal(evmFundingAddress('0x3528ea50B67236a31d6BC1Fb94f36cDcf0e71995'),'5DGQYpYD4q2DmNWjTgUWo6aaFXCgdAeFcTiD37fyfK1ZXDT7');
assert.throws(()=>evmFundingAddress('5DGQYpYD4q2DmNWjTgUWo6aaFXCgdAeFcTiD37fyfK1ZXDT7'));
assert.equal(portaldot.nativeCurrency.decimals,18);
console.log('PASS: chain-verified SS58/EVM funding pair; reject Substrate input; EVM RPC decimals.');
