// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";
import "../src/tokens/MockPUSDC.sol";
import "../src/tokens/MockStockToken.sol";
import "../src/oracle/PortixPriceOracle.sol";
import "../src/market/StockMarket.sol";
import "../src/lending/PortixDebtPool.sol";
import "../src/vaults/PortixVaultFactory.sol";
import "../src/vaults/PortixVault.sol";

contract DeployPortix is Script {
    // Initial Oracle Prices matching frontend assets.ts (in 6-decimal USD format)
    uint256 public constant AAPL_PRICE = 300 * 1e6; // $300.00
    uint256 public constant GOOGL_PRICE = 300 * 1e6; // $300.00
    uint256 public constant NFLX_PRICE = 120 * 1e6; // $120.00
    uint256 public constant MSFT_PRICE = 510 * 1e6; // $510.00
    uint256 public constant META_PRICE = 720 * 1e6; // $720.00
    uint256 public constant SPY_PRICE = 585 * 1e6;  // $585.00
    uint256 public constant QQQ_PRICE = 495 * 1e6;  // $495.00
    uint256 public constant NVDA_PRICE = 140 * 1e6; // $140.00

    struct DeployedContracts {
        address pUSDC;
        address oracle;
        address market;
        address debtPool;
        address factory;
        address[8] stocks;
        address[8] primeVaults;
        address[8] boostVaults;
    }

    function run() external returns (DeployedContracts memory deployed) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address deployer;
        if (deployerPrivateKey != 0) {
            deployer = vm.addr(deployerPrivateKey);
            vm.startBroadcast(deployerPrivateKey);
        } else {
            deployer = msg.sender;
            vm.startBroadcast();
        }

        console.log("=== PORTIX Deployment Preflight ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        uint256 heartbeat = vm.envOr("ORACLE_HEARTBEAT_SECONDS", uint256(3600));
        uint256 marketFeeBps = vm.envOr("MARKET_FEE_BPS", uint256(10));
        uint256 debtBorrowRateBps = vm.envOr("DEBT_POOL_BORROW_RATE_BPS", uint256(200));
        uint256 targetLtvBps = vm.envOr("VAULT_TARGET_LTV_BPS", uint256(4000));
        uint256 liquidationLtvBps = vm.envOr("VAULT_LIQUIDATION_LTV_BPS", uint256(8000));

        // 1. Get or Deploy pUSDC
        address existingPUSDC = vm.envOr("PUSDC_ADDRESS", address(0));
        MockPUSDC pUSDC;
        if (existingPUSDC != address(0)) {
            pUSDC = MockPUSDC(existingPUSDC);
            deployed.pUSDC = existingPUSDC;
            console.log("Using deployed pUSDC at:", existingPUSDC);
        } else {
            pUSDC = new MockPUSDC(deployer);
            deployed.pUSDC = address(pUSDC);
            console.log("MockPUSDC deployed at:", address(pUSDC));
        }

        // 2. Deploy Price Oracle
        PortixPriceOracle oracle = new PortixPriceOracle(deployer, heartbeat);
        deployed.oracle = address(oracle);
        console.log("PortixPriceOracle deployed at:", address(oracle));

        // 3. Deploy All 8 Stock Tokens
        string[8] memory stockNames = [
            "Apple Inc.",
            "Alphabet Inc.",
            "Netflix Inc.",
            "Microsoft Corp.",
            "Meta Platforms Inc.",
            "SPDR S&P 500 ETF",
            "Invesco QQQ Trust",
            "NVIDIA Corp."
        ];
        string[8] memory stockSymbols = ["AAPL", "GOOGL", "NFLX", "MSFT", "META", "SPY", "QQQ", "NVDA"];
        uint256[8] memory prices = [
            uint256(AAPL_PRICE),
            GOOGL_PRICE,
            NFLX_PRICE,
            MSFT_PRICE,
            META_PRICE,
            SPY_PRICE,
            QQQ_PRICE,
            NVDA_PRICE
        ];
        uint256[8] memory minBounds = [
            uint256(50 * 1e6),
            50 * 1e6,
            20 * 1e6,
            100 * 1e6,
            100 * 1e6,
            100 * 1e6,
            100 * 1e6,
            20 * 1e6
        ];
        uint256[8] memory maxBounds = [
            uint256(1000 * 1e6),
            1000 * 1e6,
            500 * 1e6,
            2000 * 1e6,
            2000 * 1e6,
            2000 * 1e6,
            2000 * 1e6,
            1000 * 1e6
        ];

        for (uint256 i = 0; i < 8; i++) {
            MockStockToken stock = new MockStockToken(stockNames[i], stockSymbols[i], deployer);
            deployed.stocks[i] = address(stock);
            oracle.configureToken(address(stock), minBounds[i], maxBounds[i]);
            oracle.setPrice(address(stock), prices[i]);
            console.log(string.concat(stockSymbols[i], " Token:"), address(stock));
        }

        // 4. Deploy Stock Market
        StockMarket market = new StockMarket(address(pUSDC), address(oracle), marketFeeBps, deployer);
        deployed.market = address(market);
        console.log("StockMarket deployed at:", address(market));

        // 5. Deploy Debt Pool
        PortixDebtPool debtPool = new PortixDebtPool(address(pUSDC), debtBorrowRateBps, deployer);
        deployed.debtPool = address(debtPool);
        console.log("PortixDebtPool deployed at:", address(debtPool));

        // 6. Deploy Vault Factory
        PortixVaultFactory factory = new PortixVaultFactory(
            address(pUSDC),
            address(oracle),
            address(debtPool),
            deployer
        );
        deployed.factory = address(factory);
        console.log("PortixVaultFactory deployed at:", address(factory));

        // 7. Deploy 16 Vaults (8 Prime, 8 Boost)
        for (uint256 i = 0; i < 8; i++) {
            market.setStockSupported(deployed.stocks[i], true);

            // Deploy Prime Vault (Lending carry)
            (address primeVault, ) = factory.createVault(
                deployed.stocks[i],
                IPortixVault.StrategyKind.PRIME_LENDING,
                targetLtvBps,
                liquidationLtvBps,
                string.concat("PORTIX Prime ", stockSymbols[i], " Vault"),
                string.concat("pxP-", stockSymbols[i])
            );
            deployed.primeVaults[i] = primeVault;
            debtPool.setVaultAuthorized(primeVault, true);

            // Deploy Boost Vault (AMM carry)
            (address boostVault, ) = factory.createVault(
                deployed.stocks[i],
                IPortixVault.StrategyKind.BOOST_AMM,
                targetLtvBps,
                liquidationLtvBps,
                string.concat("PORTIX Boost ", stockSymbols[i], " Vault"),
                string.concat("pxB-", stockSymbols[i])
            );
            deployed.boostVaults[i] = boostVault;
            debtPool.setVaultAuthorized(boostVault, true);
        }

        // 8. Seed Initial Test Inventory / Reserves
        // Market Inventory: 5,000 shares each + $2,000,000 pUSDC
        pUSDC.mint(address(market), 2_000_000 * 1e6);
        for (uint256 i = 0; i < 8; i++) {
            MockStockToken(deployed.stocks[i]).mint(address(market), 5_000 * 1e18);
        }

        // Debt Pool Liquidity: $5,000,000 pUSDC
        pUSDC.mint(address(debtPool), 5_000_000 * 1e6);

        vm.stopBroadcast();
        console.log("=== Deployment Simulation Complete ===");
    }
}
