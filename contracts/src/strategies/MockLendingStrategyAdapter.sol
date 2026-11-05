// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPortixStrategyAdapter.sol";

/**
 * @title MockLendingStrategyAdapter
 * @notice Mock strategy adapter simulating lending carry yield (Morpho / Aave / Compound).
 * @dev HONESTY NOTICE: This is a local mock adapter for testnet prototyping.
 *      It does NOT connect to mainnet lending markets or bridge contracts.
 *      Yield is NOT magically minted or silently pumped: all yield distributed
 *      must be physically funded into this contract via `fundYield()`.
 */
contract MockLendingStrategyAdapter is IPortixStrategyAdapter, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pUSDC;
    address public vault;

    modifier onlyVault() {
        if (_msgSender() != vault) revert UnauthorizedCaller(_msgSender());
        _;
    }

    constructor(address pUSDC_, address initialOwner_)
        Ownable2Step()
        Ownable(initialOwner_)
    {
        require(pUSDC_ != address(0), "Zero pUSDC address");
        pUSDC = IERC20(pUSDC_);
    }

    /// @notice Set the vault authorized to deposit and withdraw
    function setVault(address vault_) external onlyOwner {
        require(vault_ != address(0), "Zero vault address");
        vault = vault_;
    }

    /// @inheritdoc IPortixStrategyAdapter
    function asset() external view override returns (address) {
        return address(pUSDC);
    }

    /// @inheritdoc IPortixStrategyAdapter
    function totalAssets() public view override returns (uint256) {
        // Honest accounting: exactly the physical balance in this contract
        return pUSDC.balanceOf(address(this));
    }

    /// @inheritdoc IPortixStrategyAdapter
    function strategyType() external pure override returns (string memory) {
        return "pxPrime-Lending";
    }

    /// @inheritdoc IPortixStrategyAdapter
    function deposit(uint256 amount) external override nonReentrant onlyVault {
        if (amount == 0) revert ZeroAmount();
        pUSDC.safeTransferFrom(_msgSender(), address(this), amount);
        emit StrategyDeposited(amount);
    }

    /// @inheritdoc IPortixStrategyAdapter
    function withdraw(uint256 amount) external override nonReentrant onlyVault returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();
        uint256 available = totalAssets();
        // If strategy experienced loss or has insufficient liquidity, return available
        received = amount > available ? available : amount;
        if (received > 0) {
            pUSDC.safeTransfer(vault, received);
        }
        emit StrategyWithdrawn(amount, received);
    }

    /// @notice Sponsor or test harness funds real yield into the strategy
    function fundYield(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        pUSDC.safeTransferFrom(_msgSender(), address(this), amount);
        emit YieldFunded(_msgSender(), amount);
    }

    /// @notice Deterministic test control to simulate a market loss or bad debt
    function simulateLoss(address sink, uint256 lossAmount) external nonReentrant onlyOwner {
        require(sink != address(0), "Zero sink address");
        uint256 available = totalAssets();
        if (lossAmount > available) revert InsufficientStrategyBalance(lossAmount, available);

        pUSDC.safeTransfer(sink, lossAmount);
        emit StrategyLossSimulated(lossAmount);
    }
}
