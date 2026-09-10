// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC20 interface — avoids requiring an OpenZeppelin install for the hackathon scaffold.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title PolicyVault
/// @notice Holds pooled USDC premiums and pays out parametric claims automatically.
/// No claims form, no vote — the `claimsAgent` (an off-chain service watching The Graph
/// for flagged-destination drains) is the only address allowed to trigger a payout, and it can
/// only pay out a policy that is active, unexpired, and unclaimed, up to its fixed coverage cap.
contract PolicyVault {
    struct Policy {
        address holder;          // who bound the policy / paid the premium
        address payoutAddress;   // where a claim pays out — deliberately separate from `holder`,
                                  // in case the insured wallet's key itself gets compromised long-term
        uint256 coverageCap;     // fixed payout amount in USDC (parametric, not loss-assessed)
        uint256 premiumPaid;
        uint64 startTime;
        uint64 expiry;
        bool claimed;
        bool active;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public claimsAgent;

    uint256 public nextPolicyId;
    mapping(uint256 => Policy) public policies;
    // All addresses covered under a policy (supports multi-address bundles from the extension/web quote flow).
    mapping(uint256 => address[]) public coveredAddresses;
    // Reverse index: covered address -> policy ids, so the monitor can look up coverage for a flagged event.
    mapping(address => uint256[]) public policiesByAddress;

    event PolicyBound(
        uint256 indexed policyId,
        address indexed holder,
        address payoutAddress,
        address[] coveredAddresses,
        uint256 coverageCap,
        uint256 premiumPaid,
        uint64 expiry
    );

    event ClaimPaid(
        uint256 indexed policyId,
        address indexed triggerAddress,
        address payoutAddress,
        uint256 amount,
        bytes32 evidenceHash
    );

    event ClaimsAgentUpdated(address indexed newAgent);

    error NotOwner();
    error NotClaimsAgent();
    error PolicyNotActive();
    error PolicyExpired();
    error AlreadyClaimed();
    error NoCoveredAddresses();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyClaimsAgent() {
        if (msg.sender != claimsAgent) revert NotClaimsAgent();
        _;
    }

    constructor(address usdcAddress, address initialClaimsAgent) {
        if (usdcAddress == address(0) || initialClaimsAgent == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
        owner = msg.sender;
        claimsAgent = initialClaimsAgent;
    }

    /// @notice Bind a new policy. Caller must have approved this contract for `premium` USDC beforehand.
    /// @param addresses The wallet(s) being insured — one policy can cover a bundle.
    /// @param payoutAddress Where a future claim pays out. Can differ from any covered address.
    /// @param coverageCap Fixed USDC payout if a covered trigger fires.
    /// @param premium USDC premium charged now, pooled into the vault.
    /// @param duration Coverage length in seconds from now.
    function bindPolicy(
        address[] calldata addresses,
        address payoutAddress,
        uint256 coverageCap,
        uint256 premium,
        uint64 duration
    ) external returns (uint256 policyId) {
        if (addresses.length == 0) revert NoCoveredAddresses();
        if (payoutAddress == address(0)) revert ZeroAddress();

        // Checks-effects-interactions: all internal state is written before the external
        // transferFrom call below, not after — the earlier version called out to the USDC
        // contract first, which is the wrong order even though standard USDC has no reentrant
        // callback today.
        policyId = nextPolicyId++;
        uint64 expiry = uint64(block.timestamp) + duration;

        policies[policyId] = Policy({
            holder: msg.sender,
            payoutAddress: payoutAddress,
            coverageCap: coverageCap,
            premiumPaid: premium,
            startTime: uint64(block.timestamp),
            expiry: expiry,
            claimed: false,
            active: true
        });

        coveredAddresses[policyId] = addresses;
        for (uint256 i = 0; i < addresses.length; i++) {
            policiesByAddress[addresses[i]].push(policyId);
        }

        emit PolicyBound(policyId, msg.sender, payoutAddress, addresses, coverageCap, premium, expiry);

        // Interaction last: pull the premium only after every state write above has landed.
        bool ok = usdc.transferFrom(msg.sender, address(this), premium);
        require(ok, "premium transfer failed");
    }

    /// @notice Called only by the claims agent once it has independently verified an on-chain drain
    /// against a covered address. Pays the full coverage cap — parametric, not loss-assessed.
    function payClaim(uint256 policyId, address triggerAddress, bytes32 evidenceHash) external onlyClaimsAgent {
        Policy storage policy = policies[policyId];
        if (!policy.active) revert PolicyNotActive();
        if (block.timestamp > policy.expiry) revert PolicyExpired();
        if (policy.claimed) revert AlreadyClaimed();

        policy.claimed = true;
        policy.active = false;

        bool ok = usdc.transfer(policy.payoutAddress, policy.coverageCap);
        require(ok, "payout transfer failed");

        emit ClaimPaid(policyId, triggerAddress, policy.payoutAddress, policy.coverageCap, evidenceHash);
    }

    function getCoveredAddresses(uint256 policyId) external view returns (address[] memory) {
        return coveredAddresses[policyId];
    }

    function getPoliciesFor(address covered) external view returns (uint256[] memory) {
        return policiesByAddress[covered];
    }

    function setClaimsAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        claimsAgent = newAgent;
        emit ClaimsAgentUpdated(newAgent);
    }

    /// @notice Demo/testnet-only escape hatch to recover unclaimed reserve. Remove before any real deployment.
    function withdrawReserve(uint256 amount, address to) external onlyOwner {
        bool ok = usdc.transfer(to, amount);
        require(ok, "withdraw failed");
    }
}
