// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title MockStockToken
 * @notice Mock tokenized equity token for the PORTIX prototype on Portaldot V3.
 * @dev DISCLAIMER: This token is a testnet development asset and does NOT represent
 *      a legally registered security, stock, equity share, or custodial broker-dealer claim.
 */
contract MockStockToken is ERC20, Ownable2Step {
    uint8 private immutable _decimals;

    event FaucetMinted(address indexed recipient, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable2Step() Ownable(initialOwner_) {
        _decimals = 18;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Allows the owner or testing harness to mint tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Public faucet for testnet users with a reasonable cap
    function faucet(address to, uint256 amount) external {
        // Limit faucet mint to max 1,000 units per request to prevent spam
        require(amount <= 1_000 * 10**18, "Faucet amount exceeds 1000 limit");
        _mint(to, amount);
        emit FaucetMinted(to, amount);
    }

    /// @notice Burns tokens from caller
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
}
