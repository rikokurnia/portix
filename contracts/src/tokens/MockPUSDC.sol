// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title MockPUSDC
 * @notice Mock testnet settlement stablecoin for the PORTIX prototype on Portaldot V3.
 * @dev Explicitly uses 6 decimals matching standard USDC.
 */
contract MockPUSDC is ERC20, Ownable2Step {
    uint256 public constant MAX_FAUCET_PER_REQUEST = 100_000 * 1e6; // 100k pUSDC

    event FaucetMinted(address indexed recipient, uint256 amount);

    constructor(address initialOwner_)
        ERC20("Portaldot USD Coin", "pUSDC")
        Ownable2Step()
        Ownable(initialOwner_)
    {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Owner mint for seeding protocol liquidity (debt pool, market inventory)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Controlled faucet for testnet users
    function faucet(address to, uint256 amount) external {
        require(amount <= MAX_FAUCET_PER_REQUEST, "Faucet amount exceeds max cap");
        _mint(to, amount);
        emit FaucetMinted(to, amount);
    }

    /// @notice Burn tokens
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
}
