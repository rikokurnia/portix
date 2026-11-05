// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPortixPriceOracle {
    error OraclePriceStale(address token, uint256 updatedAt, uint256 maxAge);
    error OraclePriceOutOfBounds(address token, uint256 price, uint256 minPrice, uint256 maxPrice);
    error OraclePriceZero(address token);
    error TokenNotSupported(address token);

    event PriceUpdated(address indexed token, uint256 priceUSD6, uint256 timestamp);
    event HeartbeatUpdated(uint256 newHeartbeat);

    /// @notice Returns raw price, decimals, and last update timestamp
    function getPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 updatedAt);

    /// @notice Returns the validated, fresh price scaled to 6 decimals (pUSDC format, 1 USD = 1e6)
    function getPriceUSD(address token) external view returns (uint256 priceUSD6);
}
