// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IPortixVault is IERC4626 {
    enum StrategyKind {
        PRIME_LENDING,
        BOOST_AMM
    }

    error LtvExceedsMaximum(uint256 currentLtv, uint256 maxLtv);
    error VaultUnhealthyCannotWithdrawCollateralOnly(uint256 currentLtv, uint256 liquidationLtv);
    error InsufficientCollateralForDebt(uint256 deficitUSD, uint256 userStockValueUSD);
    error ZeroSharesOrAssets();
    error OraclePriceInvalid();
    error StrategyUnwindFailed(uint256 expected, uint256 actual);

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
        uint256 stockDeductedForDeficit
    );

    event Deleveraged(
        address indexed caller,
        uint256 strategyUnwound,
        uint256 debtRepaid,
        uint256 newLtvBps
    );

    /// @notice Type of strategy: PRIME_LENDING or BOOST_AMM
    function strategyKind() external view returns (StrategyKind);

    /// @notice Returns the underlying stock address (same as asset())
    function underlyingStock() external view returns (address);

    /// @notice Returns the borrowed/settlement asset (pUSDC)
    function settlementAsset() external view returns (address);

    /// @notice Returns the oracle contract address
    function oracle() external view returns (address);

    /// @notice Returns the strategy adapter address
    function strategy() external view returns (address);

    /// @notice Returns the debt pool address
    function debtPool() external view returns (address);

    /// @notice Target initial borrow LTV in basis points (4000 = 40%)
    function targetLtvBps() external view returns (uint256);

    /// @notice Liquidation threshold LTV in basis points (8000 = 80%)
    function liquidationLtvBps() external view returns (uint256);

    /// @notice One-click carry deposit: locks stock, borrows pUSDC at target LTV, invests into strategy, mints shares
    function depositAndInvest(uint256 stockAmount, address receiver)
        external
        returns (uint256 sharesMinted, uint256 pUSDCBorrowed);

    /// @notice One-click carry withdrawal: burns shares, unwinds strategy, repays debt, distributes stock + net yield
    function withdrawWithYield(uint256 shares, address receiver, address owner)
        external
        returns (uint256 stockReturned, uint256 netYieldUSD, uint256 debtRepaidUSD);

    /// @notice Deleverage position if LTV is elevated
    function deleverage(uint256 amountToRepay) external returns (uint256 debtRepaid);

    /// @notice Comprehensive vault metrics for frontend dashboard
    function getVaultMetrics()
        external
        view
        returns (
            uint256 totalStockCollateral,
            uint256 totalDebtUSD,
            uint256 totalStrategyAssetsUSD,
            uint256 netCarryYieldUSD,
            uint256 currentLtvBps,
            bool isHealthy
        );

    /// @notice Simulation / quote for carry deposit
    function previewDepositCarry(uint256 stockAmount)
        external
        view
        returns (uint256 sharesExpected, uint256 collateralUSD, uint256 borrowUSD);

    /// @notice Simulation / quote for carry withdrawal
    function previewWithdrawCarry(uint256 shares)
        external
        view
        returns (
            uint256 stockReturned,
            uint256 debtShareUSD,
            uint256 strategyShareUSD,
            uint256 estimatedYieldUSD,
            uint256 stockDeficitDeduction
        );
}
