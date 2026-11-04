# Portix QA — 2026-11-04

Status: **DONE_WITH_CONCERNS for local testing; live end-to-end acceptance BLOCKED**.

Scope: `random/PRD_PORTIX.md`, frontend, faucet, buys/sells, both carry strategies, withdrawals, accounting, RPC policy, deployment compatibility. Browser: gstack Chromium, localhost:3000, desktop and 375px mobile. The PRD includes TSLA; the implementation instead supports eight assets (AAPL, GOOGL, NFLX, MSFT, META, SPY, QQQ, NVDA). TSLA is not implemented.

## Validation

| Check | Result |
|---|---|
| Frontend tests (`npm test`) | PASS, five test files |
| TypeScript | PASS |
| ESLint | PASS |
| Production build | PASS |
| Secret-value scan | PASS: 0 findings, values not printed |
| Foundry | PASS: 44 tests, including 256 fuzz cases |
| Full lifecycle, isolated contracts | PASS: faucet, buy, deposit both vaults, physically funded yield, withdraw, sell; balance and payout assertions |
| Live chain | Chain 420420777 reachable; pUSDC bytecode/decimals/faucet simulation pass |
| Live deployment acceptance | FAIL: 28 manifest entries alias the legacy protocol, incompatible with frontend ERC-20/ERC-4626 accounting |
| New signed live transactions | NOT RUN: corrected compatible deployment not available; browser is unauthenticated |

Detailed contract output: [contracts-test-output.txt](contracts-test-output.txt). Live verification: [../onchain-verification.json](../onchain-verification.json), [live-audit.json](live-audit.json).

## Bugs reproduced and fixed

1. **Critical — fake trading success and balances.** Active BuyModal/SellModal offered demo pUSDC/stocks and mutated local balances without a wallet or receipt. They now use the existing TradeModal and its simulate → wallet confirmation → receipt → Activity pipeline. Signed-out controls stay disabled; demo funds and synthetic success paths were removed. Evidence: [buy-disabled.png](screenshots/buy-disabled.png).
2. **High — chart prices overwrote settlement prices.** `useStockHistory` wrote Yahoo/fixture prices into the shared on-chain oracle state every four seconds. Removed that write. Only the chain reader supplies trading prices.
3. **High — buys could execute against aliased assets.** Only vault writes were guarded. Market quotes and all non-faucet executor writes now reject the incompatible deployment; faucet remains independent. Chain reader does not publish the common legacy price as eight independent equity valuations.
4. **High — deposits erased existing yield.** PortixProtocol reset a position timestamp without preserving accrued yield. Reproduced with 30-day accrual followed by a one-wei deposit: yield dropped from 1,309,413 to 66,380 micro-pUSDC. Added stored yield checkpointing before debt changes and proportional accounting on withdrawal. Regression now passes.
5. **Medium — split withdrawals stranded collateral.** `shares / 3` rounded independently on each withdrawal. Redeeming one share then the remainder stranded one collateral wei. Redemptions now use remaining collateral proportionally; final redemption clears it. Regression now passes.
6. **High — invented market data labeled live.** API and hook generated fallback candles, added artificial price movement, and concealed upstream failures. Removed generated fallback data and ticks; missing data returns unavailable/empty. Chart labels identify an external equity benchmark. Added actual handler tests with failed upstream fetch, cached response, and unknown ticker.
7. **Medium — misleading deployment verification.** Repeated reads on aliased contracts could report VERIFIED even while compatibility failed. Verifier now explicitly labels the aliased entries INCOMPATIBLE and exits nonzero.

## Browser evidence and limits

Visited landing, Vault overview, Market, and pxPrime detail with GOOGL selected. Exercised navigation, Buy input with signed-out disabled submit, faucet login prompt, and Deposit/Withdraw tabs. Inspected mobile vault layout, benchmark chart and empty account controls: [vault-mobile.png](screenshots/vault-mobile.png). No authenticated wallet signature or successful frontend transaction is claimed.

Initial console logs contained upstream RPC 502 errors and repeated unused logo-preload warnings. Builds and API outage regressions pass; external RPC availability is not guaranteed. This is focused financial-flow QA, not an exhaustive accessibility/performance audit. No numerical health score is asserted for untested categories.

## Live-chain findings

