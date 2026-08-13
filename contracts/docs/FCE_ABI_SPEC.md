# Zalary FCE ABI Specification v2

The Go FCE and Solidity gateway must use these exact ABI field orders.

## Common ActionResult signing

The TEE signs the Flare `ActionResult` payload used by the gateway:

```text
resultHash = keccak256(
  keccak256(resultData) || actionId || keccak256(submissionTag) || status
)
payloadHash = keccak256(abi.encode("TEE_ACTION_RESULT", chainId, resultHash))
signature = personal_sign(payloadHash)
```

`status = 1` for success and `status = 0` for failure.

## PROCESS_PAYROLL envelope

```solidity
struct PayrollInstructionEnvelope {
    bytes32 domain;
    address gateway;
    address vault;
    uint256 chainId;
    uint256 extensionId;
    address selectedTeeId;
    uint64 teeSignerEpoch;
    uint256 payrollId;
    address institution;
    bytes32 metadataHash;
    address stablecoin;
    uint8 stablecoinDecimals;
    bytes32 ciphertextHash;
}
```

Message:

```solidity
abi.encode(envelope, encryptedPayroll)
```

The FCE must verify `keccak256(encryptedPayroll) == ciphertextHash` before decrypting.

## Payroll success result

```solidity
struct PayrollResult {
    bytes32 domain;
    address gateway;
    address vault;
    uint256 chainId;
    uint256 extensionId;
    address selectedTeeId;
    uint64 teeSignerEpoch;
    uint256 payrollId;
    address institution;
    bytes32 metadataHash;
    address stablecoin;
    uint8 stablecoinDecimals;
    bytes32 ciphertextHash;
    bytes32 privateLedgerRoot;
    uint256 employeeCount;
    uint256 employeeNetTotal;
    uint256 aggregateTaxTotal;
    uint256 totalRequired;
    uint64 requestedAt;
    uint64 validUntil;
}
```

Rules:

- `totalRequired = employeeNetTotal + aggregateTaxTotal`
- all monetary values are stablecoin atomic units;
- `validUntil <= requestedAt + 15 minutes`;
- `privateLedgerRoot != 0`;
- employee count and net total are nonzero.

## AUTHORIZE_WITHDRAWAL envelope

```solidity
struct WithdrawalInstructionEnvelope {
    bytes32 domain;
    address gateway;
    address vault;
    uint256 chainId;
    uint256 extensionId;
    address selectedTeeId;
    uint64 teeSignerEpoch;
    bytes32 requestCommitment;
    bytes32 ciphertextHash;
}
```

Message:

```solidity
abi.encode(envelope, encryptedWithdrawal)
```

The encrypted payload must contain and authenticate:

- payroll ID;
- institution;
- employee authentication wallet;
- employee-signed withdrawal intent;
- destination;
- amount;
- employee nonce;
- current private-ledger root;
- request expiry.

The FCE must reconstruct and verify `requestCommitment` from the decrypted values and public envelope bindings.

## Withdrawal success result

```solidity
struct WithdrawalResult {
    bytes32 domain;
    address gateway;
    address vault;
    uint256 chainId;
    uint256 extensionId;
    address selectedTeeId;
    uint64 teeSignerEpoch;
    uint256 payrollId;
    address institution;
    address stablecoin;
    uint8 stablecoinDecimals;
    bytes32 ciphertextHash;
    bytes32 oldLedgerRoot;
    bytes32 newLedgerRoot;
    address destination;
    uint256 amount;
    bytes32 withdrawalNullifier;
    uint64 requestedAt;
    uint64 validUntil;
}
```

The FCE must:

1. verify the employee signature;
2. verify the employee nonce;
3. verify sufficient private balance;
4. subtract the amount;
5. generate a deterministic unique nullifier;
6. persist the encrypted state transition;
7. return the exact old and new roots.

## Failure result

```solidity
struct FailureResult {
    bytes32 domain;
    address gateway;
    address vault;
    uint256 chainId;
    uint256 extensionId;
    address selectedTeeId;
    uint64 teeSignerEpoch;
    RequestType requestType;
    uint256 payrollId;
    bytes32 ciphertextHash;
    bytes32 errorCodeHash;
    uint64 requestedAt;
    uint64 validUntil;
}
```

Return this with ActionResult `status = 0`. Use a hash of a stable error code, for example:

```text
keccak256("INVALID_EMPLOYEE_SIGNATURE")
keccak256("INSUFFICIENT_PRIVATE_BALANCE")
keccak256("DUPLICATE_EMPLOYEE_NONCE")
keccak256("CIPHERTEXT_DECRYPTION_FAILED")
```

Do not return employee names, balances or plaintext error details onchain.

## Domains

Read domains directly from the deployed gateway:

- `PAYROLL_ENVELOPE_DOMAIN()`
- `WITHDRAWAL_ENVELOPE_DOMAIN()`
- `PAYROLL_RESULT_DOMAIN()`
- `WITHDRAWAL_RESULT_DOMAIN()`
- `FAILURE_RESULT_DOMAIN()`

Never hard-code an earlier v1 domain.
