// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";

contract PreflightCheck is Script {
    uint256 public constant EXPECTED_CHAIN_ID = 420420777;
    uint256 public constant MIN_RECOMMENDED_GAS_BALANCE = 1e14; // in native units

    function run() external view {
        console.log("====================================================");
        console.log("      PORTIX Portaldot V3 EVM Preflight Check       ");
        console.log("====================================================");

        // 1. Chain ID Check
        uint256 currentChainId = block.chainid;
        console.log("Current Chain ID:", currentChainId);
        if (currentChainId == EXPECTED_CHAIN_ID) {
            console.log("[PASS] Chain ID matches Portaldot V3 EVM testnet (420420777).");
        } else {
            console.log("[WARN] Running in local simulation (Chain ID does not match 420420777).");
        }

        // 2. Deployer Check
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address deployer = deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : msg.sender;
        console.log("Deployer Address:", deployer);

        uint256 nativeBalance = deployer.balance;
        console.log("Deployer Native Gas Balance (wei):", nativeBalance);

        if (nativeBalance > 0) {
            console.log("[PASS] Deployer wallet has native gas balance.");
        } else {
            console.log("[INFO] Deployer balance is 0. User must fund wallet via Portaldot V3 faucet prior to live broadcast.");
        }

        // 3. Configuration Checks
        uint256 heartbeat = vm.envOr("ORACLE_HEARTBEAT_SECONDS", uint256(3600));
        uint256 targetLtv = vm.envOr("VAULT_TARGET_LTV_BPS", uint256(4000));
        uint256 liqLtv = vm.envOr("VAULT_LIQUIDATION_LTV_BPS", uint256(8000));

        console.log("Oracle Heartbeat (seconds):", heartbeat);
        console.log("Target Borrow LTV (bps):", targetLtv);
        console.log("Liquidation Threshold (bps):", liqLtv);

        require(targetLtv < liqLtv, "Preflight Fail: Target LTV must be < Liquidation LTV");
        require(heartbeat > 0, "Preflight Fail: Heartbeat must be > 0");

        console.log("====================================================");
        console.log("[STATUS] Preflight Verification Successful. Ready for Dry-Run.");
        console.log("====================================================");
    }
}
