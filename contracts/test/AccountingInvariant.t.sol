// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/oracle/PortixPriceOracle.sol";
import "../src/lending/PortixDebtPool.sol";
import "../src/strategies/MockLendingStrategyAdapter.sol";
import "../src/vaults/PortixVault.sol";

contract AccountingInvariantTest is Test {
    MockPUSDC public pUSDC;
    PortixPriceOracle public oracle;
    PortixDebtPool public debtPool;
    MockStockToken public stock;
    MockLendingStrategyAdapter public strategy;
    PortixVault public vault;

    address public owner = address(0xABCD);
    address public user = address(0x9999);

    function setUp() public {
        vm.startPrank(owner);
        pUSDC = new MockPUSDC(owner);
        oracle = new PortixPriceOracle(owner, 3600);
        debtPool = new PortixDebtPool(address(pUSDC), 0, owner);
        stock = new MockStockToken("Apple Inc.", "AAPL", owner);

        oracle.configureToken(address(stock), 1 * 1e6, 10_000 * 1e6);
        oracle.setPrice(address(stock), 200 * 1e6); // $200.00

        strategy = new MockLendingStrategyAdapter(address(pUSDC), owner);
        vault = new PortixVault(
            address(stock),
            address(pUSDC),
            address(oracle),
            address(debtPool),
            address(strategy),
            4000,
            8000,
            IPortixVault.StrategyKind.PRIME_LENDING,
            "Prime Vault",
            "pxP-AAPL",
            owner
        );
        strategy.setVault(address(vault));
        debtPool.setVaultAuthorized(address(vault), true);

        // Seed debt pool with $50M pUSDC to support large fuzz ranges
        pUSDC.mint(address(debtPool), 50_000_000 * 1e6);
        vm.stopPrank();

        stock.faucet(user, 1_000 * 1e18);
        vm.prank(user);
        stock.approve(address(vault), type(uint256).max);
    }

    /// @notice Invariant: Solvency & custody must hold for any valid deposit amount
    function testFuzz_DepositAndWithdrawParSolvency(uint256 depositAmt) public {
        // Bound between 0.01 AAPL and 500 AAPL
        depositAmt = bound(depositAmt, 1e16, 500 * 1e18);

        vm.startPrank(user);
        (uint256 shares, uint256 borrowUSD) = vault.depositAndInvest(depositAmt, user);

        // Invariant 1: Physical custody matches tracked assets
        assertEq(stock.balanceOf(address(vault)), depositAmt);
        assertEq(vault.totalAssets(), depositAmt);

        // Invariant 2: Borrow amount matches exact 40% math
        uint256 expectedBorrow = (depositAmt * 200 * 1e6 * 4000) / (1e18 * 10000);
        assertEq(borrowUSD, expectedBorrow);

        // Invariant 3: Full withdrawal returns 100% principal and extinguishes debt
        (uint256 stockReturned, , uint256 debtRepaid) =
            vault.withdrawWithYield(shares, user, user);

        assertEq(stockReturned, depositAmt);
        assertEq(debtRepaid, expectedBorrow);
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(debtPool.getVaultDebt(address(vault)), 0);

        vm.stopPrank();
    }

    /// @notice Invariant: First depositor donation attack resistance
    function test_FirstDepositorDonationResistance() public {
        address attacker = address(0xBEEF);
        stock.faucet(attacker, 100 * 1e18);

        // Attacker deposits tiny amount (1 wei of stock)
        vm.startPrank(attacker);
        stock.approve(address(vault), type(uint256).max);
        vault.deposit(1, attacker);

        // Attacker transfers 10 AAPL directly to vault as a donation
        stock.transfer(address(vault), 10 * 1e18);
        vm.stopPrank();

        // Victim deposits 1 AAPL
        vm.startPrank(user);
        uint256 victimShares = vault.deposit(1e18, user);

        // Because totalAssets() uses internal tracked collateral (_trackedStockCollateral),
        // the direct transfer donation did NOT dilute victim's shares to 0!
        assertGt(victimShares, 0);
        vm.stopPrank();
    }
}
