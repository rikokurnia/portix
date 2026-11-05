// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/oracle/PortixPriceOracle.sol";

contract PortixPriceOracleTest is Test {
    PortixPriceOracle public oracle;
    MockStockToken public aapl;
    address public owner = address(0xABCD);
    address public user = address(0x1234);

    function setUp() public {
        vm.startPrank(owner);
        oracle = new PortixPriceOracle(owner, 3600); // 1 hour heartbeat
        aapl = new MockStockToken("Apple Inc.", "AAPL", owner);
        oracle.configureToken(address(aapl), 50 * 1e6, 500 * 1e6); // $50 to $500 bounds
        oracle.setPrice(address(aapl), 200 * 1e6); // $200.00
        vm.stopPrank();
    }

    function test_FreshPriceReporting() public view {
        uint256 price = oracle.getPriceUSD(address(aapl));
        assertEq(price, 200 * 1e6);

        (uint256 rawPrice, uint8 decimals, uint256 updatedAt) = oracle.getPrice(address(aapl));
        assertEq(rawPrice, 200 * 1e6);
        assertEq(decimals, 6);
        assertEq(updatedAt, block.timestamp);
    }

    function test_RevertWhen_PriceStale() public {
        // Warp past 1 hour heartbeat (3601 seconds)
        vm.warp(block.timestamp + 3601);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPortixPriceOracle.OraclePriceStale.selector,
                address(aapl),
                1,
                3600
            )
        );
        oracle.getPriceUSD(address(aapl));
    }

    function test_PriceUpdateRefreshesStaleness() public {
        vm.warp(block.timestamp + 3601);
        // Stale now
        vm.expectRevert();
        oracle.getPriceUSD(address(aapl));

        // Owner updates price -> refreshed!
        vm.prank(owner);
        oracle.setPrice(address(aapl), 205 * 1e6);
        assertEq(oracle.getPriceUSD(address(aapl)), 205 * 1e6);
    }

    function test_RevertWhen_OutOfBounds() public {
        vm.startPrank(owner);
        // Exceeds max $500
        vm.expectRevert(
            abi.encodeWithSelector(
                IPortixPriceOracle.OraclePriceOutOfBounds.selector,
                address(aapl),
                600 * 1e6,
                50 * 1e6,
                500 * 1e6
            )
        );
        oracle.setPrice(address(aapl), 600 * 1e6);

        // Below min $50
        vm.expectRevert(
            abi.encodeWithSelector(
                IPortixPriceOracle.OraclePriceOutOfBounds.selector,
                address(aapl),
                20 * 1e6,
                50 * 1e6,
                500 * 1e6
            )
        );
        oracle.setPrice(address(aapl), 20 * 1e6);
        vm.stopPrank();
    }

    function test_RevertWhen_ZeroPrice() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IPortixPriceOracle.OraclePriceZero.selector, address(aapl))
        );
        oracle.setPrice(address(aapl), 0);
    }

    function test_RevertWhen_UnauthorizedCaller() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setPrice(address(aapl), 210 * 1e6);
    }

    function test_PauseOracle() public {
        vm.prank(owner);
        oracle.pause();

        vm.expectRevert();
        oracle.getPriceUSD(address(aapl));

        vm.prank(owner);
        oracle.unpause();
        assertEq(oracle.getPriceUSD(address(aapl)), 200 * 1e6);
    }
}
