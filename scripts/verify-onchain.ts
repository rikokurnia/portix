import { mkdirSync, writeFileSync } from "node:fs";
import { getAddress } from "viem";
import {
  isolatedAccounting,
  publicClient,
  manifest,
  tokenAbi,
  marketAbi,
  vaultAbi,
  oracleAbi,
} from "../src/lib/onchain/contracts";
import { stockIds } from "../src/lib/assets";
const results: {
  contract: string;
  address: string;
  status: string;
  detail?: string;
}[] = [];
async function verify(
  label: string,
  value: string,
  checks?: () => Promise<void>,
) {
  if (!value) {
    results.push({ contract: label, address: "", status: "MISSING" });
    return;
  }
  try {
    const code = await publicClient.getCode({ address: getAddress(value) });
    if (!code || code === "0x") {
      results.push({ contract: label, address: value, status: "NO CODE" });
      return;
    }
    await checks?.();
    results.push({ contract: label, address: value, status: "VERIFIED" });
  } catch {
    results.push({ contract: label, address: value, status: "READ FAILED" });
  }
}
async function main() {
  const chainId = await publicClient.getChainId(),
    block = await publicClient.getBlockNumber();
  if (chainId !== 420420777) throw new Error("Wrong RPC chain ID.");
  await verify("pUSDC", manifest.contracts.pUSDC, async () => {
    const decimals = await publicClient.readContract({
      address: getAddress(manifest.contracts.pUSDC),
      abi: tokenAbi,
      functionName: "decimals",
    });
    if (decimals !== 6) throw new Error("Settlement decimals mismatch.");
    // Read-only execution; no signing or broadcasting.
    await publicClient.simulateContract({
      address: getAddress(manifest.contracts.pUSDC),
      abi: tokenAbi,
      functionName: "faucet",
      args: ["0x0000000000000000000000000000000000000001", 5_000_000_000n],
      account: "0x0000000000000000000000000000000000000001",
    });
  });
  await verify("Oracle", manifest.contracts.priceOracle);
  await verify("Market", manifest.contracts.stockMarket, async () => {
    const settlement = (await publicClient.readContract({
      address: getAddress(manifest.contracts.stockMarket),
      abi: marketAbi,
      functionName: "pUSDC",
    })) as string;
    if (settlement.toLowerCase() !== manifest.contracts.pUSDC.toLowerCase())
      throw new Error("Settlement mismatch.");
  });
  await verify("Debt pool", manifest.contracts.debtPool);
  await verify("Vault factory", manifest.contracts.vaultFactory);
  for (const stock of stockIds) {
    const entry = manifest.stocks[stock];
    await verify(stock, entry.token, async () => {
      const decimals = await publicClient.readContract({
        address: getAddress(entry.token),
        abi: tokenAbi,
        functionName: "decimals",
      });
      if (decimals !== 18) throw new Error("Stock decimals mismatch.");
      await publicClient.readContract({
        address: getAddress(manifest.contracts.priceOracle),
        abi: oracleAbi,
        functionName: "getPriceUSD",
        args: [entry.token],
      });
      await publicClient.readContract({
        address: getAddress(manifest.contracts.stockMarket),
        abi: marketAbi,
        functionName: "quoteBuy",
        args: [entry.token, 10n ** 18n],
      });
    });
    for (const key of ["primeVault", "boostVault"] as const)
      await verify(`${stock}.${key}`, entry[key], async () => {
        const asset = (await publicClient.readContract({
          address: getAddress(entry[key]),
          abi: vaultAbi,
          functionName: "asset",
        })) as string;
        if (asset.toLowerCase() !== entry.token.toLowerCase())
          throw new Error("Collateral mismatch.");
        await publicClient.readContract({
          address: getAddress(entry[key]),
          abi: vaultAbi,
          functionName: "previewDepositCarry",
          args: [10n ** 18n],
        });
      });
  }
  const report = {
    isolatedAccounting,
    compatibility: isolatedAccounting ? "isolated" : "BLOCKED: aliases one balance across all stocks/vaults; see CONTRACT_INTEGRATION_FINDINGS.md",
    checkedAt: new Date().toISOString(),
    chainId,
    block: String(block),
    results,
  };
  mkdirSync("docs", { recursive: true });
  writeFileSync(
    "docs/onchain-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (!isolatedAccounting) console.error("BLOCKED: live code aliases all stock/vault balances. Vault accounting and withdrawal authorization require correction; see CONTRACT_INTEGRATION_FINDINGS.md.");
  console.table(results.map(({ contract, status }) => ({ contract, status })));
  console.log(
    `Checked chain ${chainId} at block ${block}. Report: docs/onchain-verification.json`,
  );
  if (!isolatedAccounting || results.some((r) => r.status !== "VERIFIED")) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Verification failed: RPC unavailable or invalid configuration.",
  );
  process.exitCode = 1;
});
