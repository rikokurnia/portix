// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPortixDebtPool.sol";

/**
 * @title PortixDebtPool
 * @notice Central credit facility supplying pUSDC borrow liquidity to Portix vaults.
 * @dev Enforces explicit liquidity reserves (no fake/unbacked token creation),
 *      tracks per-vault debt and accrues interest dynamically.
 */
contract PortixDebtPool is IPortixDebtPool, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SECONDS_PER_YEAR = 31536000;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant RAY = 1e27;

    IERC20 public immutable pUSDC;

    // Borrow interest rate in basis points (e.g. 200 = 2.0% annual borrow APY)
    uint256 public borrowRateBps;
    uint256 public borrowIndex; // Scaled by 1e27 (RAY)
    uint256 public lastAccrualTimestamp;

    uint256 public override totalDebt;

    mapping(address => bool) public authorizedVaults;
    // Normalized debt principle: actual debt = (principalSnapshot * borrowIndex) / RAY
    mapping(address => uint256) public vaultDebtSnapshots;

    event VaultAuthorizationUpdated(address indexed vault, bool isAuthorized);
    event BorrowRateUpdated(uint256 newRateBps);

    constructor(
        address pUSDC_,
        uint256 borrowRateBps_,
        address initialOwner_
    ) Ownable2Step() Ownable(initialOwner_) {
        require(pUSDC_ != address(0), "Zero pUSDC address");
        pUSDC = IERC20(pUSDC_);
        borrowRateBps = borrowRateBps_;
        borrowIndex = RAY;
        lastAccrualTimestamp = block.timestamp;
    }

    /// @notice Set authorized vault status
    function setVaultAuthorized(address vault, bool isAuthorized) external onlyOwner {
        require(vault != address(0), "Zero vault address");
        accrueInterest();
        authorizedVaults[vault] = isAuthorized;
        emit VaultAuthorizationUpdated(vault, isAuthorized);
    }

    /// @notice Update annual borrow rate basis points
    function setBorrowRateBps(uint256 newRateBps) external onlyOwner {
        accrueInterest();
        borrowRateBps = newRateBps;
        emit BorrowRateUpdated(newRateBps);
    }

    /// @notice Accrues global borrow interest based on time elapsed
    function accrueInterest() public override {
        uint256 timeElapsed = block.timestamp - lastAccrualTimestamp;
        if (timeElapsed == 0) return;

        if (totalDebt > 0 && borrowRateBps > 0) {
            // linear interest approximation: interestFactor = (borrowRateBps * timeElapsed * RAY) / (10000 * SECONDS_PER_YEAR)
            uint256 interestFactor = (borrowRateBps * timeElapsed * RAY) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
            uint256 interestAccrued = (totalDebt * interestFactor) / RAY;

            borrowIndex += (borrowIndex * interestFactor) / RAY;
            totalDebt += interestAccrued;

            emit InterestAccrued(totalDebt, interestAccrued);
        }

        lastAccrualTimestamp = block.timestamp;
    }

    /// @inheritdoc IPortixDebtPool
    function asset() external view override returns (address) {
        return address(pUSDC);
    }

    /// @inheritdoc IPortixDebtPool
    function availableLiquidity() public view override returns (uint256) {
        return pUSDC.balanceOf(address(this));
    }

    /// @inheritdoc IPortixDebtPool
    function getVaultDebt(address vault) public view override returns (uint256) {
        uint256 snapshot = vaultDebtSnapshots[vault];
        if (snapshot == 0) return 0;

        uint256 currentIndex = borrowIndex;
        uint256 timeElapsed = block.timestamp - lastAccrualTimestamp;
        if (timeElapsed > 0 && borrowRateBps > 0) {
            uint256 interestFactor = (borrowRateBps * timeElapsed * RAY) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
            currentIndex += (borrowIndex * interestFactor) / RAY;
        }

        return (snapshot * currentIndex) / RAY;
    }

    /// @inheritdoc IPortixDebtPool
    function borrow(uint256 amount) external override nonReentrant {
        if (!authorizedVaults[_msgSender()]) revert UnauthorizedBorrower(_msgSender());
        if (amount == 0) revert ZeroAmount();

        accrueInterest();

        uint256 cash = availableLiquidity();
        if (cash < amount) {
            revert InsufficientDebtPoolLiquidity(amount, cash);
        }

        // Add normalized debt to vault snapshot: snapshot += (amount * RAY) / borrowIndex
        uint256 normalizedAmount = (amount * RAY) / borrowIndex;
        vaultDebtSnapshots[_msgSender()] += normalizedAmount;
        totalDebt += amount;

        pUSDC.safeTransfer(_msgSender(), amount);
        emit Borrowed(_msgSender(), amount);
    }

    /// @inheritdoc IPortixDebtPool
    function repay(uint256 amount) external override nonReentrant {
        if (!authorizedVaults[_msgSender()]) revert UnauthorizedBorrower(_msgSender());
        if (amount == 0) revert ZeroAmount();

        accrueInterest();

        uint256 currentDebt = (vaultDebtSnapshots[_msgSender()] * borrowIndex) / RAY;
        if (amount > currentDebt) {
            revert RepayExceedsDebt(amount, currentDebt);
        }

        uint256 normalizedReduction = (amount * RAY) / borrowIndex;
        if (normalizedReduction > vaultDebtSnapshots[_msgSender()]) {
            normalizedReduction = vaultDebtSnapshots[_msgSender()];
        }
        vaultDebtSnapshots[_msgSender()] -= normalizedReduction;

        if (amount > totalDebt) {
            totalDebt = 0;
        } else {
            totalDebt -= amount;
        }

        pUSDC.safeTransferFrom(_msgSender(), address(this), amount);
        uint256 remainingDebt = (vaultDebtSnapshots[_msgSender()] * borrowIndex) / RAY;
        emit Repaid(_msgSender(), amount, remainingDebt);
    }

    /// @notice Supply liquidity to fund borrowing
    function supplyLiquidity(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        pUSDC.safeTransferFrom(_msgSender(), address(this), amount);
        emit LiquiditySupplied(_msgSender(), amount);
    }

    /// @notice Withdraw supplied liquidity (only by owner / designated supplier)
    function withdrawLiquidity(address recipient, uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 cash = availableLiquidity();
        if (cash < amount) revert InsufficientDebtPoolLiquidity(amount, cash);

        pUSDC.safeTransfer(recipient, amount);
        emit LiquidityWithdrawn(recipient, amount);
    }
}
