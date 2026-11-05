# Screenshot-driven vault and market fixes

No contract was deployed and no live transaction was broadcast for this pass.

| Request | Result |
|---|---|
| History stock value | Added pUSDC value below stock amounts. New buys/sells use settlement Transfer/StockBought logs for actual pUSDC spent/received; older buys can use their saved spend. Estimated valuations are marked approximate. |
| Explorer native value | Intentionally remains zero for token-only contract calls. pUSDC payment is an ERC-20 transfer encoded in calldata/events, not native tPOT value. The app displays token spend in history and purchase confirmation. |
| Immediate earned yield | Removed the contract's fixed withdrawal bonus from earned yield and portfolio asset totals. Display now uses an explicitly labeled gross benchmark projection on the 40% borrowed allocation, elapsed confirmed-deposit time, and latest available strategy APY. Starts at zero; unavailable APY is not invented. This is not a claimable balance. |
| Live chart/form price | Chart updates publish benchmark prices used by the live-equity display and portfolio valuations. Execution quotes separately use prices read from the deployed contract and expose the testnet settlement price. Removed baseline fixture prices from settlement calculations. |
| Wallet/vault balances | Reconcile confirmed deposit/withdrawal quantities against authoritative shared stock/share totals. Withdrawals restore returned stock, not the number of shares burned. Separate strategy labels follow confirmed activity. Native writes wait for EVM read indexing before refreshing. |
| Withdrawal error | Reproduced live: the five-output ABI fails to decode the deployed four-output preview. Quote and write paths now use the exact ABI for the legacy address. Check payout liquidity before withdrawal. |
| Dollar-based forms and share units | Deposit and withdrawal input is pUSDC-equivalent value with the USDC icon, underlying stock balance, exact Max, and raw receipt amounts shown underneath. These inputs convert to actual stock/share quantities. Existing receipt units are not changed or falsely relabeled as $1 tokens. |
| USDC/WETH label | Explicitly identifies Uniswap V3 as exchange, USDC/WETH as pair and 0.05% as pool fee. |
| Volume under TVL | Boost fetches actual 24h volume for Ethereum Uniswap V3 pool 0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640 through GeckoTerminal, validates pool identity, refreshes every 60s, and shows volume / displayed benchmark TVL. Lending swap volume is Not applicable. Missing data displays unavailable, not fake zero. |

## Verification

- All nine test files passed, including new coverage for USD/raw-token conversion, precision, completed-only accounting, both strategies, deposit/withdraw balance transfers, zero-at-deposit yield, unavailable APY, actual receipt spend, and pool-volume calculations.
- Regression fixture proves that the old five-output preview fails and the exact four-output ABI succeeds.
- The live RPC preview returned four values for 1.71703 raw receipt shares.
- A local replica loaded both exact deployed runtimes, seeded liquidity only locally, and passed faucet → buy → deposit → half withdrawal → remaining withdrawal → sell. Evidence: `vault-runtime-regression.json`. No live gas spent.
- TypeScript, ESLint and production build passed.
- Browser checked production pages, pUSDC denomination, stock-balance help text and live pool volume. The temporary QA wallet provider had signing disabled; no real browser signature is claimed.

## Existing deployment constraints

The chain still uses its fixed $300 settlement price and three raw shares per stock. A frontend feed cannot update those immutable rules. pUSDC-denominated values are presentation units; raw share units remain contract-defined. The protocol still has shared asset/strategy balances and weak withdrawal authorization. Labels follow confirmed history in this browser, not independently isolated on-chain tokens. Real Morpho/Aave/Compound/Uniswap execution and yield settlement are not connected by this UI work.
