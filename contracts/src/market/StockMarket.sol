// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IPortixPriceOracle.sol";

/**
 * @title StockMarket
 * @notice Spot market for buying and selling tokenized stocks using pUSDC.
 * @dev Prices are derived directly from the PortixPriceOracle.
 *      Enforces explicit inventory reserves and configurable trading fee basis points.
 */
contract StockMarket is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 500; // Max 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STOCK_SCALE = 1e18;

    IERC20 public immutable pUSDC;
    IPortixPriceOracle public oracle;
    uint256 public feeBps; // e.g. 10 = 0.10%
    uint256 public accumulatedFeesUSD;

    mapping(address => bool) public supportedStocks;

    error UnsupportedStock(address stock);
    error InsufficientStockLiquidity(address stock, uint256 requested, uint256 available);
    error InsufficientUSDCLiquidity(uint256 requested, uint256 available);
    error ZeroAmount();
    error FeeTooHigh(uint256 feeBps);

    event StockBought(
        address indexed buyer,
        address indexed stock,
        uint256 stockAmount,
        uint256 usdcPaid,
        uint256 feePaid
    );

    event StockSold(
        address indexed seller,
        address indexed stock,
        uint256 stockAmount,
        uint256 usdcReceived,
        uint256 feeDeducted
    );

    event StockSupportUpdated(address indexed stock, bool isSupported);
    event FeeUpdated(uint256 newFeeBps);
    event OracleUpdated(address newOracle);
    event FeesCollected(address indexed recipient, uint256 amount);

    constructor(
        address pUSDC_,
        address oracle_,
        uint256 feeBps_,
        address initialOwner_
    ) Ownable2Step() Ownable(initialOwner_) {
        require(pUSDC_ != address(0), "Zero pUSDC address");
        require(oracle_ != address(0), "Zero oracle address");
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_);

        pUSDC = IERC20(pUSDC_);
        oracle = IPortixPriceOracle(oracle_);
        feeBps = feeBps_;
    }

    /// @notice Set stock support status
    function setStockSupported(address stock, bool isSupported) external onlyOwner {
        require(stock != address(0), "Zero stock address");
        supportedStocks[stock] = isSupported;
        emit StockSupportUpdated(stock, isSupported);
    }

    /// @notice Set trading fee basis points
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps);
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    /// @notice Update oracle address
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Zero oracle address");
        oracle = IPortixPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    /// @notice Quotes the exact pUSDC cost to buy `stockAmount` of `stock`
    function quoteBuy(address stock, uint256 stockAmount)
        public
        view
        returns (uint256 grossUSD, uint256 feeUSD, uint256 totalCostUSD)
    {
        if (!supportedStocks[stock]) revert UnsupportedStock(stock);
        if (stockAmount == 0) revert ZeroAmount();

        uint256 priceUSD = oracle.getPriceUSD(stock);
        grossUSD = (stockAmount * priceUSD) / STOCK_SCALE;
        feeUSD = (grossUSD * feeBps) / BPS_DENOMINATOR;
        totalCostUSD = grossUSD + feeUSD;
    }

    /// @notice Quotes the exact pUSDC received when selling `stockAmount` of `stock`
    function quoteSell(address stock, uint256 stockAmount)
        public
        view
        returns (uint256 grossUSD, uint256 feeUSD, uint256 netPayoutUSD)
    {
        if (!supportedStocks[stock]) revert UnsupportedStock(stock);
        if (stockAmount == 0) revert ZeroAmount();

        uint256 priceUSD = oracle.getPriceUSD(stock);
        grossUSD = (stockAmount * priceUSD) / STOCK_SCALE;
        feeUSD = (grossUSD * feeBps) / BPS_DENOMINATOR;
        netPayoutUSD = grossUSD - feeUSD;
    }

    /// @notice Buy exact stock amount using pUSDC
    function buyStock(address stock, uint256 stockAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 totalCostUSD)
    {
        (, uint256 feeUSD, uint256 totalCost) = quoteBuy(stock, stockAmount);

        uint256 stockAvailable = IERC20(stock).balanceOf(address(this));
        if (stockAvailable < stockAmount) {
            revert InsufficientStockLiquidity(stock, stockAmount, stockAvailable);
        }

        accumulatedFeesUSD += feeUSD;

        pUSDC.safeTransferFrom(_msgSender(), address(this), totalCost);
        IERC20(stock).safeTransfer(_msgSender(), stockAmount);

        emit StockBought(_msgSender(), stock, stockAmount, totalCost, feeUSD);
        return totalCost;
    }

    /// @notice Buy stock specifying exact pUSDC spend amount
    function buyStockWithExactUSDC(address stock, uint256 pUSDCSpend)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 stockAmountReceived)
    {
        if (!supportedStocks[stock]) revert UnsupportedStock(stock);
        if (pUSDCSpend == 0) revert ZeroAmount();

        uint256 priceUSD = oracle.getPriceUSD(stock);

        // totalCost = grossUSD * (1 + feeBps/10000)
        // grossUSD = (pUSDCSpend * 10000) / (10000 + feeBps)
        uint256 grossUSD = (pUSDCSpend * BPS_DENOMINATOR) / (BPS_DENOMINATOR + feeBps);
        uint256 feeUSD = pUSDCSpend - grossUSD;
        stockAmountReceived = (grossUSD * STOCK_SCALE) / priceUSD;
        if (stockAmountReceived == 0) revert ZeroAmount();

        uint256 stockAvailable = IERC20(stock).balanceOf(address(this));
        if (stockAvailable < stockAmountReceived) {
            revert InsufficientStockLiquidity(stock, stockAmountReceived, stockAvailable);
        }

        accumulatedFeesUSD += feeUSD;

        pUSDC.safeTransferFrom(_msgSender(), address(this), pUSDCSpend);
        IERC20(stock).safeTransfer(_msgSender(), stockAmountReceived);

        emit StockBought(_msgSender(), stock, stockAmountReceived, pUSDCSpend, feeUSD);
    }

    /// @notice Sell stock to receive pUSDC
    function sellStock(address stock, uint256 stockAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 netPayoutUSD)
    {
        (, uint256 feeUSD, uint256 payout) = quoteSell(stock, stockAmount);

        uint256 usdcAvailable = pUSDC.balanceOf(address(this));
        // Reserve accumulated fees from available trade payout
        uint256 spendableUSDC = usdcAvailable > accumulatedFeesUSD ? usdcAvailable - accumulatedFeesUSD : 0;
        if (spendableUSDC < payout) {
            revert InsufficientUSDCLiquidity(payout, spendableUSDC);
        }

        accumulatedFeesUSD += feeUSD;

        IERC20(stock).safeTransferFrom(_msgSender(), address(this), stockAmount);
        pUSDC.safeTransfer(_msgSender(), payout);

        emit StockSold(_msgSender(), stock, stockAmount, payout, feeUSD);
        return payout;
    }

    /// @notice Withdraw collected protocol fees
    function collectFees(address recipient) external onlyOwner {
        require(recipient != address(0), "Zero address");
        uint256 amount = accumulatedFeesUSD;
        accumulatedFeesUSD = 0;
        pUSDC.safeTransfer(recipient, amount);
        emit FeesCollected(recipient, amount);
    }

    /// @notice Emergency or rebalance withdrawal of market inventory
    function withdrawInventory(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Zero address");
        IERC20(token).safeTransfer(recipient, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