At verification block 319558, pUSDC passed read-only checks and all 28 remaining manifest entries were incompatible. A separate audit found 2,476 runtime bytes at the protocol address and no working `getVaultShares(address,uint8,address)` getter. Existing deployment, buy, deposit, withdrawal and sell receipts all have success status; hashes/blocks are recorded in live-audit.json. These are historical legacy-protocol receipts, not new tests of corrected contracts.

The local corrected PortixProtocol exposes per-stock/per-strategy accounting, but the frontend expects separate ERC-20 stock contracts and ERC-4626 vault instances. Merely deploying the unified contract and copying its address into every manifest slot cannot resolve this. Deploy and seed the isolated stack, publish compatible stock/vault addresses, then rerun verification and the signed browser lifecycle.

Both strategy adapters are testnet mocks, with physically funded pUSDC yield; real Morpho/Aave/Compound/Uniswap routing and bridge settlement are not implemented. Unified PortixProtocol uses modeled debt/yield rather than external deployment. PRD cross-chain execution cannot be accepted as working.

The user-referenced report was located at `/home/cokoo/.gemini/antigravity-cli/brain/ce984aeb-e14d-4d49-b546-e559fbbf5328/PORTIX_DEPLOYMENT_AND_VERIFICATION_REPORT.md`. It lists the exact same legacy protocol address, 2,476-byte runtime and historical receipts already audited. It does not publish a corrected deployment. Its assertion that eight equities and sixteen strategies are fully supported is not established by those receipts: the deployed contract lacks the per-position getter and the frontend cannot read isolated stock/share balances. Its common $300 quote is not eight independent equity prices. Report faucet and approval receipts were also added to the read-only audit.

## Contract patch preservation

`contracts/` is ignored by this frontend repository. Source fixes and regression tests exist locally and their reviewable diff is preserved in [contract-fixes.patch](contract-fixes.patch), so the work is not lost when the frontend changes are reviewed. No signing keys or environment files are included. Contract source edits do not modify already deployed immutable bytecode.

## Remaining acceptance work

1. Replace the legacy deployment identified in the referenced report with a corrected compatible deployment.
2. Supply compatible deployed isolated stock/vault contracts and seeded test liquidity (or explicitly implement a reviewed adapter for a corrected unified protocol).
3. In an authenticated test wallet, sign faucet, buy, both vault deposits, partial/full withdrawal and sell; verify each new receipt and final portfolio against chain balances.
4. Implement TSLA and real external protocol/bridge routing if those original PRD requirements remain in scope.

## Deployment follow-up

The replacement isolated stack was deployed with signed transactions on local Anvil, then an independent wallet completed 113 signed lifecycle transactions covering all eight stocks and sixteen vaults. See [local receipts](local-lifecycle.json), [deployment log](local-deployment-output.txt), and [runbook](DEPLOYMENT_RUNBOOK.md). This validates the deployment tool and contract flows locally; live Portaldot deployment awaits funding of the fresh deployment wallet. Unsigned live RPC estimates are in [deployment-budget.json](deployment-budget.json).

## Existing-deployment mode and wallet correction

At the user’s request the replacement deployment was cancelled. `/testnet` now provides explicit legacy single-stock/single-vault actions against the existing address, with real approvals, simulated calls, receipts and refreshed balances. It does not claim eight independent assets or two independent strategies. Users acknowledge the legacy withdrawal authorization and payout limitations before vault/trade actions. The existing multi-equity routes stay blocked. The adapter pins the exact runtime hash before reading private shares from verified mapping slot 2 or writing. A signed local fork test passed faucet → buy → deposit → withdraw → sell, including actual pUSDC payout: [legacy-fork-proof.json](legacy-fork-proof.json). No live testnet gas was spent.

Privy requires an EVM `0x` account; a Substrate `5…` signer cannot log in to this integration. Talisman users can create/select an Ethereum account, or use an email-created embedded EVM wallet. The testnet page shows the selected EVM wallet’s corresponding SS58 funding destination (H160 plus twelve EE bytes, prefix 42); verified against the published deployer pair and live Substrate account storage. It is a funding destination, not a converted signer.

The EVM RPC represents native balances with 18 decimals although Substrate storage uses 14. Earlier deployment totals were overstated by 10,000×. The EVM chain definition, estimation script and budget documentation now use the correct EVM scale. A regression test covers the known address pair, invalid-address rejection, and EVM decimals.
