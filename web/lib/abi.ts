// Demo-only — mirrors contracts/src/mocks/MockDrainer.sol. See app/demo/scam-airdrop/page.tsx.
export const mockDrainerAbi = [
  {
    type: "function",
    name: "drain",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "victim", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

// Mirrors backend/src/chain/policyVaultAbi.ts — the subset the browser wallet needs to call
// bindPolicy() directly (self-custody: the user's own wallet pays the premium, never the backend).
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
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
