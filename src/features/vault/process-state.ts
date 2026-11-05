import type { ActionResult, Activity } from "@/lib/portfolio-store";
import type { StockId, VaultId } from "@/lib/assets";

export type VaultProcessPhase =
  | "signing"
  | "confirming"
  | "confirmed"
  | "failed";

export interface VaultProcess {
  id: string;
  owner: string;
  stockId: StockId;
  vaultId: VaultId;
  type: "Deposit" | "Withdraw";
  existingHashes: string[];
  result?: ActionResult;
}
export type VaultProcessEvent =
  | { type: "start"; process: VaultProcess }
  | { type: "settled"; id: string; result: ActionResult };

export function getVaultProcessState(
  process: VaultProcess,
  activity: Activity[],
) {
  const transaction = activity.find(
    (a) =>
      !process.existingHashes.includes(a.hash) &&
      a.vaultId === process.vaultId &&
      a.stockId === process.stockId &&
      a.type === process.type,
  );
  const hash = process.result?.ok ? process.result.hash : transaction?.hash;
  const phase: VaultProcessPhase =
    process.result?.ok || transaction?.status === "Completed"
      ? "confirmed"
      : process.result?.ok === false || transaction?.status === "Failed"
        ? "failed"
        : transaction
          ? "confirming"
          : "signing";
  return {
    phase,
    hash,
    error: process.result?.ok === false ? process.result.error : undefined,
  };
}
