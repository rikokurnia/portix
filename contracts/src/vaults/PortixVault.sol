// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IPortixVault.sol";
import "../interfaces/IPortixPriceOracle.sol";
import "../interfaces/IPortixDebtPool.sol";
import "../interfaces/IPortixStrategyAdapter.sol";

/**
 * @title PortixVault
 * @notice Isolated ERC-4626 compliant carry vault for a single tokenized equity.
 * @dev Enforces 1-click collateral lock, conservative borrowing (target 40% LTV),
 *      strategy deployment (Lending or AMM), and proportional debt/yield unwind on withdrawal.
 */
contract PortixVault is ERC4626, IPortixVault, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STOCK_SCALE = 1e18;

    StrategyKind public override strategyKind;
    IERC20 public immutable pUSDC;
    IPortixPriceOracle public oracleContract;
    IPortixDebtPool public debtPoolContract;
    IPortixStrategyAdapter public strategyContract;

    uint256 public override targetLtvBps; // default: 4000 (40%)
    uint256 public override liquidationLtvBps; // default: 8000 (80%)

    uint256 internal _trackedStockCollateral;

    event TargetLtvUpdated(uint256 newLtvBps);
    event LiquidationLtvUpdated(uint256 newLtvBps);
    event OracleUpdated(address newOracle);
    event StrategyUpdated(address newStrategy);
    event DebtPoolUpdated(address newDebtPool);

    constructor(
        address underlyingStock_,
        address pUSDC_,
        address oracle_,
        address debtPool_,
        address strategy_,
        uint256 targetLtvBps_,
        uint256 liquidationLtvBps_,
        StrategyKind strategyKind_,
        string memory name_,
        string memory symbol_,
        address initialOwner_
    )
        ERC4626(IERC20(underlyingStock_))
        ERC20(name_, symbol_)
        Ownable2Step()
        Ownable(initialOwner_)
    {
        require(underlyingStock_ != address(0), "Zero underlying stock");
        require(pUSDC_ != address(0), "Zero pUSDC");
        require(oracle_ != address(0), "Zero oracle");
        require(debtPool_ != address(0), "Zero debt pool");
        require(strategy_ != address(0), "Zero strategy");
        require(targetLtvBps_ < liquidationLtvBps_, "Target LTV must be < liquidation LTV");
        require(liquidationLtvBps_ <= 9500, "Liquidation LTV too high");

        pUSDC = IERC20(pUSDC_);
        oracleContract = IPortixPriceOracle(oracle_);
        debtPoolContract = IPortixDebtPool(debtPool_);
        strategyContract = IPortixStrategyAdapter(strategy_);
        targetLtvBps = targetLtvBps_;
        liquidationLtvBps = liquidationLtvBps_;
        strategyKind = strategyKind_;
    }

    // --- Configuration Setters (Owner only) ---

    function setTargetLtvBps(uint256 newTargetLtv) external onlyOwner {
        require(newTargetLtv < liquidationLtvBps, "Target LTV must be < liquidation LTV");
        targetLtvBps = newTargetLtv;
        emit TargetLtvUpdated(newTargetLtv);
    }

    function setLiquidationLtvBps(uint256 newLiquidationLtv) external onlyOwner {
        require(newLiquidationLtv > targetLtvBps && newLiquidationLtv <= 9500, "Invalid liquidation LTV");
        liquidationLtvBps = newLiquidationLtv;
        emit LiquidationLtvUpdated(newLiquidationLtv);
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Zero oracle");
        oracleContract = IPortixPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    function setStrategy(address newStrategy) external onlyOwner {
        require(newStrategy != address(0), "Zero strategy");
        strategyContract = IPortixStrategyAdapter(newStrategy);
        emit StrategyUpdated(newStrategy);
    }

    function setDebtPool(address newDebtPool) external onlyOwner {
        require(newDebtPool != address(0), "Zero debt pool");
        debtPoolContract = IPortixDebtPool(newDebtPool);
        emit DebtPoolUpdated(newDebtPool);
    }

    // --- View Implementations ---

    function underlyingStock() external view override returns (address) {
        return asset();
    }

    function settlementAsset() external view override returns (address) {
        return address(pUSDC);
    }

    function oracle() external view override returns (address) {
        return address(oracleContract);
    }

    function strategy() external view override returns (address) {
        return address(strategyContract);
    }

    function debtPool() external view override returns (address) {
        return address(debtPoolContract);
    }

    /// @notice Returns the total stock collateral tracked by the vault
    function totalAssets() public view override(ERC4626, IERC4626) returns (uint256) {
        return _trackedStockCollateral;
    }

    /// @inheritdoc IPortixVault
    function getVaultMetrics()
        public
        view
        override
        returns (
            uint256 totalStockCollateral,
            uint256 totalDebtUSD,
            uint256 totalStrategyAssetsUSD,
            uint256 netCarryYieldUSD,
            uint256 currentLtvBps,
            bool isHealthy
        )
    {
        totalStockCollateral = _trackedStockCollateral;
        totalDebtUSD = debtPoolContract.getVaultDebt(address(this));
        totalStrategyAssetsUSD = strategyContract.totalAssets();

        if (totalStrategyAssetsUSD > totalDebtUSD) {
            netCarryYieldUSD = totalStrategyAssetsUSD - totalDebtUSD;
        } else {
            netCarryYieldUSD = 0;
        }

        if (totalStockCollateral > 0) {
            uint256 priceUSD = oracleContract.getPriceUSD(asset());
            uint256 collateralValueUSD = (totalStockCollateral * priceUSD) / STOCK_SCALE;
            if (collateralValueUSD > 0) {
                currentLtvBps = (totalDebtUSD * BPS_DENOMINATOR) / collateralValueUSD;
            }
        }

        isHealthy = currentLtvBps <= liquidationLtvBps;
    }

    /// @inheritdoc IPortixVault
    function previewDepositCarry(uint256 stockAmount)
        external
        view
        override
        returns (uint256 sharesExpected, uint256 collateralUSD, uint256 borrowUSD)
    {
        if (stockAmount == 0) return (0, 0, 0);
        sharesExpected = previewDeposit(stockAmount);
        uint256 priceUSD = oracleContract.getPriceUSD(asset());
        collateralUSD = (stockAmount * priceUSD) / STOCK_SCALE;
        borrowUSD = (collateralUSD * targetLtvBps) / BPS_DENOMINATOR;
    }

    /// @inheritdoc IPortixVault
    function previewWithdrawCarry(uint256 shares)
        public
        view
        override
        returns (
            uint256 stockReturned,
            uint256 debtShareUSD,
            uint256 strategyShareUSD,
            uint256 estimatedYieldUSD,
            uint256 stockDeficitDeduction
        )
    {
        uint256 supply = totalSupply();
        if (supply == 0 || shares == 0) return (0, 0, 0, 0, 0);

        stockReturned = _convertToAssets(shares, Math.Rounding.Floor);
        uint256 totalDebtUSD = debtPoolContract.getVaultDebt(address(this));
        uint256 totalStrategyAssetsUSD = strategyContract.totalAssets();

        debtShareUSD = (shares * totalDebtUSD) / supply;
        strategyShareUSD = (shares * totalStrategyAssetsUSD) / supply;

        if (strategyShareUSD >= debtShareUSD) {
            estimatedYieldUSD = strategyShareUSD - debtShareUSD;
            stockDeficitDeduction = 0;
        } else {
            uint256 deficitUSD = debtShareUSD - strategyShareUSD;
            uint256 priceUSD = oracleContract.getPriceUSD(asset());
            stockDeficitDeduction = (deficitUSD * STOCK_SCALE + priceUSD - 1) / priceUSD;
            if (stockDeficitDeduction > stockReturned) {
                stockDeficitDeduction = stockReturned;
            }
            stockReturned -= stockDeficitDeduction;
        }
    }

    // --- Core Carry Lifecycle ---

    /// @inheritdoc IPortixVault
    function depositAndInvest(uint256 stockAmount, address receiver)
        external
        override
        nonReentrant
        whenNotPaused
        returns (uint256 sharesMinted, uint256 pUSDCBorrowed)
    {
        if (stockAmount == 0) revert ZeroSharesOrAssets();
        require(receiver != address(0), "Zero receiver");

        // 1. Calculate and mint ERC-4626 shares for underlying stock
        sharesMinted = previewDeposit(stockAmount);
        _trackedStockCollateral += stockAmount;
        _deposit(_msgSender(), receiver, stockAmount, sharesMinted);

        // 2. Value stock at fresh oracle price
        uint256 priceUSD = oracleContract.getPriceUSD(asset());

        // 3. Auto-borrow at target LTV (40%)
        pUSDCBorrowed = (stockAmount * priceUSD * targetLtvBps) / (STOCK_SCALE * BPS_DENOMINATOR);
        if (pUSDCBorrowed > 0) {
            debtPoolContract.borrow(pUSDCBorrowed);

            // 4. Route borrowed liquidity to strategy adapter
            pUSDC.forceApprove(address(strategyContract), pUSDCBorrowed);
            strategyContract.deposit(pUSDCBorrowed);
        }

        emit CarryDeposited(_msgSender(), receiver, stockAmount, sharesMinted, pUSDCBorrowed);
    }

    /// @inheritdoc IPortixVault
    function withdrawWithYield(
        uint256 shares,
        address receiver,
        address owner
    )
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaidUSD)
    {
        if (shares == 0) revert ZeroSharesOrAssets();
        require(receiver != address(0), "Zero receiver");
        require(owner != address(0), "Zero owner");

        if (_msgSender() != owner) {
            _spendAllowance(owner, _msgSender(), shares);
        }

        uint256 supply = totalSupply();
        require(supply > 0, "No shares exist");

        // 1. Proportional calculations
        uint256 grossStock = _convertToAssets(shares, Math.Rounding.Floor);
        uint256 totalDebtUSD = debtPoolContract.getVaultDebt(address(this));
        uint256 totalStrategyAssetsUSD = strategyContract.totalAssets();

        uint256 userDebtUSD = (shares * totalDebtUSD) / supply;
        uint256 userStrategyUSD = (shares * totalStrategyAssetsUSD) / supply;

        // 2. Burn shares and update tracked collateral (Checks-Effects-Interactions)
        _trackedStockCollateral -= grossStock;
        _burn(owner, shares);

        // 3. Unwind strategy liquidity
        uint256 receivedUSDC = 0;
        if (userStrategyUSD > 0) {
            receivedUSDC = strategyContract.withdraw(userStrategyUSD);
        }

        // 4. Repay debt to debt pool & settle yield/losses
        uint256 stockDeduction = 0;
        if (receivedUSDC >= userDebtUSD) {
            // Par or profitable scenario
            debtRepaidUSD = userDebtUSD;
            if (debtRepaidUSD > 0) {
                pUSDC.forceApprove(address(debtPoolContract), debtRepaidUSD);
                debtPoolContract.repay(debtRepaidUSD);
            }
            netYieldUSD = receivedUSDC - debtRepaidUSD;
            if (netYieldUSD > 0) {
                pUSDC.safeTransfer(receiver, netYieldUSD);
            }
            stockReturned = grossStock;
        } else {
            // Strategy loss scenario: receivedUSDC < userDebtUSD
            debtRepaidUSD = receivedUSDC;
            if (debtRepaidUSD > 0) {
                pUSDC.forceApprove(address(debtPoolContract), debtRepaidUSD);
                debtPoolContract.repay(debtRepaidUSD);
            }

            uint256 deficitUSD = userDebtUSD - receivedUSDC;
            uint256 priceUSD = oracleContract.getPriceUSD(asset());
            stockDeduction = (deficitUSD * STOCK_SCALE + priceUSD - 1) / priceUSD;

            if (stockDeduction > grossStock) {
                revert InsufficientCollateralForDebt(deficitUSD, (grossStock * priceUSD) / STOCK_SCALE);
            }

            stockReturned = grossStock - stockDeduction;
            netYieldUSD = 0;
        }

        // 5. Transfer stock collateral to receiver
        if (stockReturned > 0) {
            IERC20(asset()).safeTransfer(receiver, stockReturned);
        }

        emit CarryWithdrawn(
            _msgSender(),
            receiver,
            owner,
            shares,
            stockReturned,
            netYieldUSD,
            debtRepaidUSD,
            stockDeduction
        );
    }

    /// @inheritdoc IPortixVault
    function deleverage(uint256 amountToRepay) external override nonReentrant returns (uint256 debtRepaid) {
        if (amountToRepay == 0) revert ZeroSharesOrAssets();
        uint256 totalDebtUSD = debtPoolContract.getVaultDebt(address(this));
        uint256 toRepay = amountToRepay > totalDebtUSD ? totalDebtUSD : amountToRepay;
        if (toRepay == 0) return 0;

        uint256 unwound = strategyContract.withdraw(toRepay);
        debtRepaid = unwound > toRepay ? toRepay : unwound;
        if (debtRepaid > 0) {
            pUSDC.forceApprove(address(debtPoolContract), debtRepaid);
            debtPoolContract.repay(debtRepaid);
        }

        (, , , , uint256 newLtvBps, ) = getVaultMetrics();
        emit Deleveraged(_msgSender(), unwound, debtRepaid, newLtvBps);
    }

    // --- Overridden Standard ERC-4626 Hooks ---

    /// @notice Standard ERC4626 deposit - records tracked collateral
    function deposit(uint256 assets, address receiver) public override(ERC4626, IERC4626) returns (uint256) {
        uint256 shares = super.deposit(assets, receiver);
        _trackedStockCollateral += assets;
        return shares;
    }

    /// @notice Standard ERC4626 mint - records tracked collateral
    function mint(uint256 shares, address receiver) public override(ERC4626, IERC4626) returns (uint256) {
        uint256 assets = super.mint(shares, receiver);
        _trackedStockCollateral += assets;
        return assets;
    }

    /// @notice Standard ERC4626 redeem redirected to safe carry unwind
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override(ERC4626, IERC4626) returns (uint256 assets) {
        (assets, , ) = withdrawWithYield(shares, receiver, owner);
    }

    /// @notice Standard ERC4626 withdraw redirected to safe carry unwind
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override(ERC4626, IERC4626) returns (uint256 shares) {
        shares = previewWithdraw(assets);
        withdrawWithYield(shares, receiver, owner);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
