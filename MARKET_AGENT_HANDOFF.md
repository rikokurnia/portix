# Prompt for the Market owner

Work only on the Market UI/API files you own. Preserve your current uncommitted work. Agent 1 has not changed Market files in this pass and has not added Portfolio to Market.

Restore/verify your real equity quotes and OHLC provider independently of PORTIX's execution oracle. The current execution oracle returns a hardcoded $300 for every address; it is not a stock-market history provider. Do not use it as the public market chart feed. Keep UI and design unchanged.

Connected account state/actions remain in `src/lib/portfolio-store.ts`; never create a separate account or fabricate balances/hashes. Faucet uses the separate live pUSDC token and connected wallet signatures.

Important contract differences: the updated manifest maps every stock and both vault strategies to ONE PortixProtocol at 0xb5f071B9e9b159C5Df573678400aB864d0Ec5415. Its balanceOf(owner) is one undifferentiated stock balance. Reading it eight times must not display eight independent holdings. Receipt shares are internal vaultShares(owner), with no getter; balanceOf is not vault shares. previewWithdrawCarry returns FOUR values, not five. Buying exact pUSDC uses spend - floor(spend/1000), unlike the earlier divide-by-10010 calculation. Execution previews must use the deployed ABI and exact contract arithmetic, separate from external market display quotes.

Before enabling complete trading/accounting, coordinate a corrected typed contract handoff with Agent 3: per-stock balances/identifiers, distinct strategy accounting, public share getter, real position metrics, and safe withdrawals. See CONTRACT_INTEGRATION_FINDINGS.md. Shared account reads intentionally avoid duplicating the aliased balance across eight stocks/sixteen vaults.

Validate your API, real chart data, buy/sell quotes, button flows and transaction Activity. Do not alter wallet configuration, shared global styles, Vault UI or shared state without coordination.
