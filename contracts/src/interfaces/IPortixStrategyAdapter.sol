// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPortixStrategyAdapter {
    error UnauthorizedCaller(address caller);
    error InsufficientStrategyBalance(uint256 requested, uint256 available);
    error ZeroAmount();

    event StrategyDeposited(uint256 amount);
    event StrategyWithdrawn(uint256 requested, uint256 received);
    event YieldFunded(address indexed funder, uint256 amount);
    event StrategyLossSimulated(uint256 amount);

    /// @notice Returns the underlying asset invested (pUSDC)
    function asset() external view returns (address);

    /// @notice Total assets under management in pUSDC (6 decimals)
    function totalAssets() external view returns (uint256);

    /// @notice Human-readable name/type of the strategy ("pxPrime-Lending" or "pxBoost-AMM")
    function strategyType() external view returns (string memory);

    /// @notice Deposits pUSDC into the strategy
    function deposit(uint256 amount) external;

    /// @notice Withdraws pUSDC from the strategy. Returns actual amount received.
    function withdraw(uint256 amount) external returns (uint256 received);
}
