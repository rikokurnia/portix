# PORTIX Smart Contract Architecture Decision Document

## 1. Executive Summary & Architecture Decisions

This document details the architectural decisions for the PORTIX tokenized equity carry yield protocol on Portaldot Network V3.0 (EVM via `pallet-revive`).

### High-Level Summary of Design Decisions
1. **Isolated Vaults per Stock and Strategy**: Standard ERC-4626 mandates a single underlying ERC-20 asset per vault. Rather than pooling five volatile equities into one contaminated pool, we deploy 10 isolated vault instances (5 stocks × 2 strategies: `pxPrime` and `pxBoost`), organized by a `PortixVaultFactory`. The frontend groups these under the `pxPrime` and `pxBoost` interfaces.
2. **Dual-Asset Return Model**: Depositors lock stock tokens as collateral and receive vault shares. On withdrawal, users receive their principal stock tokens back plus their net accumulated carry yield paid out in settlement asset `pUSDC`.
3. **Explicit Debt Pool & Strategy Adapters**: No fake or silently manufactured yields. Borrowed `pUSDC` originates from a dedicated `PortixDebtPool`, is allocated to verified strategy adapters (`MockLendingStrategyAdapter` and `MockAmmStrategyAdapter` in local environments), and must be repaid before yield is distributed.
4. **Target 40% LTV with Dynamic Risk Controls**: Initial borrowing targets 40% LTV. Health factors, oracle freshness checks (heartbeat < 3600s), min/max price bounds, and an 80% liquidation threshold safeguard the protocol from bad debt.

---

## 2. Multi-Stock Collateral Accounting

### The Multi-Asset Problem in ERC-4626
The ERC-4626 specification specifies:
```solidity
function asset() external view returns (address);
```
`asset()` returns a single ERC-20 address representing the asset depositors provide and receive upon redemption. If 5 distinct stocks (`AAPL`, `GOOGL`, `NFLX`, `MSFT`, `META`) were deposited into a single pooled ERC-4626 vault:
- Depositing 1 AAPL ($200) vs 1 MSFT ($420) would create fractional cross-asset claims.
- Any price crash in one stock (e.g. Netflix dropping 35%) would socialize losses across Apple and Microsoft depositors.
- Arbitrageurs could deposit depreciated equities and redeem higher-value equities, causing bank runs and insolvency.

### The Isolated Vault Pattern
We implement isolated vault instances:
- **Prime Vaults (Lending Carry)**:
  - `pxPrime-AAPL` (Underlying: AAPL)
  - `pxPrime-GOOGL` (Underlying: GOOGL)
  - `pxPrime-NFLX` (Underlying: NFLX)
  - `pxPrime-MSFT` (Underlying: MSFT)
  - `pxPrime-META` (Underlying: META)
- **Boost Vaults (AMM Fee Yield)**:
  - `pxBoost-AAPL` (Underlying: AAPL)
  - `pxBoost-GOOGL` (Underlying: GOOGL)
  - `pxBoost-NFLX` (Underlying: NFLX)
  - `pxBoost-MSFT` (Underlying: MSFT)
  - `pxBoost-META` (Underlying: META)

### Frontend Coordination
The frontend displays two master strategy cards:
- **pxPrime** (Low Risk, Stable Lending Yield: Morpho / Aave / Compound reference)
- **pxBoost** (Moderate Risk, DEX Fee Yield: Uniswap V3 reference)

When the user selects a stock token in the UI modal, the frontend routes the transaction to the corresponding isolated vault instance.

---

## 3. Share Denomination and Valuation

### Token Decimals Standard
| Token / Unit | Decimals | Description |
|---|---|---|
| Stock Tokens (`AAPL`, `GOOGL`, `NFLX`, `MSFT`, `META`) | 18 | ERC-20 tokenized equity |
| Settlement Token (`pUSDC`) | 6 | Standard USDC testnet token |
| Vault Shares (`pxP-*`, `pxB-*`) | 18 | Proportional claim on stock collateral & yield |
| Oracle Price | 6 | USD price per 1 full stock token (1e18 units) |

### Valuation Math
1. **Collateral Valuation**:
   Given stock amount $A_{\text{stock}}$ (in $10^{18}$):
   $$V_{\text{USD}} = \frac{A_{\text{stock}} \times P_{\text{stock}}}{10^{18}} \quad (\text{decimals: 6})$$

2. **Share Issuance**:
   Standard OpenZeppelin ERC-4626 math with virtual offset protection against first-depositor inflation attacks:
   $$\text{shares} = \frac{A_{\text{stock}} \times (\text{totalSupply} + 10^3)}{\text{totalAssets} + 1}$$
   At inception, 1 full stock unit (1e18) mints 1 full vault share (1e18).

3. **PRD Discrepancy Note**:
   The PRD references static share values like "$100 pxPrime / $125 pxBoost". In our architecture, shares strictly denominate underlying stock equity (1:1 collateral entitlement), not static fiat amounts. Fixing share prices to a static fiat value when underlying equities fluctuate would introduce toxic arbitrage and mispricing.

---

## 4. Debt and Interest Accounting

### Target Borrowing
- Target LTV: $40\%$ (`4000` bps).
- Borrowed amount for deposit $A_{\text{stock}}$:
  $$D_{\text{new}} = \frac{V_{\text{USD}} \times 4000}{10000} = \frac{A_{\text{stock}} \times P_{\text{stock}} \times 4000}{10^{18} \times 10000}$$

