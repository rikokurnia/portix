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

contract PortixProtocolTest is Test {
    PortixProtocol protocol;
    address mockUSDC;
    address user = address(0x123);

    function setUp() public {
        protocol = new PortixProtocol();
        // Point protocol's pUSDC to mockUSDC code at pUSDC address using vm.etch
        mockUSDC = 0x9Df05e926a3860a3CcaFFa85bb0776c47a9238F4;
        MockUSDC implementation = new MockUSDC();
        vm.etch(mockUSDC, address(implementation).code);
    }

    function testBasicViews() public view {
        assertEq(protocol.feeBps(), 10);
        assertEq(protocol.getPriceUSD(address(protocol)), 300 * 1e6);
        assertEq(protocol.asset(), address(protocol));
        assertEq(protocol.settlementAsset(), mockUSDC);
        assertEq(protocol.decimals(), 18);
    }

    function testQuotes() public view {
        (uint256 gross, uint256 fee, uint256 total) = protocol.quoteBuy(address(protocol), 1 ether);
        assertEq(gross, 300 * 1e6);
        assertEq(fee, (300 * 1e6) / 1000);
        assertEq(total, gross + fee);

        (uint256 sGross, uint256 sFee, uint256 sNet) = protocol.quoteSell(address(protocol), 1 ether);
        assertEq(sGross, 300 * 1e6);
        assertEq(sFee, (300 * 1e6) / 1000);
        assertEq(sNet, sGross - sFee);
    }

    function testBuyWithExactUSDC() public {
        MockUSDC(mockUSDC).mint(user, 1000 * 1e6);
        vm.startPrank(user);
        MockUSDC(mockUSDC).approve(address(protocol), 300 * 1e6);
        uint256 stockBought = protocol.buyStockWithExactUSDC(address(protocol), 300 * 1e6);
        assertGt(stockBought, 0);
        assertEq(protocol.balanceOf(user), stockBought);
        vm.stopPrank();
    }

    function testDepositAndWithdraw() public {
        testBuyWithExactUSDC();
        vm.startPrank(user);
        uint256 stockBal = protocol.balanceOf(user);
        uint256 shares = protocol.depositAndInvest(stockBal, user);
        assertEq(protocol.balanceOf(user), 0);
        assertEq(shares, stockBal * 3);

        // Withdraw
        uint256 withdrawn = protocol.withdrawWithYield(shares, user, user);
        assertEq(withdrawn, stockBal);
        assertEq(protocol.balanceOf(user), stockBal);
        vm.stopPrank();
    }
}
