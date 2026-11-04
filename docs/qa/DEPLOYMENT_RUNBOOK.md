# Compatible testnet deployment

The immutable legacy deployment remains incompatible. This runbook deploys the isolated ERC-20/ERC-4626 stack. The adapters model lending/AMM strategies and require physically funded yield; real cross-chain routing is outside this prototype.

## Funding

Fresh deployment signer: `0x58D699b37e2bc14003A53965cC3289CFd02DB3e0`.

The private key is generated locally in ignored `.env.testnet-deployment` with owner-only permissions. It is not in Git or Vercel. Never fund this testnet wallet with mainnet assets.

The live node reports 14 native-token decimals (`system_properties`). Unsigned RPC estimates are in deployment-budget.json. Creation estimates total approximately 262.3 million tPOT; a provisional 20% margin produces approximately 315 million tPOT. In a wallet configured for 18 decimals, the same raw amount displays as 31,500. First pUSDC deployment alone needs approximately 2.29 million tPOT available. These estimates include the chain's storage deposit reservation; factory creation and configuration can differ.

## Commands

Run from the frontend repository root after funding:

```bash
npx tsx scripts/deploy-testnet.ts
npx tsx scripts/deploy-testnet.ts --broadcast
npm run sync:contracts
npm run verify:onchain
```

The runner checkpoints receipts, deployed addresses and a pending transaction under ignored contracts/artifacts-for-integration/isolated-deployment.json. Restarting resumes confirmed steps and checks the saved pending hash first. It publishes the integration manifest only after every stock, vault, inventory and liquidity transaction succeeds. A timeout is not permission to replay an unknown transaction.

The stack uses a long testnet oracle heartbeat, fixed reference prices and zero borrow interest for repeatable testnet validation. These are deliberate prototype settings; they are not live equity feeds or production lending rates.

For an independent signed smoke test:

```bash
npx tsx scripts/smoke-testnet.ts
```

The first run prints the independent tester address; fund its gas balance, then rerun. It claims test pUSDC and tests all eight equities and both strategies with real receipts. Run only with a fresh tester: it sends transactions and is not resumable after partial completion. Receipts are saved to docs/qa/live-lifecycle.json after success.

Local validation uses a separate signer, progress file and manifest, and never replaces live addresses:

```bash
anvil --port 8547 --chain-id 420420777 --silent
npx tsx scripts/deploy-testnet.ts --local --broadcast
npx tsx scripts/smoke-testnet.ts --local
```

## Talisman

Talisman is sufficient when it exposes an Ethereum/EVM account (`0x…`) to the browser. Connect that account through Privy on the Vercel origin, switch to chain 420420777, and hold native tPOT for transaction gas/storage. The app faucet supplies pUSDC, not gas. Use a separate user wallet from the deployment administrator. Vercel must have APP_ID_PRIVY and its origin allowed in the Privy dashboard. Do not place either signing key in Vercel.
