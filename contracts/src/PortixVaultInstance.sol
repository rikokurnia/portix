// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPriceOracleMinimal {
    function getPriceUSD(address token) external view returns (uint256);
}

/**
 * @title PortixVaultInstance
 * @notice Isolated carry vault instance for a single tokenized equity and strategy family.
 * @dev Enforces 1-click collateral lock, target 40% LTV borrow accounting, yield generation,
 *      and strict owner/allowance authorization with atomic reverts on liquidity failure.
 */
contract PortixVaultInstance {
    enum StrategyKind { PRIME_LENDING, BOOST_AMM }

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    address public immutable asset;             // Underlying tokenized stock (18 decimals)
    address public immutable settlementAsset;   // pUSDC (6 decimals)
    address public oracle;                      // Price oracle contract
    StrategyKind public immutable strategyKind; // 0: PRIME_LENDING, 1: BOOST_AMM

    uint256 public constant targetLtvBps = 4000;       // 40% initial target LTV
    uint256 public constant liquidationLtvBps = 8000;  // 80% liquidation threshold
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STOCK_SCALE = 1e18;

    uint256 public totalSupply;
    uint256 public totalCollateral;
    uint256 public totalDebtUSD;
    uint256 public totalYieldAccumulated;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public userCollateral;
    mapping(address => uint256) public userDebt;
    mapping(address => uint256) public userDepositTime;

    address public owner;

    event CarryDeposited(
        address indexed caller,
        address indexed receiver,
        uint256 stockAmount,
        uint256 sharesMinted,
        uint256 pUSDCBorrowed
    );

    event CarryWithdrawn(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 sharesBurned,
        uint256 stockReturned,
        uint256 netYieldUSD,
        uint256 debtRepaidUSD,
        uint256 stockDeficitDeduction
    );

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address asset_,
        address settlementAsset_,
        address oracle_,
        StrategyKind strategyKind_,
        address initialOwner
    ) {
        require(asset_ != address(0), "Zero asset");
        require(settlementAsset_ != address(0), "Zero settlement");
        require(initialOwner != address(0), "Zero owner");

        name = name_;
        symbol = symbol_;
        asset = asset_;
        settlementAsset = settlementAsset_;
        oracle = oracle_;
        strategyKind = strategyKind_;
        owner = initialOwner;
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Zero oracle");
        oracle = newOracle;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "Zero address");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Zero address");
        require(balanceOf[msg.sender] >= amount, "Insufficient shares");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Zero address");
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "Insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        require(balanceOf[from] >= amount, "Insufficient shares");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @notice Returns current stock price from oracle with fallback
    function getStockPriceUSD() public view returns (uint256) {
        if (oracle != address(0)) {
            try IPriceOracleMinimal(oracle).getPriceUSD(asset) returns (uint256 p) {
                if (p > 0) return p;
            } catch {}
        }
        return 300 * 1e6; // Default $300.00
    }

    /// @notice Calculates accrued carry yield for a user position
    function getAccruedYield(address account) public view returns (uint256) {
        uint256 debt = userDebt[account];
        if (debt == 0) return 0;

        uint256 elapsed = block.timestamp > userDepositTime[account]
            ? block.timestamp - userDepositTime[account]
            : 0;

        // Baseline rate: pxPrime = 12% APY, pxBoost = 24% APY
        uint256 apyBps = strategyKind == StrategyKind.PRIME_LENDING ? 1200 : 2400;
        uint256 timeYield = (debt * apyBps * elapsed) / (BPS_DENOMINATOR * 365 days);

        // Minimum instant testnet incentive yield (e.g. 0.05% of borrow) for immediate UX confirmation
        uint256 instantYield = (debt * 5) / BPS_DENOMINATOR;
        return timeYield > instantYield ? timeYield : instantYield;
    }

    /// @notice Simulates carry deposit values
    function previewDepositCarry(uint256 stockAmount)
        external
        view
        returns (uint256 sharesExpected, uint256 collateralUSD, uint256 borrowUSD)
    {
        if (stockAmount == 0) return (0, 0, 0);
        sharesExpected = stockAmount; // 1:1 share ratio
        uint256 price = getStockPriceUSD();
        collateralUSD = (stockAmount * price) / STOCK_SCALE;
        borrowUSD = (collateralUSD * targetLtvBps) / BPS_DENOMINATOR;
    }

    /// @notice Simulates carry withdrawal values (5 return values matching IPortixVault)
    function previewWithdrawCarry(uint256 shares)
        public
        view
        returns (
            uint256 stockReturned,
            uint256 debtShareUSD,
            uint256 strategyShareUSD,
            uint256 estimatedYieldUSD,
            uint256 stockDeficitDeduction
        )
    {
        if (shares == 0 || totalSupply == 0) return (0, 0, 0, 0, 0);

        stockReturned = (shares * totalCollateral) / totalSupply;
        debtShareUSD = (shares * totalDebtUSD) / totalSupply;

        // Strategy asset includes borrowed principal + projected yield
        uint256 apyBps = strategyKind == StrategyKind.PRIME_LENDING ? 1200 : 2400;
        estimatedYieldUSD = (debtShareUSD * apyBps) / (BPS_DENOMINATOR * 10); // 1.2% - 2.4% projected
        strategyShareUSD = debtShareUSD + estimatedYieldUSD;
        stockDeficitDeduction = 0;
    }

    /// @notice Comprehensive vault metrics for frontend dashboard
    function getVaultMetrics()
        external
        view
        returns (
            uint256 totalStockCollateral,
            uint256 totalDebt,
            uint256 totalStrategyAssetsUSD,
            uint256 netCarryYieldUSD,
            uint256 currentLtvBps,
            bool isHealthy
        )
    {
        totalStockCollateral = totalCollateral;
        totalDebt = totalDebtUSD;
        uint256 price = getStockPriceUSD();
        uint256 collateralValUSD = (totalCollateral * price) / STOCK_SCALE;

        netCarryYieldUSD = totalYieldAccumulated;
        totalStrategyAssetsUSD = totalDebtUSD + netCarryYieldUSD;
        currentLtvBps = collateralValUSD > 0 ? (totalDebtUSD * BPS_DENOMINATOR) / collateralValUSD : 0;
        isHealthy = currentLtvBps <= liquidationLtvBps;
    }

    /// @notice Public getter for user position
    function getPosition(address account)
        external
        view
        returns (uint256 collateral, uint256 shares, uint256 debt, uint256 accruedYield)
    {
        return (userCollateral[account], balanceOf[account], userDebt[account], getAccruedYield(account));
    }

    /// @notice One-click carry deposit: locks stock, records auto-borrow, and mints shares
    function depositAndInvest(uint256 stockAmount, address receiver)
        external
        returns (uint256 sharesMinted, uint256 pUSDCBorrowed)
    {
        require(stockAmount > 0, "Zero deposit amount");
        require(receiver != address(0), "Zero receiver");

        // 1. Pull underlying tokenized stock from sender
        require(
            IERC20Minimal(asset).transferFrom(msg.sender, address(this), stockAmount),
            "Stock transferFrom failed"
        );

        // 2. Mint 1:1 shares
        sharesMinted = stockAmount;
        balanceOf[receiver] += sharesMinted;
        totalSupply += sharesMinted;

        // 3. Auto-borrow calculation at 40% target LTV
        uint256 price = getStockPriceUSD();
        uint256 collateralVal = (stockAmount * price) / STOCK_SCALE;
        pUSDCBorrowed = (collateralVal * targetLtvBps) / BPS_DENOMINATOR;

        userCollateral[receiver] += stockAmount;
        userDebt[receiver] += pUSDCBorrowed;
        userDepositTime[receiver] = block.timestamp;

        totalCollateral += stockAmount;
        totalDebtUSD += pUSDCBorrowed;

        emit Transfer(address(0), receiver, sharesMinted);
        emit CarryDeposited(msg.sender, receiver, stockAmount, sharesMinted, pUSDCBorrowed);
    }

    /// @notice One-click carry withdrawal: burns shares, returns stock, and pays accrued yield
    /// @dev Enforces owner/allowance authorization and atomic revert on liquidity failure
    function withdrawWithYield(uint256 shares, address receiver, address accountOwner)
        external
        returns (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaidUSD)
    {
        require(shares > 0, "Zero shares to withdraw");
        require(receiver != address(0), "Zero receiver");
        require(accountOwner != address(0), "Zero owner");
        require(balanceOf[accountOwner] >= shares, "Insufficient share balance");

        // 1. Strict Owner / Allowance Authorization
        if (msg.sender != accountOwner) {
            uint256 allowed = allowance[accountOwner][msg.sender];
            require(allowed >= shares, "Unauthorized: caller has insufficient allowance");
            if (allowed != type(uint256).max) {
                allowance[accountOwner][msg.sender] = allowed - shares;
                emit Approval(accountOwner, msg.sender, allowed - shares);
            }
        }

        // 2. Compute proportional collateral, debt, and accrued yield
        uint256 userShares = balanceOf[accountOwner];
        stockReturned = (shares * userCollateral[accountOwner]) / userShares;
        debtRepaidUSD = (shares * userDebt[accountOwner]) / userShares;
        netYieldUSD = (shares * getAccruedYield(accountOwner)) / userShares;

        // 3. Update internal accounting before external transfers (Checks-Effects-Interactions)
        balanceOf[accountOwner] -= shares;
        totalSupply -= shares;
        userCollateral[accountOwner] -= stockReturned;
        userDebt[accountOwner] -= debtRepaidUSD;
        totalCollateral -= stockReturned;
        totalDebtUSD -= debtRepaidUSD;
        totalYieldAccumulated += netYieldUSD;

        emit Transfer(accountOwner, address(0), shares);

        // 4. Return 100% principal stock collateral
        require(
            IERC20Minimal(asset).transfer(receiver, stockReturned),
            "Stock collateral transfer failed"
        );

        // 5. Pay accrued carry yield in pUSDC with strict atomic liquidity requirement
        if (netYieldUSD > 0) {
            uint256 usdcBalance = IERC20Minimal(settlementAsset).balanceOf(address(this));
            require(
                usdcBalance >= netYieldUSD,
                "Insufficient settlement liquidity for yield payout"
            );
            require(
                IERC20Minimal(settlementAsset).transfer(receiver, netYieldUSD),
                "USDC yield transfer failed"
            );
        }

        emit CarryWithdrawn(
            msg.sender,
            receiver,
            accountOwner,
            shares,
            stockReturned,
            netYieldUSD,
            debtRepaidUSD,
            0
        );
    }
}
