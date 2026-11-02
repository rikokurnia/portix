import { strict as assert } from "node:assert";
import {
  buyStock,
  sellStock,
  depositToVault,
  withdrawFromVault,
  getPortfolioSnapshot,
} from "../src/lib/portfolio-store";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 0.000002, `${a} != ${b}`);
assert.equal(buyStock("AAPL", 0).ok, false);
assert.equal(buyStock("AAPL", NaN).ok, false);
assert.equal(buyStock("AAPL", 0.1234567).ok, false);
assert.equal(buyStock("AAPL", 100).ok, false);
assert.equal(sellStock("AAPL", 5).ok, false);
assert.equal(buyStock("AAPL", 0.5).ok, true);
near(getPortfolioSnapshot().pUSDC, 2349.85);
near(getPortfolioSnapshot().stockBalances.AAPL, 4.5);
assert.equal(sellStock("AAPL", 0.5).ok, true);
near(getPortfolioSnapshot().pUSDC, 2499.7);
assert.equal(depositToVault("pxPrime", "MSFT", 0.5).ok, true);
const position = getPortfolioSnapshot().positions.find(
  (p) => p.stockId === "MSFT",
)!;
near(position.shares, 2.55); // 0.5 * $510 / $100
near(getPortfolioSnapshot().stockBalances.MSFT, 1.5);
assert.equal(withdrawFromVault("pxPrime", "MSFT", 1.275).ok, true);
near(getPortfolioSnapshot().stockBalances.MSFT, 1.75);
assert.equal(withdrawFromVault("pxPrime", "MSFT", 1.275).ok, true);
near(getPortfolioSnapshot().stockBalances.MSFT, 2);
assert.equal(
  getPortfolioSnapshot().positions.some((p) => p.stockId === "MSFT"),
  false,
);
assert.equal(withdrawFromVault("pxPrime", "GOOGL", 3.75).ok, true);
near(getPortfolioSnapshot().pUSDC, 2506);
near(getPortfolioSnapshot().stockBalances.GOOGL, 6.25);
near(
  getPortfolioSnapshot().positions.find((p) => p.stockId === "GOOGL")!
    .earnedYield,
  6.3,
);
assert.equal(withdrawFromVault("pxPrime", "GOOGL", 4).ok, false);
assert.equal(getPortfolioSnapshot().activity.length, 6);
console.log(
  "PASS: trade balances, invalid inputs, conversion, partial/full withdrawal, proportional yield and shared activity.",
);

// The Market receipt and shared account must settle identical fee-inclusive amounts.
const before = getPortfolioSnapshot();
assert.equal(buyStock("AAPL", 0.999, 300).ok, true);
near(getPortfolioSnapshot().pUSDC, before.pUSDC - 300);
near(
  getPortfolioSnapshot().stockBalances.AAPL,
  before.stockBalances.AAPL + 0.999,
);
assert.equal(buyStock("AAPL", 1, 0.01).ok, false);
assert.equal(buyStock("AAPL", 0.999, Infinity).ok, false);
assert.equal(buyStock("AAPL", 0.999, 300.001).ok, false);
assert.equal(sellStock("AAPL", 1).ok, true);
near(getPortfolioSnapshot().pUSDC, before.pUSDC - 0.3);
assert.equal(getPortfolioSnapshot().activity.length, 8);
console.log(
  "PASS: Market quoted payment and payout match account balances, including fees.",
);
