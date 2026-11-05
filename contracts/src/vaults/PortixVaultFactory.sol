// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./PortixVault.sol";
import "../strategies/MockLendingStrategyAdapter.sol";
import "../strategies/MockAmmStrategyAdapter.sol";

/**
 * @title PortixVaultFactory
 * @notice Factory and registry for PORTIX carry vaults across equities and strategies.
 * @dev Manages the 10 isolated vault instances (5 stocks x 2 strategies)
 *      and coordinates adapter initialization.
 */
contract PortixVaultFactory is Ownable2Step {
    address public immutable pUSDC;
    address public immutable oracle;
    address public immutable debtPool;

    address[] public allVaults;
    // stock => strategyKind => vault address
    mapping(address => mapping(IPortixVault.StrategyKind => address)) public getVault;

    event VaultCreated(
        address indexed stock,
        IPortixVault.StrategyKind indexed strategyKind,
        address vault,
        address strategy
    );

    constructor(
        address pUSDC_,
        address oracle_,
        address debtPool_,
        address initialOwner_
    ) Ownable2Step() Ownable(initialOwner_) {
        require(pUSDC_ != address(0), "Zero pUSDC");
        require(oracle_ != address(0), "Zero oracle");
        require(debtPool_ != address(0), "Zero debtPool");

        pUSDC = pUSDC_;
        oracle = oracle_;
        debtPool = debtPool_;
    }

    /// @notice Returns the total count of deployed vaults
    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Returns all deployed vault addresses
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }

    /// @notice Deploys an isolated vault instance and its matching strategy adapter
    function createVault(
        address stock,
        IPortixVault.StrategyKind strategyKind,
        uint256 targetLtvBps,
        uint256 liquidationLtvBps,
        string memory name,
        string memory symbol
    ) external onlyOwner returns (address vaultAddress, address strategyAddress) {
        require(stock != address(0), "Zero stock address");
        require(getVault[stock][strategyKind] == address(0), "Vault already exists");

        // 1. Deploy appropriate strategy adapter
        if (strategyKind == IPortixVault.StrategyKind.PRIME_LENDING) {
            MockLendingStrategyAdapter lendingStrat = new MockLendingStrategyAdapter(pUSDC, address(this));
            strategyAddress = address(lendingStrat);
        } else {
            MockAmmStrategyAdapter ammStrat = new MockAmmStrategyAdapter(pUSDC, address(this));
            strategyAddress = address(ammStrat);
        }

        // 2. Deploy isolated vault
        PortixVault vault = new PortixVault(
            stock,
            pUSDC,
            oracle,
            debtPool,
            strategyAddress,
            targetLtvBps,
            liquidationLtvBps,
            strategyKind,
            name,
            symbol,
            owner()
        );
        vaultAddress = address(vault);

        // 3. Register in factory state
        getVault[stock][strategyKind] = vaultAddress;
        allVaults.push(vaultAddress);

        // 4. Authorize vault on strategy adapter and transfer adapter ownership to owner()
        if (strategyKind == IPortixVault.StrategyKind.PRIME_LENDING) {
            MockLendingStrategyAdapter(strategyAddress).setVault(vaultAddress);
            MockLendingStrategyAdapter(strategyAddress).transferOwnership(owner());
        } else {
            MockAmmStrategyAdapter(strategyAddress).setVault(vaultAddress);
            MockAmmStrategyAdapter(strategyAddress).transferOwnership(owner());
        }

        emit VaultCreated(stock, strategyKind, vaultAddress, strategyAddress);
    }
}
