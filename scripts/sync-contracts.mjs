import fs from "node:fs";
const source = JSON.parse(
  fs.readFileSync(
    "contracts/artifacts-for-integration/address-manifest.json",
    "utf8",
  ),
);
const publicData = Object.fromEntries(
  ["network", "contracts", "stocks"].map((key) => [key, source[key]]),
);
publicData.deploymentBlock =
  source.deployment?.pUSDCBlockNumber ?? source.deploymentBlock;
if (!Number.isSafeInteger(publicData.deploymentBlock))
  throw new Error("A deployment block is required.");
const stockIds = [
  "AAPL",
  "GOOGL",
  "NFLX",
  "MSFT",
  "META",
  "SPY",
  "QQQ",
  "NVDA",
];
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const missing = [];
for (const key of [
  "pUSDC",
  "priceOracle",
  "stockMarket",
  "debtPool",
  "vaultFactory",
]) {
  const value = publicData.contracts?.[key];
  if (!value) missing.push(key);
  else if (!addressPattern.test(value))
    throw new Error(`Invalid address: ${key}`);
}
for (const stock of stockIds)
  for (const key of ["token", "primeVault", "boostVault"]) {
    const value = publicData.stocks?.[stock]?.[key];
    if (!value) missing.push(`${stock}.${key}`);
    else if (!addressPattern.test(value))
      throw new Error(`Invalid address: ${stock}.${key}`);
  }
// Explicit allowlist: excludes deployment signing material and private build artifacts.
const safe = {
  network: {
    name: String(publicData.network.name),
    chainId: Number(publicData.network.chainId),
    rpcUrl: String(publicData.network.rpcUrl),
    blockExplorer: String(publicData.network.blockExplorer),
  },
  contracts: Object.fromEntries(
    ["pUSDC", "priceOracle", "stockMarket", "debtPool", "vaultFactory"].map(
      (k) => [k, publicData.contracts[k] ?? ""],
    ),
  ),
  stocks: Object.fromEntries(
    stockIds.map((id) => [
      id,
      {
        name: String(publicData.stocks[id].name),
        token: publicData.stocks[id].token ?? "",
        decimals: Number(publicData.stocks[id].decimals),
        primeVault: publicData.stocks[id].primeVault ?? "",
        boostVault: publicData.stocks[id].boostVault ?? "",
      },
    ]),
  ),
  deploymentBlock: publicData.deploymentBlock,
};
fs.writeFileSync(
  "src/lib/onchain/addresses.json",
  `${JSON.stringify(safe, null, 2)}\n`,
);
console.log(
  `Public manifest synchronized. Missing addresses: ${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`,
);
