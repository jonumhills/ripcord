// Mirrors contracts/src/PolicyVault.sol. Keep these two in sync by hand — regenerate with
// `forge inspect PolicyVault abi` after any contract change and paste the result in here.
export const policyVaultAbi = [
  {
    type: "function",
    name: "bindPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "addresses", type: "address[]" },
      { name: "payoutAddress", type: "address" },
      { name: "coverageCap", type: "uint256" },
      { name: "premium", type: "uint256" },
      { name: "duration", type: "uint64" },
    ],
    outputs: [{ name: "policyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "payClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "triggerAddress", type: "address" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "policies",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [
      { name: "holder", type: "address" },
      { name: "payoutAddress", type: "address" },
      { name: "coverageCap", type: "uint256" },
      { name: "premiumPaid", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "expiry", type: "uint64" },
      { name: "claimed", type: "bool" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getCoveredAddresses",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getPoliciesFor",
    stateMutability: "view",
    inputs: [{ name: "covered", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "event",
    name: "PolicyBound",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "payoutAddress", type: "address", indexed: false },
      { name: "coveredAddresses", type: "address[]", indexed: false },
      { name: "coverageCap", type: "uint256", indexed: false },
      { name: "premiumPaid", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ClaimPaid",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "triggerAddress", type: "address", indexed: true },
      { name: "payoutAddress", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
