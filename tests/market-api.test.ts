import { strict as assert } from 'node:assert';
import { GET as history } from '../src/app/api/market/[stock]/route';
import { GET as summaries } from '../src/app/api/market/route';

async function main() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Upstream offline'); };
  try {
    const response = await history(new Request('http://localhost/api/market/AAPL?timeframe=1D'),
      { params: Promise.resolve({stock: 'AAPL'}) });
    const body = await response.json();
    assert.equal(body.available, false);
    assert.equal(body.price, 0);
    assert.deepEqual(body.candles, []);
    assert.deepEqual(body.observations, []);
    const list = await (await summaries()).json();
    assert.deepEqual(list.stocks, {});
    assert.equal(list.available, false);
    const cached = await (await summaries()).json();
    assert.equal(cached.available, false);
    const unknown = await history(new Request('http://localhost/api/market/UNKNOWN'),
      { params: Promise.resolve({stock: 'UNKNOWN'}) });
    assert.equal(unknown.status, 404);
    console.log('PASS: upstream outage returns unavailable data, never synthetic prices/candles; unknown stock is 404.');
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
