import { strict as assert } from "node:assert";
import {
  normalizeYieldHistory,
  summarizeVault,
} from "../src/lib/vault-market-data";
const rows = [
  { timestamp: "2026-11-03T14:00:00Z", apy: 5, apyBase: 4, tvlUsd: 200 },
  { timestamp: "2026-11-02T00:00:00Z", apy: 3, apyBase: 2, tvlUsd: 100 },
  { timestamp: "2026-11-03T00:00:00Z", apy: 4, apyBase: 3, tvlUsd: 150 },
  { timestamp: "invalid", apy: 99, tvlUsd: 100 },
  { timestamp: "2026-11-04T00:00:00Z", apy: NaN, tvlUsd: 100 },
];
const normalized = normalizeYieldHistory(rows, "morpho");
assert.deepEqual(
  normalized.map((p) => p.time),
  ["2026-11-02", "2026-11-03"],
);
assert.equal(normalized[1].apy, 5);
assert.equal(normalized[1].tvl, 200);
assert.equal(normalizeYieldHistory(rows, "uniswap")[1].apy, 4);
assert.throws(() => normalizeYieldHistory([], "aave"));
assert.throws(() => normalizeYieldHistory(null, "aave"));
assert.equal(summarizeVault("pxPrime", { morpho: normalized }), null);
const aave = normalizeYieldHistory(
  [{ timestamp: "2026-11-03T00:00:00Z", apy: 3, tvlUsd: 100 }],
  "aave",
);
const compound = normalizeYieldHistory(
  [{ timestamp: "2026-11-03T00:00:00Z", apy: 2, tvlUsd: 100 }],
  "compound",
);
const summary = summarizeVault("pxPrime", {
  morpho: normalized,
  aave,
  compound,
})!;
assert.equal(summary.tvl, 400);
assert.equal(summary.apy, 3.75);
assert.equal(summary.updatedAt, "2026-11-03T00:00:00Z");
console.log(
  "PASS: source validation, UTC ordering/deduplication, Uniswap base APY and TVL-weighted benchmark.",
);
