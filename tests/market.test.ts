import { strict as assert } from "node:assert";
import { isReadRequest } from "../src/lib/onchain/rpc-policy";
import { parseUnits } from "viem";
import { calculateBuy, calculateSell } from "../src/lib/trade-calculations";
import { calculateSMA } from "../src/features/market/calculations";
import { aggregateObservations, dailyChange } from "../src/lib/onchain/history";
const buy = calculateBuy(300, 300, 10);
const spend = 300_000_000n,
  gross = (spend * 10000n) / 10010n;
assert.equal(buy.netSpend, Number(gross) / 1e6);
assert.equal(buy.fee, Number(spend - gross) / 1e6);
assert.equal(
  buy.stockQuantity,
  Number((gross * 10n ** 18n) / 300_000_000n) / 1e18,
);
assert.equal(
  calculateBuy(300, 300, 20).fee > buy.fee,
  true,
  "Use deployed fee, not a constant",
);
assert.equal(calculateBuy(NaN, 300, 10).stockQuantity, 0);
assert.equal(calculateBuy(100, 0, 10).stockQuantity, 0);
assert.equal(calculateBuy(100, 300, -1).stockQuantity, 0);
const sell = calculateSell(0.999, 300, 10);
assert.equal(sell.grossPayout, 299.7);
assert.equal(sell.fee, 0.2997);
assert.equal(sell.netPayout, 299.4003);
assert.equal(
  parseUnits("1.123456789012345678", 18),
  1123456789012345678n,
  "Raw token inputs preserve all 18 decimals",
);
const observations = [
  { timestamp: 600, price: 100 },
  { timestamp: 602, price: 103 },
  { timestamp: 604, price: 99 },
  { timestamp: 900, price: 102 },
];
const candles = aggregateObservations(observations, "1D");
assert.equal(candles.length, 2);
assert.deepEqual(candles[0], {
  time: 600,
  open: 100,
  high: 103,
  low: 99,
  close: 99,
});
assert.equal(
  candles[0].volume,
  undefined,
  "Oracle prices must not invent trade volume",
);
assert.equal(
  aggregateObservations([], "1M").length,
  0,
  "No synthetic history for empty data",
);
assert.equal(
  aggregateObservations(
    [
      { timestamp: 0, price: 5 },
      { timestamp: 9, price: NaN },
    ],
    "1D",
  ).length,
  0,
);
assert.equal(
  dailyChange(observations),
  undefined,
  "No fabricated daily change without a prior-day observation",
);
assert.equal(calculateSMA(candles, 2)[0].value, 100.5);
console.log(
  "Market: exact on-chain fee arithmetic, decimals, observed OHLC, absent volume and history passed.",
);

assert.equal(
  isReadRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{}, "latest"],
  }),
  true,
);
for (const method of [
  "eth_sendRawTransaction",
  "eth_sendTransaction",
  "personal_sign",
  "eth_sign",
  "personal_unlockAccount",
])
  assert.equal(
    isReadRequest({ jsonrpc: "2.0", id: 1, method, params: [] }),
    false,
  );
assert.equal(
  isReadRequest([{ jsonrpc: "2.0", id: 1, method: "eth_call", params: [] }]),
  false,
);
console.log(
  "RPC proxy policy: public reads allowed; signing and broadcasting rejected.",
);
