// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/oracle/PortixPriceOracle.sol";
import "../src/lending/PortixDebtPool.sol";
import "../src/vaults/PortixVaultFactory.sol";
import "../src/vaults/PortixVault.sol";

contract PortixVaultFactoryTest is Test {
    MockPUSDC public pUSDC;
    PortixPriceOracle public oracle;
    PortixDebtPool public debtPool;
    PortixVaultFactory public factory;

    MockStockToken public aapl;
    MockStockToken public googl;
    MockStockToken public nflx;
    MockStockToken public msft;
    MockStockToken public meta;
    MockStockToken public spy;
    MockStockToken public qqq;
    MockStockToken public nvda;

    address public owner = address(0xABCD);

    function setUp() public {
        vm.startPrank(owner);
        pUSDC = new MockPUSDC(owner);
        oracle = new PortixPriceOracle(owner, 3600);
        debtPool = new PortixDebtPool(address(pUSDC), 200, owner);

        factory = new PortixVaultFactory(
            address(pUSDC),
            address(oracle),
            address(debtPool),
            owner
        );

        aapl = new MockStockToken("Apple Inc.", "AAPL", owner);
        googl = new MockStockToken("Alphabet Inc.", "GOOGL", owner);
        nflx = new MockStockToken("Netflix Inc.", "NFLX", owner);
        msft = new MockStockToken("Microsoft Corp.", "MSFT", owner);
        meta = new MockStockToken("Meta Platforms Inc.", "META", owner);
        spy = new MockStockToken("SPDR S&P 500 ETF", "SPY", owner);
        qqq = new MockStockToken("Invesco QQQ Trust", "QQQ", owner);
        nvda = new MockStockToken("NVIDIA Corp.", "NVDA", owner);

        vm.stopPrank();
    }

    function test_DeployAllSixteenVaults() public {
        vm.startPrank(owner);

        address[8] memory stocks = [
            address(aapl),
            address(googl),
            address(nflx),
            address(msft),
            address(meta),
            address(spy),
            address(qqq),
            address(nvda)
        ];
        string[8] memory symbols = ["AAPL", "GOOGL", "NFLX", "MSFT", "META", "SPY", "QQQ", "NVDA"];

        for (uint256 i = 0; i < 8; i++) {
            // 1. Deploy Prime Vault
            (address primeVault, ) = factory.createVault(
                stocks[i],
                IPortixVault.StrategyKind.PRIME_LENDING,
                4000,
                8000,
                string.concat("PORTIX Prime ", symbols[i], " Vault"),
                string.concat("pxP-", symbols[i])
            );
            assertEq(factory.getVault(stocks[i], IPortixVault.StrategyKind.PRIME_LENDING), primeVault);
            assertEq(PortixVault(primeVault).asset(), stocks[i]);
            assertEq(uint8(PortixVault(primeVault).strategyKind()), uint8(IPortixVault.StrategyKind.PRIME_LENDING));

            // 2. Deploy Boost Vault
            (address boostVault, ) = factory.createVault(
                stocks[i],
                IPortixVault.StrategyKind.BOOST_AMM,
                4000,
                8000,
                string.concat("PORTIX Boost ", symbols[i], " Vault"),
                string.concat("pxB-", symbols[i])
            );
            assertEq(factory.getVault(stocks[i], IPortixVault.StrategyKind.BOOST_AMM), boostVault);
            assertEq(PortixVault(boostVault).asset(), stocks[i]);
            assertEq(uint8(PortixVault(boostVault).strategyKind()), uint8(IPortixVault.StrategyKind.BOOST_AMM));
        }

        assertEq(factory.totalVaults(), 16);
        address[] memory all = factory.getAllVaults();
        assertEq(all.length, 16);

        vm.stopPrank();
    }

    function test_RevertWhen_DuplicateVault() public {
        vm.startPrank(owner);
        factory.createVault(
            address(aapl),
            IPortixVault.StrategyKind.PRIME_LENDING,
            4000,
            8000,
            "PORTIX Prime AAPL Vault",
            "pxP-AAPL"
        );

        vm.expectRevert("Vault already exists");
        factory.createVault(
            address(aapl),
            IPortixVault.StrategyKind.PRIME_LENDING,
            4000,
            8000,
            "PORTIX Prime AAPL Vault",
            "pxP-AAPL"
        );
        vm.stopPrank();
    }
}
