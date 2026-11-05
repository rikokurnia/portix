// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/oracle/PortixPriceOracle.sol";
import "../src/market/StockMarket.sol";

contract StockMarketTest is Test {
    MockPUSDC public pUSDC;
    PortixPriceOracle public oracle;
    StockMarket public market;

    MockStockToken public aapl;
    MockStockToken public googl;
    MockStockToken public nflx;
    MockStockToken public msft;
    MockStockToken public meta;
    MockStockToken public spy;
    MockStockToken public qqq;
    MockStockToken public nvda;

    address public owner = address(0xABCD);
    address public alice = address(0x1111);
    address public bob = address(0x2222);

    uint256 public constant AAPL_PRICE = 300 * 1e6; // $300.00
    uint256 public constant GOOGL_PRICE = 300 * 1e6; // $300.00
    uint256 public constant NFLX_PRICE = 120 * 1e6; // $120.00
    uint256 public constant MSFT_PRICE = 510 * 1e6; // $510.00
    uint256 public constant META_PRICE = 720 * 1e6; // $720.00
    uint256 public constant SPY_PRICE = 585 * 1e6;  // $585.00
    uint256 public constant QQQ_PRICE = 495 * 1e6;  // $495.00
    uint256 public constant NVDA_PRICE = 140 * 1e6; // $140.00

    function setUp() public {
        vm.startPrank(owner);

        pUSDC = new MockPUSDC(owner);
        oracle = new PortixPriceOracle(owner, 3600); // 1 hour heartbeat
        market = new StockMarket(address(pUSDC), address(oracle), 10, owner); // 10 bps (0.10%) fee

        aapl = new MockStockToken("Apple Inc.", "AAPL", owner);
        googl = new MockStockToken("Alphabet Inc.", "GOOGL", owner);
        nflx = new MockStockToken("Netflix Inc.", "NFLX", owner);
        msft = new MockStockToken("Microsoft Corp.", "MSFT", owner);
        meta = new MockStockToken("Meta Platforms Inc.", "META", owner);
        spy = new MockStockToken("SPDR S&P 500 ETF", "SPY", owner);
        qqq = new MockStockToken("Invesco QQQ Trust", "QQQ", owner);
        nvda = new MockStockToken("NVIDIA Corp.", "NVDA", owner);

        // Configure oracle bounds & prices
        _configureAndSetPrice(address(aapl), 50 * 1e6, 1000 * 1e6, AAPL_PRICE);
        _configureAndSetPrice(address(googl), 50 * 1e6, 1000 * 1e6, GOOGL_PRICE);
        _configureAndSetPrice(address(nflx), 20 * 1e6, 500 * 1e6, NFLX_PRICE);
        _configureAndSetPrice(address(msft), 100 * 1e6, 2000 * 1e6, MSFT_PRICE);
        _configureAndSetPrice(address(meta), 100 * 1e6, 2000 * 1e6, META_PRICE);
        _configureAndSetPrice(address(spy), 100 * 1e6, 2000 * 1e6, SPY_PRICE);
        _configureAndSetPrice(address(qqq), 100 * 1e6, 2000 * 1e6, QQQ_PRICE);
        _configureAndSetPrice(address(nvda), 20 * 1e6, 1000 * 1e6, NVDA_PRICE);

        // Support all 8 stocks in market
        market.setStockSupported(address(aapl), true);
        market.setStockSupported(address(googl), true);
        market.setStockSupported(address(nflx), true);
        market.setStockSupported(address(msft), true);
        market.setStockSupported(address(meta), true);
        market.setStockSupported(address(spy), true);
        market.setStockSupported(address(qqq), true);
        market.setStockSupported(address(nvda), true);

        // Seed market inventory
        aapl.mint(address(market), 1000 * 1e18);
        googl.mint(address(market), 1000 * 1e18);
        nflx.mint(address(market), 1000 * 1e18);
        msft.mint(address(market), 1000 * 1e18);
        meta.mint(address(market), 1000 * 1e18);
        spy.mint(address(market), 1000 * 1e18);
        qqq.mint(address(market), 1000 * 1e18);
        nvda.mint(address(market), 1000 * 1e18);
        pUSDC.mint(address(market), 1_000_000 * 1e6); // $1M USDC inventory

        vm.stopPrank();

        // Seed Alice with pUSDC
        pUSDC.faucet(alice, 100_000 * 1e6);
        vm.prank(alice);
        pUSDC.approve(address(market), type(uint256).max);
    }

    function _configureAndSetPrice(address token, uint256 min, uint256 max, uint256 price) internal {
        oracle.configureToken(token, min, max);
        oracle.setPrice(token, price);
    }

    function test_BuyAllEightStocks() public {
        vm.startPrank(alice);

        // 1. AAPL ($300 * 1 = $300 gross, 10 bps fee = $0.30 -> $300.30)
        uint256 aaplCost = market.buyStock(address(aapl), 1e18);
        assertEq(aapl.balanceOf(alice), 1e18);
        assertEq(aaplCost, 300_300_000);

        // 2. GOOGL ($300 * 1 = $300.30)
        uint256 googlCost = market.buyStock(address(googl), 1e18);
        assertEq(googl.balanceOf(alice), 1e18);
        assertEq(googlCost, 300_300_000);

        // 3. NFLX ($120 * 1 = $120.12)
        uint256 nflxCost = market.buyStock(address(nflx), 1e18);
        assertEq(nflx.balanceOf(alice), 1e18);
        assertEq(nflxCost, 120_120_000);

        // 4. MSFT ($510 * 1 = $510.51)
        uint256 msftCost = market.buyStock(address(msft), 1e18);
        assertEq(msft.balanceOf(alice), 1e18);
        assertEq(msftCost, 510_510_000);

        // 5. META ($720 * 1 = $720.72)
        uint256 metaCost = market.buyStock(address(meta), 1e18);
        assertEq(meta.balanceOf(alice), 1e18);
        assertEq(metaCost, 720_720_000);

        // 6. SPY ($585 * 1 = $585.585)
        uint256 spyCost = market.buyStock(address(spy), 1e18);
        assertEq(spy.balanceOf(alice), 1e18);
        assertEq(spyCost, 585_585_000);

        // 7. QQQ ($495 * 1 = $495.495)
        uint256 qqqCost = market.buyStock(address(qqq), 1e18);
        assertEq(qqq.balanceOf(alice), 1e18);
        assertEq(qqqCost, 495_495_000);

        // 8. NVDA ($140 * 1 = $140.14)
        uint256 nvdaCost = market.buyStock(address(nvda), 1e18);
        assertEq(nvda.balanceOf(alice), 1e18);
        assertEq(nvdaCost, 140_140_000);

        vm.stopPrank();
    }

    function test_SellAllEightStocks() public {
        test_BuyAllEightStocks();

        vm.startPrank(alice);
        aapl.approve(address(market), type(uint256).max);
        googl.approve(address(market), type(uint256).max);
        nflx.approve(address(market), type(uint256).max);
        msft.approve(address(market), type(uint256).max);
        meta.approve(address(market), type(uint256).max);
        spy.approve(address(market), type(uint256).max);
        qqq.approve(address(market), type(uint256).max);
        nvda.approve(address(market), type(uint256).max);

        // Sell 1 AAPL ($300 - 0.10% = $299.70)
        uint256 aaplPayout = market.sellStock(address(aapl), 1e18);
        assertEq(aaplPayout, 299_700_000);

        // Sell 1 NVDA ($140 - 0.10% = $139.86)
        uint256 nvdaPayout = market.sellStock(address(nvda), 1e18);
        assertEq(nvdaPayout, 139_860_000);

        vm.stopPrank();
    }

    function test_BuyWithExactUSDC() public {
        vm.startPrank(alice);
        uint256 spend = 1000 * 1e6;
        uint256 stockReceived = market.buyStockWithExactUSDC(address(aapl), spend);
        assertGt(stockReceived, 3.32 * 1e18);
        assertEq(aapl.balanceOf(alice), stockReceived);
        vm.stopPrank();
    }

    function test_RevertWhen_InsufficientStockLiquidity() public {
        vm.startPrank(alice);
        vm.expectRevert();
        market.buyStock(address(aapl), 2000 * 1e18);
        vm.stopPrank();
    }

    function test_RevertWhen_UnsupportedStock() public {
        MockStockToken unlisted = new MockStockToken("Unlisted Stock", "UNL", owner);
        vm.startPrank(alice);
        vm.expectRevert();
        market.buyStock(address(unlisted), 1e18);
        vm.stopPrank();
    }

    function test_FeeCollection() public {
        vm.prank(alice);
        market.buyStock(address(aapl), 10 * 1e18); // $3000 gross -> $3.00 fee
        assertEq(market.accumulatedFeesUSD(), 3_000_000);

        address feeTreasury = address(0x9999);
        vm.prank(owner);
        market.collectFees(feeTreasury);
        assertEq(pUSDC.balanceOf(feeTreasury), 3_000_000);
        assertEq(market.accumulatedFeesUSD(), 0);
    }
}
