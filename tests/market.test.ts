import { stocks } from "../src/lib/assets";
import { strict as assert } from "node:assert";
import {
  calculateSMA,
  calculateBuy,
  calculateSell,
} from "../src/features/market/calculations";
import {
  MARKET_STOCKS,
  MARKET_STOCK_IDS,
  MARKET_FIXTURE_DATA,
} from "../src/features/market/fixtures";
import type { CandleData } from "../src/features/market/types";
import type { Time } from "lightweight-charts";

console.log("Running Market test suite...");

// 1. Test Moving Average Calculations
const testCandles: CandleData[] = [
  {
    time: 1 as unknown as Time,
    open: 10,
    high: 12,
    low: 9,
    close: 10,
    volume: 100,
  },
  {
    time: 2 as unknown as Time,
    open: 10,
    high: 14,
    low: 10,
    close: 12,
    volume: 150,
  },
  {
    time: 3 as unknown as Time,
    open: 12,
    high: 15,
    low: 11,
    close: 14,
    volume: 200,
  },
  {
    time: 4 as unknown as Time,
    open: 14,
    high: 17,
    low: 13,
    close: 16,
    volume: 250,
  },
  {
    time: 5 as unknown as Time,
    open: 16,
    high: 19,
    low: 15,
    close: 18,
    volume: 300,
  }, // SMA(5) at i=4: (10+12+14+16+18)/5 = 14
  {
    time: 6 as unknown as Time,
    open: 18,
    high: 21,
    low: 17,
    close: 20,
    volume: 350,
  }, // SMA(5) at i=5: (12+14+16+18+20)/5 = 16
];

const ma5 = calculateSMA(testCandles, 5);
assert.equal(
  ma5.length,
  2,
  "Should produce 2 points for 6 candles with period 5",
);
assert.equal(ma5[0].value, 14, "First MA5 should be 14.00");
assert.equal(ma5[1].value, 16, "Second MA5 should be 16.00");

// Period larger than candle length should return empty array
const ma10Short = calculateSMA(testCandles, 10);
assert.equal(
  ma10Short.length,
  0,
  "Should return empty array when candles < period",
);

// 2. Test Buy Arithmetic matching market-popup-confirmation.png
// 300.00 pUSDC spend at $300.00/share
const buyAapl = calculateBuy(300, 300);
assert.equal(buyAapl.totalPayment, 300.0, "Total payment must be 300.00");
assert.equal(buyAapl.fee, 0.3, "Fee at 0.1% must be 0.30 pUSDC");
assert.equal(buyAapl.netSpend, 299.7, "Net spend must be 299.70 pUSDC");
assert.equal(buyAapl.stockQuantity, 0.999, "Stock received must be 0.999 AAPL");

// Boundary conditions for buy
assert.equal(calculateBuy(0, 300).stockQuantity, 0, "Zero spend gives 0 stock");
assert.equal(
  calculateBuy(-50, 300).stockQuantity,
  0,
  "Negative spend gives 0 stock",
);
assert.equal(
  calculateBuy(NaN, 300).stockQuantity,
  0,
  "NaN spend gives 0 stock",
);

// 3. Test Sell Arithmetic
// 1.000 AAPL sold at $300.00/share
const sellAapl = calculateSell(1.0, 300);
assert.equal(sellAapl.stockQuantity, 1.0, "Sold quantity must be 1.0");
assert.equal(sellAapl.grossPayout, 300.0, "Gross payout must be 300.00 pUSDC");
assert.equal(sellAapl.fee, 0.3, "Fee at 0.1% must be 0.30 pUSDC");
assert.equal(sellAapl.netPayout, 299.7, "Net payout must be 299.70 pUSDC");

// Boundary conditions for sell
assert.equal(calculateSell(0, 300).netPayout, 0, "Zero stock gives 0 payout");
assert.equal(
  calculateSell(-1, 300).netPayout,
  0,
  "Negative stock gives 0 payout",
);
assert.equal(calculateSell(NaN, 300).netPayout, 0, "NaN stock gives 0 payout");

// 4. Test Stock Fixtures Catalog
assert.equal(MARKET_STOCK_IDS.length, 5, "Exactly 5 stocks supported");
assert.deepEqual(MARKET_STOCK_IDS, ["AAPL", "GOOGL", "NFLX", "MSFT", "META"]);

assert.equal(MARKET_STOCKS.AAPL.price, 300.0, "AAPL price is $300.00");
assert.equal(MARKET_STOCKS.GOOGL.price, 300.0, "GOOGL price is $300.00");
assert.equal(MARKET_STOCKS.NFLX.price, 120.0, "NFLX price is $120.00");
assert.equal(MARKET_STOCKS.MSFT.price, 510.0, "MSFT price is $510.00");
assert.equal(MARKET_STOCKS.META.price, 720.0, "META price is $720.00");

// 5. Test Candle Fixtures for all timeframes
for (const id of MARKET_STOCK_IDS) {
  for (const tf of ["1D", "1W", "1M"] as const) {
    const candles = MARKET_FIXTURE_DATA[id][tf];
    assert.ok(
      candles.length >= 25,
      `${id} ${tf} should have sufficient candles`,
    );
    const last = candles[candles.length - 1];
    assert.equal(
      last.close,
      MARKET_STOCKS[id].price,
      `${id} ${tf} last candle close must equal stock price`,
    );

    // Check volume and moving averages
    for (const c of candles) {
      assert.ok(c.volume > 0, "Candle volume must be positive");
      assert.ok(c.high >= c.low, "High must be >= low");
      assert.ok(
        c.high >= Math.max(c.open, c.close),
        "High must be >= open & close",
      );
      assert.ok(
        c.low <= Math.min(c.open, c.close),
        "Low must be <= open & close",
      );
    }

    const ma5 = calculateSMA(candles, 5);
    const ma10 = calculateSMA(candles, 10);
    assert.ok(ma5.length > 0, `${id} ${tf} must have valid MA5 series`);
    assert.ok(ma10.length > 0, `${id} ${tf} must have valid MA10 series`);
  }
}

console.log(
  "PASS: Moving averages, buy/sell formulas, fee structure, boundary checks, and candle fixtures verified successfully.",
);

for (const id of MARKET_STOCK_IDS) {
  assert.equal(
    MARKET_STOCKS[id].price,
    stocks[id].price,
    `${id} must share one price across Market and Vault`,
  );
}
assert.equal(calculateBuy(10, NaN).stockQuantity, 0);
assert.equal(calculateBuy(10, Infinity).stockQuantity, 0);
assert.equal(calculateSell(1, NaN).netPayout, 0);
assert.equal(calculateSell(1, Infinity).netPayout, 0);