### Debt Pool Credit Facility (`PortixDebtPool`)
- The vault does NOT print unbacked pUSDC.
- It borrows pUSDC from `PortixDebtPool` where liquidity is deposited by test liquidity providers or protocol seed reserves.
- If the Debt Pool lacks sufficient liquidity, the transaction reverts with `InsufficientDebtPoolLiquidity`.
- Interest accrues per second based on an annualized borrow rate (e.g. 2.0% APY):
  $$\text{AccruedInterest} = \frac{\text{Principal} \times \text{RateBps} \times \Delta t}{10000 \times 31536000}$$

---

## 5. Strategy Accounting

### Strategy Adapters (`IPortixStrategyAdapter`)
- Each vault delegates its borrowed `pUSDC` to a dedicated Strategy Adapter:
  - **Prime Strategy**: Deploys pUSDC into lending money markets (Morpho, Aave, Compound).
  - **Boost Strategy**: Deploys pUSDC into AMM liquidity pools (Uniswap V3 LP).
- Strategy adapters implement:
  ```solidity
  function deposit(uint256 amount) external;
  function withdraw(uint256 amount) external returns (uint256 received);
  function totalAssets() external view returns (uint256);
  ```

### Realized vs Unrealized Carry Yield
- Total strategy assets $S_{\text{assets}}$ are denominated in 6-decimal `pUSDC`.
- Current vault debt $D_{\text{total}}$ is denominated in 6-decimal `pUSDC`.
- Net Carry Yield = $\max\left(0, S_{\text{assets}} - D_{\text{total}}\right)$.
- If $S_{\text{assets}} < D_{\text{total}}$, the strategy is running at an unrealized loss.

---

## 6. Withdrawal and Unwind Mechanics

When a user requests to redeem $S_{\text{burn}}$ shares:
1. **Fractional Ownership**:
   $$f = \frac{S_{\text{burn}}}{\text{totalSupply}}$$
2. **Stock Return**:
   $$A_{\text{user}} = f \times \text{totalStockCollateral}$$
3. **Debt Share**:
   $$D_{\text{user}} = f \times \text{totalVaultDebt}$$
4. **Strategy Unwind**:
   $$U_{\text{target}} = f \times \text{strategyAssets}$$
   The vault executes `strategy.withdraw(U_target)` receiving $U_{\text{actual}}$ pUSDC.
5. **Debt Repayment Priority**:
   - The vault transfers $D_{\text{user}}$ (or $\min(D_{\text{user}}, U_{\text{actual}})$) to `PortixDebtPool` to discharge the debt.
6. **Net Yield Distribution / Loss Allocation**:
   - **Gain / Par ($U_{\text{actual}} \ge D_{\text{user}}$)**:
     - User receives full stock collateral $A_{\text{user}}$.
     - User receives net yield $Y = U_{\text{actual}} - D_{\text{user}}$ in `pUSDC`.
   - **Loss ($U_{\text{actual}} < D_{\text{user}}$)**:
     - Deficit = $D_{\text{user}} - U_{\text{actual}}$.
     - To ensure the debt pool is made whole, the deficit is covered by deducting stock collateral at current oracle price:
       $$A_{\text{deduct}} = \frac{\text{Deficit} \times 10^{18}}{P_{\text{stock}}}$$
     - User receives $A_{\text{user}} - A_{\text{deduct}}$.
     - If $A_{\text{deduct}} > A_{\text{user}}$, the vault reverts with `InsufficientCollateralForDebt`.

---

## 7. Oracle Assumptions and Liquidation Behavior

### Oracle Requirements (`IPortixPriceOracle`)
- Returns `(uint256 price, uint8 decimals, uint256 updatedAt)`.
- **Freshness Check**: Heartbeat $\le 3600$ seconds. Older prices revert with `StaleOraclePrice`.
- **Sanity Bounds**: $P_{\text{min}} \le P \le P_{\text{max}}$. Prevents zero-price and extreme anomalies.

### LTV Bounds and Deleveraging
- **Target LTV**: $40\%$ (4000 bps)
- **Warning Threshold**: $70\%$ (7000 bps)
- **Liquidation / Deleveraging Threshold**: $80\%$ (8000 bps)
- If stock price declines such that $\text{LTV} > 80\%$:
  - The position becomes unhealthy.
  - Collateral-only withdrawals are blocked to prevent bad debt.
  - Anyone can call `deleverage()`: the vault unwinds strategy liquidity to repay debt, restoring the vault to the target LTV.

---

## 8. Local Prototype Honesty & Disclaimers

1. **Mock Stock Tokens**: Tokenized equities (`AAPL`, `GOOGL`, `NFLX`, `MSFT`, `META`) are mock testnet ERC-20 tokens deployed solely for prototyping and development on Portaldot V3. They do **NOT** represent legally backed securities or broker-dealer custodial obligations.
2. **Mock Strategy Adapters**: `MockLendingStrategyAdapter` and `MockAmmStrategyAdapter` do **NOT** manufacture fake yield out of thin air. Yield is only accrued through explicit funding from test reserves or deterministic test harness calls.
3. **No Fake Cross-Chain Bridge**: The prototype operates entirely on Portaldot V3 EVM without pretending cross-chain relayer settlement has completed. External protocol references (Morpho, Aave, Compound, Uniswap V3) serve as architectural models for future deployment.
