import { strict as assert } from "node:assert";
import {
  getVaultProcessState,
  type VaultProcess,
} from "../src/features/vault/process-state";
import type { Activity } from "../src/lib/portfolio-store";
const hash = `0x${"a".repeat(64)}` as const;
const process: VaultProcess = {
  id: "request",
  owner: "wallet",
  type: "Deposit",
  vaultId: "pxPrime",
  stockId: "AAPL",
  existingHashes: [],
};
const event: Activity = {
  id: hash,
  hash,
  type: "Deposit",
  vaultId: "pxPrime",
  stockId: "AAPL",
  amount: 1,
  timestamp: new Date().toISOString(),
  status: "Pending",
};
assert.equal(getVaultProcessState(process, []).phase, "signing");
assert.equal(
  getVaultProcessState(process, [
    { ...event, type: "Approve", vaultId: undefined },
  ]).phase,
  "signing",
  "Approval must not imply the vault call was submitted",
);
assert.equal(
  getVaultProcessState(process, [{ ...event, vaultId: "pxBoost" }]).phase,
  "signing",
  "Other strategy activity must not advance progress",
);
assert.equal(
  getVaultProcessState({ ...process, existingHashes: [hash] }, [event]).phase,
  "signing",
  "Earlier activity must not advance a new request",
);
assert.equal(getVaultProcessState(process, [event]).phase, "confirming");
assert.equal(getVaultProcessState(process, [event]).hash, hash);
assert.equal(
  getVaultProcessState(process, [{ ...event, status: "Completed" }]).phase,
  "confirmed",
);
assert.equal(
  getVaultProcessState(process, [{ ...event, status: "Failed" }]).phase,
  "failed",
);
assert.equal(
  getVaultProcessState(
    { ...process, result: { ok: false, error: "Wallet request rejected." } },
    [],
  ).phase,
  "failed",
);
assert.equal(
  getVaultProcessState({ ...process, result: { ok: true, hash } }, []).hash,
  hash,
);
assert.equal(
  getVaultProcessState({ ...process, type: "Withdraw" }, [event]).phase,
  "signing",
);
assert.equal(
  getVaultProcessState({ ...process, type: "Withdraw" }, [
    { ...event, type: "Withdraw", transport: "substrate", status: "Completed" },
  ]).phase,
  "confirmed",
  "Native Talisman receipts use the same confirmed state",
);
console.log(
  "PASS: vault progress follows current action, approval/signature, native/EVM receipt and failure states.",
);
