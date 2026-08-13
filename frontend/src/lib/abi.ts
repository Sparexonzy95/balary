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
] as const;

export const balaryPayrollManagerAbi = [
  {
    type: "function",
    name: "registerMyInstitution",
    stateMutability: "nonpayable",
    inputs: [
      { name: "treasury", type: "address" },
      { name: "taxVault", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setInstitutionHR",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institution", type: "address" },
      { name: "account", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setInstitutionFinance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institution", type: "address" },
      { name: "account", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "createPayrollDraftAuto",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institution", type: "address" },
      { name: "metadataHash", type: "bytes32" },
      { name: "defaultToken", type: "address" },
      { name: "claimDeadline", type: "uint64" },
    ],
    outputs: [{ name: "payrollId", type: "uint256" }],
  },
  {
    type: "function",
    name: "createPayrollDraftAuto",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institution", type: "address" },
      { name: "metadataHash", type: "bytes32" },
      { name: "defaultToken", type: "address" },
      { name: "fundingStartsAt", type: "uint64" },
      { name: "claimDeadline", type: "uint64" },
    ],
    outputs: [{ name: "payrollId", type: "uint256" }],
  },
  {
    type: "function",
    name: "uploadPayroll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payrollId", type: "uint256" },
      { name: "metadataHash", type: "bytes32" },
      { name: "paymentsRoot", type: "bytes32" },
      { name: "totalPayments", type: "uint256" },
      { name: "totalGrossAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "activatePayrollForFunding",
    stateMutability: "nonpayable",
    inputs: [{ name: "payrollId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundPayroll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payrollId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payrollId", type: "uint256" },
      {
        name: "payment",
        type: "tuple",
        components: [
          { name: "employee", type: "address" },
          { name: "token", type: "address" },
          { name: "net", type: "uint256" },
          { name: "tax", type: "uint256" },
          { name: "encryptedRef", type: "bytes32" },
          { name: "payrollIndex", type: "uint32" },
        ],
      },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;
