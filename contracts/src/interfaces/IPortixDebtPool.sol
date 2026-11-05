// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPortixDebtPool {
    error InsufficientDebtPoolLiquidity(uint256 requested, uint256 available);
    error UnauthorizedBorrower(address caller);
    error ZeroAmount();
    error RepayExceedsDebt(uint256 amount, uint256 currentDebt);

    event Borrowed(address indexed vault, uint256 amount);
    event Repaid(address indexed vault, uint256 amount, uint256 remainingDebt);
    event LiquiditySupplied(address indexed supplier, uint256 amount);
    event LiquidityWithdrawn(address indexed supplier, uint256 amount);
    event InterestAccrued(uint256 newTotalDebt, uint256 interestAccrued);

    /// @notice Returns the settlement asset address (pUSDC)
    function asset() external view returns (address);

    /// @notice Returns total available cash in pool
    function availableLiquidity() external view returns (uint256);

    /// @notice Returns total outstanding debt across all vaults including accrued interest
    function totalDebt() external view returns (uint256);

    /// @notice Returns the debt of a specific vault including accrued interest
    function getVaultDebt(address vault) external view returns (uint256);

    /// @notice Borrow pUSDC from the debt pool (called by authorized vaults)
    function borrow(uint256 amount) external;

    /// @notice Repay pUSDC debt to the debt pool
    function repay(uint256 amount) external;

    /// @notice Accrue global borrow interest
    function accrueInterest() external;
}
