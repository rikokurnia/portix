// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title PortixStockToken
 * @notice Standard ERC-20 token representing a tokenized equity with 18 decimals.
 * @dev Supports minting/burning by authorized minters (e.g. market/protocol) and public test faucet.
 */
contract PortixStockToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isMinter;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterSet(address indexed minter, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner, "Not authorized minter");
        _;
    }

    constructor(string memory name_, string memory symbol_, address initialOwner) {
        require(initialOwner != address(0), "Zero owner");
        name = name_;
        symbol = symbol_;
        owner = initialOwner;
        isMinter[initialOwner] = true;
    }

    function setMinter(address minter, bool active) external onlyOwner {
        isMinter[minter] = active;
        emit MinterSet(minter, active);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Zero address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "Zero address");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Zero address");
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "Insufficient allowance");
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        require(balanceOf[from] >= amount, "Insufficient balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyMinter returns (bool) {
        require(to != address(0), "Zero address");
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
        return true;
    }

    function burn(address from, uint256 amount) external onlyMinter returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance to burn");
        unchecked {
            balanceOf[from] -= amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
        return true;
    }

    /// @notice Public test faucet for developers and testnet users
    function faucet(address to, uint256 amount) external {
        require(to != address(0), "Zero address");
        require(amount <= 100 ether, "Faucet limit exceeded (max 100 shares)");
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }
}
