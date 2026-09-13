// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockDrainer} from "../src/mocks/MockDrainer.sol";

/// @notice forge script script/DeployMockDrainer.s.sol --rpc-url arc_testnet --broadcast -vvvv
/// DEMO ONLY — see MockDrainer.sol's doc comment. Requires env: PRIVATE_KEY, POLICY_VAULT_ADDRESS
/// (every drain forwards what it pulls straight into that vault's reserve).
contract DeployMockDrainer is Script {
    function run() external returns (MockDrainer drainer) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address vault = vm.envAddress("POLICY_VAULT_ADDRESS");

        vm.startBroadcast(deployerKey);
        drainer = new MockDrainer(vault);
        vm.stopBroadcast();

        console.log("MockDrainer deployed at:", address(drainer));
        console.log("  forwarding drained funds to vault:", vault);
    }
}
