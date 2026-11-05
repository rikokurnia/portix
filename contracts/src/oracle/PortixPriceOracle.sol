// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IPortixPriceOracle.sol";

/**
 * @title PortixPriceOracle
 * @notice Configurable price oracle for PORTIX stock collateral valuation.
 * @dev Prices are standardized to 6 decimals (matching pUSDC: $1.00 = 1_000_000).
 *      Enforces freshness checks (heartbeat) and bounds checking to prevent flash crash exploits.
 */
contract PortixPriceOracle is IPortixPriceOracle, Ownable2Step, Pausable {
    struct PriceRecord {
        uint256 price;
        uint256 updatedAt;
        uint256 minPrice;
        uint256 maxPrice;
        bool isConfigured;
    }

    uint256 public maxPriceAge; // Heartbeat in seconds (e.g. 3600 = 1 hour)
    mapping(address => PriceRecord) private _prices;

    constructor(address initialOwner_, uint256 maxPriceAge_)
        Ownable2Step()
        Ownable(initialOwner_)
    {
        require(maxPriceAge_ > 0, "Heartbeat must be > 0");
        maxPriceAge = maxPriceAge_;
    }

    /// @notice Update maximum allowable price age (heartbeat)
    function setMaxPriceAge(uint256 newMaxAge) external onlyOwner {
        require(newMaxAge > 0, "Heartbeat must be > 0");
        maxPriceAge = newMaxAge;
        emit HeartbeatUpdated(newMaxAge);
    }

    /// @notice Configure a supported token with sanity bounds
    function configureToken(
        address token,
        uint256 minPrice,
        uint256 maxPrice
    ) external onlyOwner {
        require(token != address(0), "Zero address");
        require(maxPrice > minPrice, "Invalid bounds");
        require(minPrice > 0, "Min price must be > 0");

        PriceRecord storage record = _prices[token];
        record.minPrice = minPrice;
        record.maxPrice = maxPrice;
        record.isConfigured = true;
    }

    /// @notice Sets the price for a supported token
    function setPrice(address token, uint256 priceUSD6) external onlyOwner whenNotPaused {
        _setPriceInternal(token, priceUSD6, block.timestamp);
    }

    /// @notice Sets price with custom timestamp (primarily for test harness and simulation)
    function setPriceWithTimestamp(
        address token,
        uint256 priceUSD6,
        uint256 timestamp
    ) external onlyOwner whenNotPaused {
        _setPriceInternal(token, priceUSD6, timestamp);
    }

    function _setPriceInternal(
        address token,
        uint256 priceUSD6,
        uint256 timestamp
    ) internal {
        PriceRecord storage record = _prices[token];
        if (!record.isConfigured) revert TokenNotSupported(token);
        if (priceUSD6 == 0) revert OraclePriceZero(token);
        if (priceUSD6 < record.minPrice || priceUSD6 > record.maxPrice) {
            revert OraclePriceOutOfBounds(token, priceUSD6, record.minPrice, record.maxPrice);
        }

        record.price = priceUSD6;
        record.updatedAt = timestamp;

        emit PriceUpdated(token, priceUSD6, timestamp);
    }

    /// @inheritdoc IPortixPriceOracle
    function getPrice(address token)
        external
        view
        override
        returns (uint256 price, uint8 decimals, uint256 updatedAt)
    {
        PriceRecord memory record = _prices[token];
        if (!record.isConfigured) revert TokenNotSupported(token);
        return (record.price, 6, record.updatedAt);
    }

    /// @inheritdoc IPortixPriceOracle
    function getPriceUSD(address token)
        public
        view
        override
        whenNotPaused
        returns (uint256 priceUSD6)
    {
        PriceRecord memory record = _prices[token];
        if (!record.isConfigured) revert TokenNotSupported(token);
        if (record.price == 0) revert OraclePriceZero(token);

        if (block.timestamp > record.updatedAt + maxPriceAge) {
            revert OraclePriceStale(token, record.updatedAt, maxPriceAge);
        }

        if (record.price < record.minPrice || record.price > record.maxPrice) {
            revert OraclePriceOutOfBounds(token, record.price, record.minPrice, record.maxPrice);
        }

        return record.price;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
