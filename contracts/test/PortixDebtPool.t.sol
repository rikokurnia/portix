// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/lending/PortixDebtPool.sol";

contract PortixDebtPoolTest is Test {
    MockPUSDC public pUSDC;
    PortixDebtPool public debtPool;

    address public owner = address(0xABCD);
    address public mockVault = address(0xCAFE);
    address public randomUser = address(0x9999);

    function setUp() public {
        vm.startPrank(owner);
        pUSDC = new MockPUSDC(owner);
        // 200 bps = 2.0% annual interest
        debtPool = new PortixDebtPool(address(pUSDC), 200, owner);
        debtPool.setVaultAuthorized(mockVault, true);

        // Fund debt pool with 500k pUSDC
        pUSDC.mint(address(debtPool), 500_000 * 1e6);
        vm.stopPrank();
    }

    function test_BorrowAndRepayBasic() public {
        vm.startPrank(mockVault);
        uint256 borrowAmt = 10_000 * 1e6;
        debtPool.borrow(borrowAmt);

        assertEq(pUSDC.balanceOf(mockVault), borrowAmt);
        assertEq(debtPool.getVaultDebt(mockVault), borrowAmt);
        assertEq(debtPool.totalDebt(), borrowAmt);

        // Repay full
        pUSDC.approve(address(debtPool), borrowAmt);
        debtPool.repay(borrowAmt);

        assertEq(debtPool.getVaultDebt(mockVault), 0);
        assertEq(debtPool.totalDebt(), 0);
        vm.stopPrank();
    }

    function test_InterestAccrualOverTime() public {
        vm.startPrank(mockVault);
        uint256 borrowAmt = 100_000 * 1e6; // $100k
        debtPool.borrow(borrowAmt);
        vm.stopPrank();

        // Warp 1 full year (31536000 seconds)
        vm.warp(block.timestamp + 31536000);

        // At 2.0% APY, $100k generates ~$2,000 in interest
        uint256 debtWithInterest = debtPool.getVaultDebt(mockVault);
        assertGt(debtWithInterest, borrowAmt);
        assertApproxEqAbs(debtWithInterest, 102_000 * 1e6, 10 * 1e6); // within $10 tolerance

        // Settle interest
        debtPool.accrueInterest();
        assertApproxEqAbs(debtPool.totalDebt(), 102_000 * 1e6, 10 * 1e6);
    }

    function test_RevertWhen_UnauthorizedBorrower() public {
        vm.prank(randomUser);
        vm.expectRevert(
            abi.encodeWithSelector(IPortixDebtPool.UnauthorizedBorrower.selector, randomUser)
        );
        debtPool.borrow(1000 * 1e6);
    }

    function test_RevertWhen_InsufficientLiquidity() public {
        vm.startPrank(mockVault);
        // Pool only has 500k pUSDC
        vm.expectRevert(
            abi.encodeWithSelector(
                IPortixDebtPool.InsufficientDebtPoolLiquidity.selector,
                600_000 * 1e6,
                500_000 * 1e6
            )
        );
        debtPool.borrow(600_000 * 1e6);
        vm.stopPrank();
    }

    function test_SupplyAndWithdrawLiquidity() public {
        address lp = address(0x5555);
        pUSDC.faucet(lp, 20_000 * 1e6);

        vm.startPrank(lp);
        pUSDC.approve(address(debtPool), 20_000 * 1e6);
        debtPool.supplyLiquidity(20_000 * 1e6);
        vm.stopPrank();

        assertEq(debtPool.availableLiquidity(), 520_000 * 1e6);

        // Owner withdraws
        vm.prank(owner);
        debtPool.withdrawLiquidity(owner, 20_000 * 1e6);
        assertEq(debtPool.availableLiquidity(), 500_000 * 1e6);
        assertEq(pUSDC.balanceOf(owner), 20_000 * 1e6);
    }
}
