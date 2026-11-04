import { strict as assert } from "node:assert";
import {
  buyStock,
  sellStock,
  depositToVault,
  withdrawFromVault,
  claimFaucet,
  getPortfolioSnapshot,
  setPortfolioAccount,
  updatePortfolio,
  registerPortfolioExecutor,
  recordActivity,
} from "../src/lib/portfolio-store";
import type { Address, Hash } from "viem";
const owner = "0x0000000000000000000000000000000000000001" as Address;
const other = "0x0000000000000000000000000000000000000002" as Address;
const hash = `0x${"1".repeat(64)}` as Hash;
async function main() {
  assert.equal(getPortfolioSnapshot().pUSDC, 0);
  assert.equal(getPortfolioSnapshot().positions.length, 0);
  assert.equal(
    (await claimFaucet()).ok,
    false,
    "Disconnected faucet cannot change balances",
  );
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
    configurable: true,
  });
  setPortfolioAccount(owner);
  let executed = 0;
  registerPortfolioExecutor(async () => {
    executed++;
    return { ok: true, hash };
  });
  assert.equal((await sellStock("AAPL", 0)).ok, false);
  assert.equal((await depositToVault("pxPrime", "AAPL", NaN)).ok, false);
  assert.equal((await withdrawFromVault("pxBoost", "AAPL", -1)).ok, false);
  assert.equal(executed, 0);
  assert.equal((await buyStock("AAPL", 1, 300)).ok, true);
  assert.equal(
    getPortfolioSnapshot().pUSDC,
    0,
    "Actions must not optimistically credit fixture balances",
  );
  updatePortfolio({ pending: "Waiting for receipt" });
  assert.equal(
    (await claimFaucet()).ok,
    false,
    "Prevent concurrent wallet requests",
  );
  updatePortfolio({ pending: "" });
  recordActivity(owner, {
    id: hash,
    hash,
    type: "Faucet",
    stockId: "pUSDC",
    amount: 5000,
    timestamp: new Date().toISOString(),
    status: "Pending",
  });
  recordActivity(owner, {
    ...getPortfolioSnapshot().activity[0],
    status: "Completed",
  });
  assert.equal(
    getPortfolioSnapshot().activity.length,
    1,
    "Receipt updates deduplicate by real hash",
  );
  assert.equal(getPortfolioSnapshot().activity[0].status, "Completed");
  updatePortfolio({ pUSDC: 5000, ready: true });
  setPortfolioAccount(other);
  assert.equal(
    getPortfolioSnapshot().activity.length,
    0,
    "Activity is wallet scoped",
  );
  assert.equal(
    getPortfolioSnapshot().pUSDC,
    0,
    "No previous wallet balance leaks on switch",
  );
  setPortfolioAccount(owner);
  assert.equal(
    getPortfolioSnapshot().activity[0].hash,
    hash,
    "Activity survives reconnect",
  );
  assert.equal(
    getPortfolioSnapshot().ready,
    false,
    "Balances always reload from chain",
  );
  setPortfolioAccount(undefined);
  registerPortfolioExecutor(undefined);
  assert.equal((await claimFaucet()).ok, false);
  console.log(
    "Portfolio: empty initial state, wallet isolation, receipt persistence, concurrent and disconnected action guards passed.",
  );
}
void main();
