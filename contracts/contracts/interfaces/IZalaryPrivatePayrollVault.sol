// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IZalaryPrivatePayrollVault {
    enum PayrollStatus {
        None,
        Draft,
        ComputationRequested,
        Computed,
        FundingReady,
        Active,
        Closed,
        Cancelled
    }

    struct PayrollGatewayContext {
        address institution;
        bytes32 metadataHash;
        bytes32 ciphertextHash;
        bytes32 privateLedgerRoot;
        address stablecoin;
        uint8 stablecoinDecimals;
        PayrollStatus status;
    }

    struct WithdrawalContext {
        address institution;
        bytes32 privateLedgerRoot;
        address stablecoin;
        uint8 stablecoinDecimals;
        PayrollStatus status;
        uint64 withdrawalDeadline;
        uint64 settlementDeadline;
        uint256 pendingWithdrawalRequests;
        uint256 minimumWithdrawalAmount;
    }

    struct PayrollCommitment {
        uint256 payrollId;
        bytes32 metadataHash;
        bytes32 ciphertextHash;
        bytes32 privateLedgerRoot;
        uint256 employeeCount;
        uint256 employeeNetTotal;
        uint256 aggregateTaxTotal;
        uint256 totalRequired;
    }

    struct PrivateWithdrawal {
        bytes32 instructionId;
        uint256 payrollId;
        address stablecoin;
        address destination;
        uint256 amount;
        bytes32 oldLedgerRoot;
        bytes32 newLedgerRoot;
        bytes32 withdrawalNullifier;
        uint64 requestedAt;
        uint64 validUntil;
    }

    function canHR(address institution, address account) external view returns (bool);

    function getPayrollGatewayContext(uint256 payrollId)
        external
        view
        returns (PayrollGatewayContext memory);

    function getWithdrawalContext(uint256 payrollId)
        external
        view
        returns (WithdrawalContext memory);

    function markComputationRequested(uint256 payrollId, bytes32 ciphertextHash) external;

    function resetComputationRequest(uint256 payrollId, bytes32 ciphertextHash) external;

    function commitConfidentialPayroll(PayrollCommitment calldata commitment) external;

    function noteWithdrawalRequestOpened(
        uint256 payrollId,
        bytes32 instructionId,
        uint64 requestedAt
    ) external;

    function noteWithdrawalRequestClosed(uint256 payrollId, bytes32 instructionId) external;

    function executePrivateWithdrawal(PrivateWithdrawal calldata withdrawal) external;
}
