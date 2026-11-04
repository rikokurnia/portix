# PORTIX frontend integration

## Implemented

- Landing updates, Vault 7D area charts and DefiLlama protocol feeds retained.
- Empty account state on first load. No fixture balances, stock prices, synthetic candles, fixed share conversions or generated transaction hashes.
- One wallet selection for navbar, faucet, Market and Vault. Switching wallets resets balances and loads wallet-scoped Activity.
- pUSDC faucet calls the deployed public `faucet(address,uint256)` from the connected wallet for exactly 5,000 pUSDC. It requires tPOT for gas. No deployer key or privileged server signer is used.
- Market reads the oracle and deployed fee. Buy uses `buyStockWithExactUSDC`; sell uses `quoteSell` / `sellStock`. Token allowances are exact, not unlimited.
- Vault uses `previewDepositCarry`, `previewWithdrawCarry`, `depositAndInvest`, `withdrawWithYield`. Stock/share decimals are 18; settlement/prices use 6. Max withdrawal retains the exact share input rather than rounding away dust.
- Simulate before each write, wait for the actual receipt, distinguish pending/reverted/confirmed, and persist real transaction links in Activity. Pending receipts are recovered on reconnect; actions are never automatically replayed.
- A portal dialog lets Privy's confirmations appear above trade/faucet forms. Escape, Tab wrap and focus restoration are implemented.
- Public read-only RPC proxy addresses upstream CORS. It rejects signing/broadcasting methods, arbitrary endpoints and batches. Signing/broadcasting stays in the user's wallet provider.
- Stock candles aggregate actual oracle `PriceUpdated` events. No interpolated history or invented volume. Missing observations/prices render as unavailable. The bounded event window should move to an indexer as usage grows.

## Deployment verification

Run `npm run sync:contracts` after Agent 3 updates `contracts/artifacts-for-integration/address-manifest.json`. It exports only public, allowlisted fields into `src/lib/onchain/addresses.json`. ABI JSON files are public interfaces copied from the integration handoff; Solidity scripts, broadcast artifacts and environment files remain excluded.

Run `npm run verify:onchain` for a fresh RPC check. It exits nonzero if any published contract is absent or its checked interface fails, and writes `docs/onchain-verification.json`.

The checked manifest contains 29 addresses: pUSDC passed bytecode, decimals and read-only faucet simulation checks. The other 28 addresses returned no bytecode on chain 420420777. Thus Market/Vault writes cannot pass their previews yet. A successful frontend build or Foundry unit tests do not verify deployment. Agent 3 must deploy these contracts, seed liquidity and publish real addresses before faucet → stock buy → vault deposit can complete.

No end-to-end Talisman signature was fabricated. The user's own authenticated wallet is needed for the final signed flow.

## Vercel

- Root directory: `project` if importing the enclosing workspace; use repository root when this Git repository is imported directly.
- Framework: Next.js. Node: 22.x. Build: `npm run build`; install from the committed lockfile.
- Required environment variable: `APP_ID_PRIVY` (public application ID), set for Production and the Preview environments used. Redeploy after configuring it.
- Privy dashboard: enable wallet login, allow the exact Vercel/custom-domain origins and configure embedded Ethereum wallets as desired. Talisman must expose its EVM account, not only a Substrate address.
- No other API key is required for the current RPC/DefiLlama integrations.
- Do **not** configure `DEPLOYER_PRIVATE_KEY`, `PRIVATE_KEY`, mnemonic/seed phrases or `APP_SECRET_PRIVY` in Vercel. None is used by this application. Never prefix signing material with `NEXT_PUBLIC_`.
- Contract addresses and the public RPC are source configuration; old `NEXT_PUBLIC_PUSDC_ADDRESS`, `PORTALDOT_V3_RPC_URL` and `PORTALDOT_V3_CHAIN_ID` local variables are not consumed by the new integration.

## Secret handling

`.env*` (except empty examples), `contracts/`, keys, keystores and local build metadata are ignored. `.vercelignore` additionally excludes contracts and env files. `npm run check:secrets` compares local secret values against tracked source and build files without printing values. Gitleaks scans the Git history and staged patch before push.

If a credential was published in another repository or previous history, deleting a file does not revoke it: rotate the credential/move funds to a new signer. This integration does not rewrite Git history or reuse the deployer signer.

## Shared interface

`usePortfolio()` from `src/lib/portfolio-store.ts` exposes live state plus async `buyStock`, `sellStock`, `depositToVault`, `withdrawFromVault`, `claimFaucet`. Results are `{ok:true,hash}` only after a successful receipt, or `{ok:false,error}`. Display values are numbers; sell/deposit/withdraw accept decimal strings to preserve all token decimals. `rawStockBalances` and position `rawShares` support exact Max.

`PortfolioSync` is mounted once inside Privy. It owns reads, signer registration and receipt reconciliation. Other features must consume this store rather than crediting balances locally. Activity is wallet/chain scoped browser persistence, not an on-chain indexer; actions taken elsewhere are reflected in balances but are not automatically imported into Activity.
