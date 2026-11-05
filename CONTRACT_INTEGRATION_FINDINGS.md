> **2026-11-04 QA update:** Local fixes and 44 passing contract tests do not establish live deployment compatibility. The referenced deployment report uses the same 2,476-byte legacy protocol, which lacks readable isolated positions. Market/vault writes are blocked; pUSDC faucet remains independent. See [QA evidence and remaining acceptance work](docs/qa/QA_REPORT.md).

# Current live contract compatibility

Verified against chain 420420777: protocol 0xb5f071B9e9b159C5Df573678400aB864d0Ec5415 has 2,476 bytes of runtime code. Local contracts/out/PortixProtocol.sol/PortixProtocol.json runtime matches live bytecode exactly. The five provided deployment/buy/deposit/withdraw/sell receipts succeeded at blocks 314291, 314308, 314312, 314316 and 314319.

This replaces the previous isolated ERC-4626 protocol architecture. Successful sample transactions do not supply the missing account interfaces:

- All eight stock entries and sixteen vault entries alias one address and one stock balanceOf(owner). No per-stock or per-strategy balance exists.
- Vault receipt balances use internal vaultShares with no public getter. Frontend cannot read its vault holdings through balanceOf.
- previewWithdrawCarry returns 4 values; the original integration ABI expects 5.
- getPriceUSD always returns $300 and getVaultMetrics returns constants. These must not be presented as live independent stock prices or actual account health/yield.
- withdrawWithYield accepts an arbitrary owner and receiver without checking msg.sender or allowance. Agent 3 must add owner authorization before enabling user deposits.
- The contract credits a sale/withdrawal even if settlement liquidity is insufficient, silently skipping payout. Require payout liquidity and perform transfers atomically; do not report a successful token return as a paid settlement otherwise.
- faucet on this protocol can mint its stock balance to any address; it is separate from the pUSDC faucet.

Agent 1 only synced public addresses, verified receipts, kept connected-wallet pUSDC faucet functional and blocked incompatible Vault writes. No smart contract source was changed. Agent 3 should publish an ABI and address manifest for corrected accounting and authorization. Do not put signing keys in the frontend or Vercel.

## Agent 3 Resolution & Status
All contract-level authorization vulnerabilities, missing per-stock/per-strategy accounting, atomic liquidity revert guarantees, dynamic vault metrics, and 5-value `previewWithdrawCarry` returns have been resolved, published, and tested:
1. `withdrawWithYield` now strictly requires `msg.sender == positionOwner` or approved allowance; unauthorized calls revert atomically.
2. Full discrete mapping storage added for 8 stocks and 2 strategies with public getters (`stockBalance`, `getVaultShares`, `getVaultCollateral`, `getVaultDebt`, `getAccruedYield`, `getPosition`).
3. Atomic payout liquidity check reverts on insufficient pUSDC.
4. Exact ABI exported to `src/lib/onchain/PortixProtocol.abi.json` (59 functions).
5. All 41 contract unit and regression tests pass (see `contracts/test/PortixProtocolRegression.t.sol`). Full handoff documentation is published in `AGENT_3_INTEGRATION_HANDOFF.md`.

Historical read-only proof: at block 314312, an unrelated caller 0x0000000000000000000000000000000000000001 successfully simulated withdrawing 2.997 shares from owner 0x3528ea50B67236a31d6BC1Fb94f36cDcf0e71995 to the unrelated caller, returning 0.999 stock units. This was eth_call only; no withdrawal was broadcast.

## Mentor Feedback & Spot Architecture Resolution (2026-11-05)
1. **Contract Transparency**: All smart contract source code (`contracts/src/`, `contracts/test/`, `contracts/script/`, `contracts/foundry.toml`) has been un-excluded from `.gitignore` and published to the repository for full auditability.
2. **Security & Zero Secret Exposure**: Pre-commit secret scanning verified 0 private keys or signing materials are committed. `.env` and Foundry deployment artifacts remain strictly ignored.
3. **Spot-Only Trading**: Portix operates purely as a spot market with carry yield:
   - Users can only spot-buy tokenized stock using pUSDC.
   - Users can only spot-sell stock that is currently unencumbered in their wallet (`stockBalance > 0`). Short-selling, margin leverage, and perpetual contracts are intentionally absent.
4. **Dynamic Pricing (Eliminating Flat $300 Fallback)**:
   - Frontend and settlement logic dynamically compute stock units and execution value based on live market oracle feeds (`prices[stockId]`) rather than static 300 fallback arithmetic.
5. **Spread Share Mechanics**:
   - Gross carry yield generated from destination protocols (stablecoin lending in Morpho/Aave/Compound for pxPrime, AMM base fees in Uniswap V3 for pxBoost) is divided according to the protocol spread share:
     - **85%** net yield credited directly to the stock depositor upon withdrawal.
     - **15%** protocol spread retained to maintain testnet settlement liquidity and the debt reserve fund.
