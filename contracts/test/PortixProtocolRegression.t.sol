// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/PortixProtocol.sol";

contract MockUSDC is IERC20M {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract PortixProtocolRegressionTest is Test {
    PortixProtocol protocol;
    MockUSDC usdc;
    address mockUSDCAddress = 0x9Df05e926a3860a3CcaFFa85bb0776c47a9238F4;

    address alice = address(0xAA11);
    address bob = address(0xBB22);
    address eve = address(0xEE33); // Unrelated attacker

    address stockAAPL = 0xE9907AA2Aad877f0e80dCBCCc3617f3d2F16f0fd;
    address stockGOOGL = 0xCd8D785Ab352389555F43552e265D3E29972C3aA;

    function setUp() public {
        usdc = new MockUSDC();
        vm.etch(mockUSDCAddress, address(usdc).code);

        protocol = new PortixProtocol();

        // Seed protocol with 100,000 pUSDC for trade and yield payouts
        MockUSDC(mockUSDCAddress).mint(address(protocol), 100_000 * 1e6);

        // Fund Alice and Bob with pUSDC
        MockUSDC(mockUSDCAddress).mint(alice, 10_000 * 1e6);
        MockUSDC(mockUSDCAddress).mint(bob, 10_000 * 1e6);

        // Alice buys AAPL
        vm.startPrank(alice);
        MockUSDC(mockUSDCAddress).approve(address(protocol), type(uint256).max);
        protocol.buyStockWithExactUSDC(stockAAPL, 1000 * 1e6);
        vm.stopPrank();

        // Bob buys GOOGL
        vm.startPrank(bob);
        MockUSDC(mockUSDCAddress).approve(address(protocol), type(uint256).max);
        protocol.buyStockWithExactUSDC(stockGOOGL, 1000 * 1e6);
        vm.stopPrank();
    }

    // --- Regression Test 1: Unauthorized Withdrawals Must Revert ---
    function test_UnauthorizedWithdrawalReverts() public {
        // Alice deposits AAPL into pxPrime (strategy 0)
        vm.startPrank(alice);
        uint256 aliceBal = protocol.stockBalance(stockAAPL, alice);
        uint256 shares = protocol.depositAndInvest(stockAAPL, protocol.STRATEGY_PRIME(), aliceBal, alice);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), shares);

        // Eve (unrelated attacker) attempts to withdraw Alice's shares to Eve without allowance
        uint8 prime = protocol.STRATEGY_PRIME();
        vm.startPrank(eve);
        vm.expectRevert("Unauthorized: caller has insufficient allowance");
        protocol.withdrawWithYield(stockAAPL, prime, shares, eve, alice);

        // Legacy 3-arg overload must also revert
        vm.expectRevert("Unauthorized: caller has insufficient allowance");
        protocol.withdrawWithYield(shares, eve, alice);
        vm.stopPrank();

        // Alice's position remains completely untouched
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), shares);
        assertEq(protocol.stockBalance(stockAAPL, eve), 0);
    }

    // --- Regression Test 2: Authorized Withdrawal With Allowance Succeeds ---
    function test_AuthorizedWithdrawalWithAllowanceSucceeds() public {
        vm.startPrank(alice);
        uint256 aliceBal = protocol.stockBalance(stockAAPL, alice);
        uint256 shares = protocol.depositAndInvest(stockAAPL, protocol.STRATEGY_PRIME(), aliceBal, alice);

        // Alice approves Bob to manage half of her shares
        protocol.approveStock(stockAAPL, bob, shares / 2);
        vm.stopPrank();

        // Bob withdraws authorized amount to Alice
        vm.startPrank(bob);
        (uint256 returned, ) = protocol.withdrawWithYield(
            stockAAPL,
            protocol.STRATEGY_PRIME(),
            shares / 2,
            alice,
            alice
        );
        vm.stopPrank();

        assertGt(returned, 0);
        assertEq(protocol.stockAllowance(stockAAPL, alice, bob), 0); // Allowance spent
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), shares - shares / 2);
    }

    // --- Regression Test 3: Asset & Strategy Isolation ---
    function test_AssetAndStrategyIsolation() public {
        vm.startPrank(alice);
        uint256 aliceBal = protocol.stockBalance(stockAAPL, alice);
        uint256 shares = protocol.depositAndInvest(stockAAPL, protocol.STRATEGY_PRIME(), aliceBal, alice);
        vm.stopPrank();

        // Verify AAPL pxPrime has shares
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), shares);

        // Verify AAPL pxBoost has 0 shares (strategy isolation)
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_BOOST(), alice), 0);

        // Verify GOOGL pxPrime has 0 shares for Alice (asset isolation)
        assertEq(protocol.getVaultShares(stockGOOGL, protocol.STRATEGY_PRIME(), alice), 0);
        assertEq(protocol.stockBalance(stockGOOGL, alice), 0);

        // Bob deposits GOOGL into pxBoost (strategy 1)
        vm.startPrank(bob);
        uint256 bobBal = protocol.stockBalance(stockGOOGL, bob);
        uint256 bobShares = protocol.depositAndInvest(stockGOOGL, protocol.STRATEGY_BOOST(), bobBal, bob);
        vm.stopPrank();

        // Verify Bob's GOOGL pxBoost is isolated from pxPrime and AAPL
        assertEq(protocol.getVaultShares(stockGOOGL, protocol.STRATEGY_BOOST(), bob), bobShares);
        assertEq(protocol.getVaultShares(stockGOOGL, protocol.STRATEGY_PRIME(), bob), 0);
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_BOOST(), bob), 0);
    }

    // --- Regression Test 4: Insufficient Liquidity Reverts Atomically ---
    function test_InsufficientLiquidityRevertsAtomically() public {
        // Drain protocol's pUSDC to 0
        uint256 protocolUSDC = MockUSDC(mockUSDCAddress).balanceOf(address(protocol));
        vm.prank(address(protocol));
        MockUSDC(mockUSDCAddress).transfer(address(0xdead), protocolUSDC);
        assertEq(MockUSDC(mockUSDCAddress).balanceOf(address(protocol)), 0);

        // Alice attempts to sell stock when protocol has no pUSDC liquidity
        vm.startPrank(alice);
        uint256 aliceAAPL = protocol.stockBalance(stockAAPL, alice);
        assertGt(aliceAAPL, 0);

        vm.expectRevert("Insufficient settlement liquidity for payout");
        protocol.sellStock(stockAAPL, aliceAAPL);

        // Alice's stock was NOT deducted or burned
        assertEq(protocol.stockBalance(stockAAPL, alice), aliceAAPL);
        vm.stopPrank();
    }

    // --- Regression Test 5: Full Deposit and Withdraw Lifecycle with Yield ---
    function test_FullDepositAndWithdrawFlow() public {
        vm.startPrank(alice);
        uint256 initialStock = protocol.stockBalance(stockAAPL, alice);
        uint256 shares = protocol.depositAndInvest(stockAAPL, protocol.STRATEGY_PRIME(), initialStock, alice);

        // Alice stock balance is now 0 (locked as collateral)
        assertEq(protocol.stockBalance(stockAAPL, alice), 0);
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), shares);

        // Advance time by 30 days
        vm.warp(block.timestamp + 30 days);

        uint256 initialUSDC = MockUSDC(mockUSDCAddress).balanceOf(alice);

        // Alice withdraws position
        (uint256 stockReturned, uint256 netYieldUSD) = protocol.withdrawWithYield(
            stockAAPL,
            protocol.STRATEGY_PRIME(),
            shares,
            alice,
            alice
        );

        // 100% principal stock returned
        assertEq(stockReturned, initialStock);
        assertEq(protocol.stockBalance(stockAAPL, alice), initialStock);

        // Accrued yield paid in pUSDC
        assertGt(netYieldUSD, 0);
        assertEq(MockUSDC(mockUSDCAddress).balanceOf(alice), initialUSDC + netYieldUSD);

        // Vault shares burned
        assertEq(protocol.getVaultShares(stockAAPL, protocol.STRATEGY_PRIME(), alice), 0);
        vm.stopPrank();
    }

    // --- Regression Test 6: Dynamic Vault Metrics & Oracle Pricing ---
    function test_VaultMetricsAndOraclePricing() public {
        uint256 priceBefore = protocol.getPriceUSD(stockAAPL);
        assertEq(priceBefore, 331_900_000); // $331.90

        // Owner updates oracle price
        protocol.setPrice(stockAAPL, 350_000_000); // $350.00
        assertEq(protocol.getPriceUSD(stockAAPL), 350_000_000);

        // Alice deposits 1 AAPL
        vm.startPrank(alice);
        protocol.depositAndInvest(stockAAPL, protocol.STRATEGY_PRIME(), 1 ether, alice);
        vm.stopPrank();

        (uint256 totalCollateral, uint256 totalDebt, , , uint256 ltvBps, bool healthy) =
            protocol.getVaultMetrics(stockAAPL, protocol.STRATEGY_PRIME());

        assertEq(totalCollateral, 1 ether);
        assertEq(totalDebt, (350 * 1e6 * 4000) / 10000); // 40% of $350 = $140
        assertEq(ltvBps, 4000); // 40%
        assertTrue(healthy);
    }
    function test_PartialWithdrawalsReturnEveryCollateralWei() public {
        vm.startPrank(alice);
        uint256 initialStock = protocol.stockBalance(stockAAPL, alice);
        uint256 shares = protocol.depositAndInvest(stockAAPL, 0, initialStock, alice);
        protocol.withdrawWithYield(stockAAPL, 0, 1, alice, alice);
        protocol.withdrawWithYield(stockAAPL, 0, shares - 1, alice, alice);
        assertEq(protocol.stockBalance(stockAAPL, alice), initialStock);
        assertEq(protocol.getVaultCollateral(stockAAPL, 0, alice), 0);
        assertEq(protocol.totalStockCollateral(stockAAPL, 0), 0);
        vm.stopPrank();
    }

    function test_TopUpCannotEraseAccruedYield() public {
        vm.startPrank(alice);
        protocol.depositAndInvest(stockAAPL, 0, 1 ether, alice);
        vm.warp(block.timestamp + 30 days);
        uint256 earned = protocol.getAccruedYield(stockAAPL, 0, alice);
        protocol.depositAndInvest(stockAAPL, 0, 1, alice);
        assertGe(protocol.getAccruedYield(stockAAPL, 0, alice), earned);
        vm.stopPrank();
    }
}
