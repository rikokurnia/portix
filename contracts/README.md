# PORTIX Smart Contracts Engine

PORTIX is a tokenized stock carry yield protocol deployed on **Portaldot Network V3.0** (EVM via `pallet-revive`).

This directory contains the self-contained smart contract codebase, Foundry testing suite, deployment scripts, and frontend integration handoff documentation.

---

## 1. Architecture Overview

- **Isolated Vaults per Stock & Strategy**: Standard ERC-4626 mandates one underlying ERC-20 asset per vault. PORTIX instantiates 10 isolated vaults across 5 supported equities (`AAPL`, `GOOGL`, `NFLX`, `MSFT`, `META`) and 2 strategy families:
  - **`pxPrime`**: Lending carry strategy (Morpho Blue / Aave V3 / Compound V3 benchmark).
  - **`pxBoost`**: AMM LP fee strategy (Uniswap V3 benchmark).
- **1-Click Auto-Borrow**: Depositing tokenized stock locks collateral, auto-borrows `pUSDC` at a conservative **40% initial target LTV**, and deploys liquidity to the designated strategy adapter in a single atomic transaction.
- **Proportional Unwind & Net Yield**: Withdrawals unwind strategy liquidity, discharge outstanding debt to `PortixDebtPool`, return 100% principal stock, and pay accumulated net carry yield in `pUSDC`.
- **Honest Prototype Accounting**: Mock adapters (`MockLendingStrategyAdapter`, `MockAmmStrategyAdapter`) strictly tie `totalAssets()` to real `pUSDC` balances. Yield is physically funded, never artificially inflated or minted from thin air.

---

## 2. Directory Structure

```
project/contracts/
├── ARCHITECTURE.md                          # Comprehensive architecture decision record
├── foundry.toml                             # Foundry configuration (Solc 0.8.28, Cancun, via-ir)
├── .env.example                             # Environment variable template with placeholders
├── src/
│   ├── interfaces/                          # Protocol interfaces (IPortixVault, IPortixPriceOracle, etc.)
│   ├── tokens/                              # MockStockToken (18 decimals) & MockPUSDC (6 decimals)
│   ├── oracle/                              # PortixPriceOracle with heartbeat & circuit-breaker bounds
│   ├── market/                              # StockMarket (spot trading with fee accounting)
│   ├── lending/                             # PortixDebtPool (pUSDC borrow credit facility)
│   ├── strategies/                          # MockLendingStrategyAdapter & MockAmmStrategyAdapter
│   └── vaults/                              # PortixVault (ERC-4626 carry vault) & PortixVaultFactory
├── test/
│   ├── StockMarket.t.sol                    # Spot buy/sell tests across all 5 equities
│   ├── PortixPriceOracle.t.sol              # Freshness heartbeat and bound check tests
│   ├── PortixDebtPool.t.sol                 # Borrow, interest accrual, and repayment tests
│   ├── PortixVault.t.sol                    # 1-Click carry deposit, gain, loss, and deleveraging tests
│   ├── PortixVaultFactory.t.sol             # Factory deployment and registry lookup tests
│   └── AccountingInvariant.t.sol            # Fuzz tests (256 runs) & donation attack resistance
├── script/
│   ├── PreflightCheck.s.sol                 # Pre-deployment validation (Chain ID, RPC, balance)
│   └── DeployPortix.s.sol                   # Unbroadcast deployment and liquidity seeding script
└── artifacts-for-integration/               # Integration handoff artifacts for Agents 1 & 2
    ├── abis/                                # Clean ABI JSON files
    ├── address-manifest.template.json       # Empty deployment address template
    ├── INTEGRATION_HANDOFF.md               # Master handoff index
    ├── CONTRACT_INTERFACES.md               # Typed TypeScript interfaces
    ├── UNIT_CONVERSIONS.md                  # Decimals and unit conversion math
    ├── APPROVAL_FLOWS.md                    # Matrix of required ERC-20 approvals
    ├── TRANSACTION_SEQUENCES.md             # End-to-end execution sequences
    ├── PREVIEW_QUOTES.md                    # Real-time quote hooks
    ├── ERROR_MAPPINGS.md                    # Custom Solidity error mappings
    ├── VAULT_MAPPING.md                     # Stock & strategy mapping matrix
    ├── MOCK_AND_ADAPTER_ROADMAP.md          # Prototype honesty & production migration plan
    └── PORTALDOT_V3_READINESS.md            # Live RPC verification and technical details
```

---

## 3. Local Development & Testing

```bash
# Navigate to contracts directory
cd project/contracts

# Run all test suites
forge test

# Run tests with detailed traces
forge test -vvv

# Run invariant & fuzz tests
forge test --match-contract AccountingInvariantTest
```

### Test Results
- **Total Test Suites**: 6
- **Total Tests**: 31 passed, 0 failed, 0 skipped.
- **Coverage**: Full coverage of spot market trades (5 stocks), carry deposits, auto-borrowing at 40% LTV, strategy gain settlement, strategy loss recovery from collateral, price shocks (50% drop), deleveraging, stale oracle handling, and donation attack resistance.

---

## 4. Preflight & Deployment Dry-Run

```bash
# Run preflight verification
forge script script/PreflightCheck.s.sol

# Run deployment simulation (dry-run without broadcast)
forge script script/DeployPortix.s.sol
```
