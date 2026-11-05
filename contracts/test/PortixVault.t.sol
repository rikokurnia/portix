// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/market/StockMarket.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/oracle/PortixPriceOracle.sol";
import "../src/lending/PortixDebtPool.sol";
import "../src/strategies/MockLendingStrategyAdapter.sol";
import "../src/strategies/MockAmmStrategyAdapter.sol";
import "../src/vaults/PortixVault.sol";

contract PortixVaultTest is Test {
    MockPUSDC public pUSDC;
    PortixPriceOracle public oracle;
    PortixDebtPool public debtPool;
    MockStockToken public aapl;

    MockLendingStrategyAdapter public lendingStrategy;
    PortixVault public primeVault;

    MockAmmStrategyAdapter public ammStrategy;
    PortixVault public boostVault;

    address public owner = address(0xABCD);
    address public alice = address(0x1111);
    address public bob = address(0x2222);
    address public sponsor = address(0x3333);

    uint256 public constant AAPL_PRICE = 200 * 1e6; // $200.00 (6 decimals)

    function setUp() public {
        vm.startPrank(owner);

        pUSDC = new MockPUSDC(owner);
        oracle = new PortixPriceOracle(owner, 3600);
        debtPool = new PortixDebtPool(address(pUSDC), 0, owner); // 0% borrow rate in basic test for clean math

        aapl = new MockStockToken("Apple Inc.", "AAPL", owner);
        oracle.configureToken(address(aapl), 50 * 1e6, 500 * 1e6);
        oracle.setPrice(address(aapl), AAPL_PRICE);

        // 1. Prime Vault Setup (Lending Strategy)
        lendingStrategy = new MockLendingStrategyAdapter(address(pUSDC), owner);
        primeVault = new PortixVault(
            address(aapl),
            address(pUSDC),
            address(oracle),
            address(debtPool),
            address(lendingStrategy),
            4000, // 40% target LTV
            8000, // 80% liquidation LTV
            IPortixVault.StrategyKind.PRIME_LENDING,
            "PORTIX Prime AAPL Vault",
            "pxP-AAPL",
            owner
        );
        lendingStrategy.setVault(address(primeVault));
        debtPool.setVaultAuthorized(address(primeVault), true);

        // 2. Boost Vault Setup (AMM Strategy)
        ammStrategy = new MockAmmStrategyAdapter(address(pUSDC), owner);
        boostVault = new PortixVault(
            address(aapl),
            address(pUSDC),
            address(oracle),
            address(debtPool),
            address(ammStrategy),
            4000,
            8000,
            IPortixVault.StrategyKind.BOOST_AMM,
            "PORTIX Boost AAPL Vault",
            "pxB-AAPL",
            owner
        );
        ammStrategy.setVault(address(boostVault));
        debtPool.setVaultAuthorized(address(boostVault), true);

        // Seed debt pool with $1M pUSDC
        pUSDC.mint(address(debtPool), 1_000_000 * 1e6);

        // Seed sponsor with pUSDC for honest mock yield funding
        pUSDC.mint(sponsor, 100_000 * 1e6);

        vm.stopPrank();

        // Seed Alice and Bob with AAPL tokens
        aapl.faucet(alice, 100 * 1e18);
        aapl.faucet(bob, 100 * 1e18);

        vm.prank(alice);
        aapl.approve(address(primeVault), type(uint256).max);
        vm.prank(alice);
        aapl.approve(address(boostVault), type(uint256).max);

        vm.prank(bob);
        aapl.approve(address(primeVault), type(uint256).max);

        vm.prank(sponsor);
        pUSDC.approve(address(lendingStrategy), type(uint256).max);
    }

    function test_DepositAndInvestBasic() public {
        vm.startPrank(alice);
        // Deposit 10 AAPL (10 * $200 = $2,000 collateral)
        // 40% target LTV = $800 pUSDC auto-borrowed
        uint256 depositAmt = 10 * 1e18;
        (uint256 shares, uint256 borrowedUSD) = primeVault.depositAndInvest(depositAmt, alice);

        assertEq(shares, depositAmt); // 1:1 shares at initial deposit
        assertEq(borrowedUSD, 800 * 1e6); // $800 pUSDC

        // Check custody & balances
        assertEq(aapl.balanceOf(address(primeVault)), depositAmt);
        assertEq(primeVault.totalAssets(), depositAmt);
        assertEq(debtPool.getVaultDebt(address(primeVault)), 800 * 1e6);
        assertEq(lendingStrategy.totalAssets(), 800 * 1e6);

        // Check metrics
        (
            uint256 totalStock,
            uint256 totalDebt,
            uint256 strategyAssets,
            uint256 netYield,
            uint256 ltvBps,
            bool isHealthy
        ) = primeVault.getVaultMetrics();

        assertEq(totalStock, depositAmt);
        assertEq(totalDebt, 800 * 1e6);
        assertEq(strategyAssets, 800 * 1e6);
        assertEq(netYield, 0); // At inception, yield is 0
        assertEq(ltvBps, 4000); // Exactly 40.00%
        assertTrue(isHealthy);

        vm.stopPrank();
    }

    function test_WithdrawalWithYieldGain() public {
        // Alice deposits 10 AAPL -> $800 borrowed
        vm.prank(alice);
        (uint256 shares, ) = primeVault.depositAndInvest(10 * 1e18, alice);

        // Sponsor honestly funds $80 of real yield into lending strategy (10% return)
        vm.prank(sponsor);
        lendingStrategy.fundYield(80 * 1e6);
        assertEq(lendingStrategy.totalAssets(), 880 * 1e6);

        // Alice withdraws full shares
        uint256 aliceUSDCBefore = pUSDC.balanceOf(alice);
        uint256 aliceAAPLBefore = aapl.balanceOf(alice);

        vm.prank(alice);
        (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaidUSD) =
            primeVault.withdrawWithYield(shares, alice, alice);

        // Verification:
        // 1. Full stock collateral returned
        assertEq(stockReturned, 10 * 1e18);
        assertEq(aapl.balanceOf(alice), aliceAAPLBefore + 10 * 1e18);

        // 2. Debt of $800 was fully repaid to debt pool
        assertEq(debtRepaidUSD, 800 * 1e6);
        assertEq(debtPool.getVaultDebt(address(primeVault)), 0);

        // 3. Net yield of $80 pUSDC delivered to Alice!
        assertEq(netYieldUSD, 80 * 1e6);
        assertEq(pUSDC.balanceOf(alice), aliceUSDCBefore + 80 * 1e6);

        // Vault is clean
        assertEq(primeVault.totalSupply(), 0);
        assertEq(primeVault.totalAssets(), 0);
    }

    function test_WithdrawalWithStrategyLoss() public {
        // Alice deposits 10 AAPL -> $800 borrowed
        vm.prank(alice);
        (uint256 shares, ) = primeVault.depositAndInvest(10 * 1e18, alice);

        // Simulate a strategy loss of $200 (strategy dropped from $800 to $600)
        address sink = address(0xDEAD);
        vm.prank(owner);
        lendingStrategy.simulateLoss(sink, 200 * 1e6);
        assertEq(lendingStrategy.totalAssets(), 600 * 1e6);

        // At withdrawal:
        // Debt is $800, but strategy only returns $600.
        // Deficit = $200.
        // Stock price is $200/share, so $200 deficit = 1 AAPL (1e18).
        // Alice should receive 10 - 1 = 9 AAPL and 0 net yield.
        uint256 aliceAAPLBefore = aapl.balanceOf(alice);
        uint256 aliceUSDCBefore = pUSDC.balanceOf(alice);

        vm.prank(alice);
        (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaidUSD) =
            primeVault.withdrawWithYield(shares, alice, alice);

        assertEq(stockReturned, 9 * 1e18);
        assertEq(aapl.balanceOf(alice), aliceAAPLBefore + 9 * 1e18);
        assertEq(netYieldUSD, 0);
        assertEq(debtRepaidUSD, 600 * 1e6);
        assertEq(pUSDC.balanceOf(alice), aliceUSDCBefore);
    }

    function test_PartialWithdrawalAndMultipleDepositors() public {
        // Alice deposits 10 AAPL
        vm.prank(alice);
        (uint256 aliceShares, ) = primeVault.depositAndInvest(10 * 1e18, alice);

        // Bob deposits 10 AAPL
        vm.prank(bob);
        primeVault.depositAndInvest(10 * 1e18, bob);

        // Total 20 AAPL collateral, $1600 total debt, $1600 strategy assets
        assertEq(primeVault.totalAssets(), 20 * 1e18);
        assertEq(primeVault.totalSupply(), 20 * 1e18);

        // Alice withdraws 50% of her shares (5 shares)
        vm.prank(alice);
        (uint256 stockReturned, , uint256 debtRepaid) =
            primeVault.withdrawWithYield(aliceShares / 2, alice, alice);

        assertEq(stockReturned, 5 * 1e18);
        assertEq(debtRepaid, 400 * 1e6);

        // Remaining vault state: 15 AAPL collateral, $1200 debt
        assertEq(primeVault.totalAssets(), 15 * 1e18);
        assertEq(debtPool.getVaultDebt(address(primeVault)), 1200 * 1e6);
    }

    function test_CollateralPriceShockAndDeleverage() public {
        // Alice deposits 10 AAPL ($2000 value, $800 debt -> 40% LTV)
        vm.prank(alice);
        primeVault.depositAndInvest(10 * 1e18, alice);

        // Stock price crashes by 50% to $100
        vm.prank(owner);
        oracle.setPrice(address(aapl), 100 * 1e6);

        // Collateral value is now 10 * $100 = $1,000
        // Debt is $800 -> Current LTV is 800 / 1000 = 80.00% (at liquidation threshold!)
        (, , , , uint256 ltvBps, bool isHealthy) = primeVault.getVaultMetrics();
        assertEq(ltvBps, 8000);
        assertTrue(isHealthy); // 8000 <= 8000 is still boundary healthy

        // Price drops slightly further to $95
        vm.prank(owner);
        oracle.setPrice(address(aapl), 95 * 1e6);
        (, , , , uint256 badLtv, bool isNowUnhealthy) = primeVault.getVaultMetrics();
        assertGt(badLtv, 8000);
        assertFalse(isNowUnhealthy);

        // Deleverage: Unwind $400 from strategy to repay debt
        primeVault.deleverage(400 * 1e6);

        // New debt is $400 -> LTV drops significantly
        (, uint256 newDebt, , , uint256 restoredLtv, bool restoredHealth) = primeVault.getVaultMetrics();
        assertEq(newDebt, 400 * 1e6);
        assertLt(restoredLtv, 5000);
        assertTrue(restoredHealth);
    }

    function test_RevertWhen_StaleOraclePrice() public {
        vm.warp(block.timestamp + 3601); // 1 hour 1 second
        vm.startPrank(alice);
        vm.expectRevert();
        primeVault.depositAndInvest(10 * 1e18, alice);
        vm.stopPrank();
    }

    function test_RevertWhen_InsufficientDebtPoolLiquidity() public {
        // Drain debt pool so it cannot fulfill 40% borrow
        vm.prank(owner);
        debtPool.withdrawLiquidity(owner, 999_999 * 1e6);

        vm.startPrank(alice);
        vm.expectRevert();
        primeVault.depositAndInvest(10 * 1e18, alice);
        vm.stopPrank();
    }

    function test_PreviewDepositAndWithdrawQuotes() public {
        // Check preview deposit quote for 5 AAPL
        (uint256 sharesExp, uint256 colUSD, uint256 borrowUSD) =
            primeVault.previewDepositCarry(5 * 1e18);
        assertEq(sharesExp, 5 * 1e18);
        assertEq(colUSD, 1000 * 1e6); // 5 * $200 = $1,000
        assertEq(borrowUSD, 400 * 1e6); // 40% of $1,000 = $400

        // Alice executes deposit
        vm.prank(alice);
        primeVault.depositAndInvest(5 * 1e18, alice);

        // Check preview withdraw quote
        (
            uint256 stockRet,
            uint256 debtShare,
            uint256 stratShare,
            uint256 estYield,
            uint256 stockDeduct
        ) = primeVault.previewWithdrawCarry(5 * 1e18);

        assertEq(stockRet, 5 * 1e18);
        assertEq(debtShare, 400 * 1e6);
        assertEq(stratShare, 400 * 1e6);
        assertEq(estYield, 0);
        assertEq(stockDeduct, 0);
    }

    function test_BoostAmmVaultFlow() public {
        // Deposit into Boost AMM Vault
        vm.prank(alice);
        (uint256 shares, uint256 borrowUSD) = boostVault.depositAndInvest(10 * 1e18, alice);

        assertEq(shares, 10 * 1e18);
        assertEq(borrowUSD, 800 * 1e6);
        assertEq(ammStrategy.totalAssets(), 800 * 1e6);

        // AMM earns trading fees (funded by sponsor)
        vm.prank(owner);
        pUSDC.mint(sponsor, 100 * 1e6);
        vm.prank(sponsor);
        pUSDC.approve(address(ammStrategy), 100 * 1e6);
        vm.prank(sponsor);
        ammStrategy.fundYield(100 * 1e6);

        // Withdraw from Boost AMM Vault
        uint256 aliceUSDCBefore = pUSDC.balanceOf(alice);
        vm.prank(alice);
        (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaid) =
            boostVault.withdrawWithYield(shares, alice, alice);

        assertEq(stockReturned, 10 * 1e18);
        assertEq(debtRepaid, 800 * 1e6);
        assertEq(netYieldUSD, 100 * 1e6);
        assertEq(pUSDC.balanceOf(alice), aliceUSDCBefore + 100 * 1e6);
    }
    function test_FaucetBuyBothVaultsWithdrawAndSell() public {
        address user = address(0x4444);
        vm.startPrank(owner);
        StockMarket market = new StockMarket(address(pUSDC), address(oracle), 10, owner);
        market.setStockSupported(address(aapl), true);
        aapl.mint(address(market), 100 ether);
        pUSDC.mint(address(market), 10_000e6);
        vm.stopPrank();
        vm.startPrank(user);
        pUSDC.faucet(user, 5_000e6);
        assertEq(pUSDC.balanceOf(user), 5_000e6);
        pUSDC.approve(address(market), 1_000e6);
        uint256 bought = market.buyStockWithExactUSDC(address(aapl), 1_000e6);
        assertEq(pUSDC.balanceOf(user), 4_000e6);
        assertEq(aapl.balanceOf(user), bought);
        aapl.approve(address(primeVault), bought / 2);
        aapl.approve(address(boostVault), bought - bought / 2);
        (uint256 primeShares, ) = primeVault.depositAndInvest(bought / 2, user);
        (uint256 boostShares, ) = boostVault.depositAndInvest(bought - bought / 2, user);
        assertEq(aapl.balanceOf(user), 0);
        assertGt(lendingStrategy.totalAssets(), 0);
        assertGt(ammStrategy.totalAssets(), 0);
        vm.stopPrank();
        vm.startPrank(owner);
        pUSDC.mint(owner, 20e6);
        pUSDC.approve(address(lendingStrategy), 10e6);
        lendingStrategy.fundYield(10e6);
        pUSDC.approve(address(ammStrategy), 10e6);
        ammStrategy.fundYield(10e6);
        vm.stopPrank();
        vm.startPrank(user);
        primeVault.withdrawWithYield(primeShares, user, user);
        boostVault.withdrawWithYield(boostShares, user, user);
        assertEq(aapl.balanceOf(user), bought);
        assertEq(primeVault.balanceOf(user), 0);
        assertEq(boostVault.balanceOf(user), 0);
        assertEq(pUSDC.balanceOf(user), 4_020e6);
        aapl.approve(address(market), bought);
        (, , uint256 expectedPayout) = market.quoteSell(address(aapl), bought);
        market.sellStock(address(aapl), bought);
        assertEq(aapl.balanceOf(user), 0);
        assertEq(pUSDC.balanceOf(user), 4_020e6 + expectedPayout);
        vm.stopPrank();
    }
}
