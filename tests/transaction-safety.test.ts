import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { isolatedAccounting } from '../src/lib/onchain/contracts';
import { readMarket } from '../src/lib/onchain/account';

async function main() {
// Current live manifest aliases eight equities and sixteen vaults to one legacy contract.
if (!isolatedAccounting) {
  const market = await readMarket();
  assert.deepEqual(market.prices, {}, 'Incompatible accounting must not supply trade prices');
  assert.equal(market.priceError, true);
}
const historySource = readFileSync('src/features/market/useStockHistory.ts', 'utf8');
assert.ok(!/updatePortfolio|getPortfolioSnapshot/.test(historySource),
  'External chart polling must never write settlement oracle prices');
for (const name of ['BuyModal', 'SellModal']) {
  const source = readFileSync(`src/features/market/${name}.tsx`, 'utf8');
  assert.ok(source.includes('<TradeModal'), `${name} must use the receipt-confirmed executor`);
  assert.ok(!/updatePortfolio|Demo|setSuccessInfo/.test(source), `${name} must not fabricate balances or success`);
}
console.log('PASS: incompatible deployment disables trade prices; chart polling cannot overwrite oracle state.');

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
