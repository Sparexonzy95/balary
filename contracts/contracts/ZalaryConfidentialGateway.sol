// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ITeeExtensionRegistry, ITeeMachineRegistry} from "./interfaces/IFlareTee.sol";
import {IZalaryPrivatePayrollVault} from "./interfaces/IZalaryPrivatePayrollVault.sol";

/**
 * @title ZalaryConfidentialGateway
 * @notice Flare Confidential Compute bridge for private payroll computation and withdrawals.
 * @dev New withdrawal requests are accepted only from approved relayers. Result finalization
 *      and stale/failure cleanup remain available during a pause so employee requests cannot
 *      be stranded by governance or relayer latency.
 */
contract ZalaryConfidentialGateway is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PROTOCOL_ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    bytes32 public constant OP_TYPE_ZALARY = bytes32("ZALARY_FCC");
    bytes32 public constant OP_COMMAND_PROCESS_PAYROLL = bytes32("PROCESS_PAYROLL");
    bytes32 public constant OP_COMMAND_AUTHORIZE_WITHDRAWAL = bytes32("AUTHORIZE_WITHDRAWAL");

    bytes32 public constant PAYROLL_ENVELOPE_DOMAIN =
        keccak256("ZALARY_FCC_PAYROLL_ENVELOPE_V2");
    bytes32 public constant WITHDRAWAL_ENVELOPE_DOMAIN =
        keccak256("ZALARY_FCC_WITHDRAWAL_ENVELOPE_V3");
    bytes32 public constant PAYROLL_RESULT_DOMAIN =
        keccak256("ZALARY_FCC_PAYROLL_RESULT_V2");
    bytes32 public constant WITHDRAWAL_RESULT_DOMAIN =
        keccak256("ZALARY_FCC_WITHDRAWAL_RESULT_V2");
    bytes32 public constant FAILURE_RESULT_DOMAIN =
        keccak256("ZALARY_FCC_FAILURE_RESULT_V2");

    bytes32 private constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000;
    uint8 private constant ACTION_STATUS_FAILURE = 0;
    uint8 private constant ACTION_STATUS_SUCCESS = 1;

    uint256 public constant MAX_ENCRYPTED_PAYLOAD_BYTES = 48_000;
    uint256 public constant REQUEST_TTL = 15 minutes;
    uint256 public constant MAX_RESULT_VALIDITY = 15 minutes;
    uint256 public constant TEE_SIGNER_ROTATION_DELAY = 0;

    enum RequestType {
        None,
        ProcessPayroll,
        AuthorizeWithdrawal
    }

    struct Request {
        RequestType requestType;
        address institution;
        address selectedTeeId;
        address teeSigner;
        uint64 teeSignerEpoch;
        uint64 requestedAt;
        uint256 extensionId;
        uint256 payrollId;
        bytes32 metadataHash;
        address stablecoin;
        uint8 stablecoinDecimals;
        bytes32 ciphertextHash;
        bytes32 expectedLedgerRoot;
        bool closed;
    }

    struct TeeBinding {
        address signer;
        uint64 epoch;
        bool active;
    }

    struct TeeSignerProposal {
        address signer;
        uint64 executableAt;
    }

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

    struct WithdrawalInstructionEnvelope {
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
        bytes32 expectedLedgerRoot;
        bytes32 requestCommitment;
        bytes32 ciphertextHash;
    }

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

    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;
    IZalaryPrivatePayrollVault public immutable VAULT;

    uint256 private _extensionId;

    mapping(address => TeeBinding) public teeBindings;
    mapping(address => TeeSignerProposal) public pendingTeeSignerProposals;
    mapping(bytes32 => Request) private _requests;
    mapping(uint256 => bytes32) public activePayrollInstruction;
    mapping(uint256 => bytes32) public activeWithdrawalInstruction;

    error ActionAlreadyClosed();
    error ActiveRequestExists();
    error BadPayrollStatus();
    error BadTeeSignature();
    error EmptyCiphertext();
    error ExtensionIdAlreadySet();
    error ExtensionIdNotSet();
    error ExtensionSenderMismatch();
    error InvalidActionStatus();
    error InvalidAddress();
    error InvalidResult();
    error InvalidTeeSelection();
    error NotInstitutionHR();
    error PayloadTooLarge();
    error RequestAlreadyExists();
    error RequestNotFound();
    error RequestNotStale();
    error ResultExpired();
    error ResultLifetimeTooLong();
    error TeeBindingChanged();
    error TeeSignerNotConfigured();
    error TeeSignerProposalNotReady();
    error NativeTransferFailed();

    event ExtensionIdSet(uint256 indexed extensionId);
    event TeeSignerProposed(address indexed teeId, address indexed signer, uint64 executableAt);
    event TeeSignerActivated(address indexed teeId, address indexed signer, uint64 epoch);
    event TeeSignerRevoked(address indexed teeId, address indexed oldSigner, uint64 newEpoch);
    event PayrollComputationRequested(
        bytes32 indexed instructionId,
        uint256 indexed payrollId,
        address indexed institution,
        address selectedTeeId,
        uint64 teeSignerEpoch,
        bytes32 ciphertextHash
    );
    event PayrollComputationFinalized(
        bytes32 indexed instructionId,
        uint256 indexed payrollId,
        bytes32 indexed privateLedgerRoot,
        uint256 employeeCount,
        uint256 employeeNetTotal,
        uint256 aggregateTaxTotal
    );
    event PrivateWithdrawalRequested(
        bytes32 indexed instructionId,
        bytes32 indexed requestCommitment,
        address indexed selectedTeeId,
        uint64 teeSignerEpoch,
        bytes32 ciphertextHash
    );
    event PrivateWithdrawalFinalized(
        bytes32 indexed instructionId,
        bytes32 indexed withdrawalNullifier,
        address indexed destination,
        uint256 amount,
        bytes32 newLedgerRoot
    );
    event ConfidentialRequestFailed(
        bytes32 indexed instructionId,
        RequestType indexed requestType,
        bytes32 indexed errorCodeHash
    );
    event StaleRequestExpired(
        bytes32 indexed instructionId,
        RequestType indexed requestType,
        uint256 indexed payrollId
    );
    event NativeTokenRescued(address indexed to, uint256 amount);

    constructor(
        address protocolAdmin,
        address initialRelayer,
        ITeeExtensionRegistry teeExtensionRegistry,
        ITeeMachineRegistry teeMachineRegistry,
        IZalaryPrivatePayrollVault vault
    ) {
        if (
            protocolAdmin == address(0) ||
            initialRelayer == address(0) ||
            address(teeExtensionRegistry) == address(0) ||
            address(teeMachineRegistry) == address(0) ||
            address(vault) == address(0)
        ) revert InvalidAddress();
        if (
            address(teeExtensionRegistry).code.length == 0 ||
            address(teeMachineRegistry).code.length == 0 ||
            address(vault).code.length == 0
        ) revert InvalidAddress();

        TEE_EXTENSION_REGISTRY = teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = teeMachineRegistry;
        VAULT = vault;
        _grantRole(DEFAULT_ADMIN_ROLE, protocolAdmin);
        _grantRole(RELAYER_ROLE, initialRelayer);
    }

    receive() external payable {}

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /** Explicit one-time extension binding avoids an unbounded registry scan. */
    function setExtensionId(uint256 extensionId_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_extensionId != 0) revert ExtensionIdAlreadySet();
        if (extensionId_ < FIRST_PUBLIC_EXTENSION_ID) revert ExtensionSenderMismatch();
        if (
            TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(extensionId_) !=
            address(this)
        ) revert ExtensionSenderMismatch();
        _extensionId = extensionId_;
        emit ExtensionIdSet(extensionId_);
    }

    function extensionId() external view returns (uint256) {
        return _getExtensionId();
    }

    /**
     * @notice Starts a time-delayed machine-to-signer binding.
     * @dev The supplied signer must be read from the proxy/Flare setup for this exact teeId.
     */
    function proposeTeeSigner(address teeId, address signer)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (teeId == address(0) || signer == address(0)) revert InvalidAddress();
        _assertExtensionRegistration();
        uint64 executableAt = uint64(block.timestamp + TEE_SIGNER_ROTATION_DELAY);
        pendingTeeSignerProposals[teeId] = TeeSignerProposal({
            signer: signer,
            executableAt: executableAt
        });
        emit TeeSignerProposed(teeId, signer, executableAt);
    }

    function activateTeeSigner(address teeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        TeeSignerProposal memory proposal = pendingTeeSignerProposals[teeId];
        if (proposal.signer == address(0) || block.timestamp < proposal.executableAt) {
            revert TeeSignerProposalNotReady();
        }
        TeeBinding storage binding = teeBindings[teeId];
        binding.epoch += 1;
        binding.signer = proposal.signer;
        binding.active = true;
        delete pendingTeeSignerProposals[teeId];
        emit TeeSignerActivated(teeId, binding.signer, binding.epoch);
    }

    /** Emergency revocation invalidates all still-open requests for this machine. */
    function revokeTeeSigner(address teeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        TeeBinding storage binding = teeBindings[teeId];
        address oldSigner = binding.signer;
        binding.epoch += 1;
        binding.signer = address(0);
        binding.active = false;
        delete pendingTeeSignerProposals[teeId];
        emit TeeSignerRevoked(teeId, oldSigner, binding.epoch);
    }

    function requestPayrollComputation(uint256 payrollId, bytes calldata encryptedPayroll)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (bytes32 instructionId)
    {
        _validateCiphertext(encryptedPayroll);
        _assertExtensionRegistration();
        if (activePayrollInstruction[payrollId] != bytes32(0)) revert ActiveRequestExists();

        IZalaryPrivatePayrollVault.PayrollGatewayContext memory context =
            VAULT.getPayrollGatewayContext(payrollId);
        if (!VAULT.canHR(context.institution, msg.sender)) revert NotInstitutionHR();
        if (context.status != IZalaryPrivatePayrollVault.PayrollStatus.Draft) {
            revert BadPayrollStatus();
        }

        bytes32 ciphertextHash = keccak256(encryptedPayroll);
        (address selectedTeeId, TeeBinding memory binding) = _selectBoundTee();
        uint256 extensionId_ = _getExtensionId();

        PayrollInstructionEnvelope memory envelope = PayrollInstructionEnvelope({
            domain: PAYROLL_ENVELOPE_DOMAIN,
            gateway: address(this),
            vault: address(VAULT),
            chainId: block.chainid,
            extensionId: extensionId_,
            selectedTeeId: selectedTeeId,
            teeSignerEpoch: binding.epoch,
            payrollId: payrollId,
            institution: context.institution,
            metadataHash: context.metadataHash,
            stablecoin: context.stablecoin,
            stablecoinDecimals: context.stablecoinDecimals,
            ciphertextHash: ciphertextHash
        });

        instructionId = _sendInstruction(
            selectedTeeId,
            OP_COMMAND_PROCESS_PAYROLL,
            abi.encode(envelope, encryptedPayroll),
            msg.sender,
            msg.value
        );
        if (_requests[instructionId].requestType != RequestType.None) {
            revert RequestAlreadyExists();
        }

        _requests[instructionId] = Request({
            requestType: RequestType.ProcessPayroll,
            institution: context.institution,
            selectedTeeId: selectedTeeId,
            teeSigner: binding.signer,
            teeSignerEpoch: binding.epoch,
            requestedAt: uint64(block.timestamp),
            extensionId: extensionId_,
            payrollId: payrollId,
            metadataHash: context.metadataHash,
            stablecoin: context.stablecoin,
            stablecoinDecimals: context.stablecoinDecimals,
            ciphertextHash: ciphertextHash,
            expectedLedgerRoot: bytes32(0),
            closed: false
        });
        activePayrollInstruction[payrollId] = instructionId;
        VAULT.markComputationRequested(payrollId, ciphertextHash);

        emit PayrollComputationRequested(
            instructionId,
            payrollId,
            context.institution,
            selectedTeeId,
            binding.epoch,
            ciphertextHash
        );
    }

    /** Finalization remains enabled during a pause. */
    function finalizePayrollComputation(
        bytes calldata resultData,
        bytes32 actionId,
        string calldata submissionTag,
        uint8 status,
        bytes calldata signature
    ) external nonReentrant {
        Request storage request = _loadOpenRequest(actionId, RequestType.ProcessPayroll);
        _assertRequestBindingActive(request);
        _verifyActionResult(
            request.teeSigner,
            resultData,
            actionId,
            submissionTag,
            status,
            ACTION_STATUS_SUCCESS,
            signature
        );

        PayrollResult memory result = abi.decode(resultData, (PayrollResult));
        _validatePayrollResult(request, result);

        _closeRequest(actionId, request, false);

        VAULT.commitConfidentialPayroll(
            IZalaryPrivatePayrollVault.PayrollCommitment({
                payrollId: result.payrollId,
                metadataHash: result.metadataHash,
                ciphertextHash: result.ciphertextHash,
                privateLedgerRoot: result.privateLedgerRoot,
                employeeCount: result.employeeCount,
                employeeNetTotal: result.employeeNetTotal,
                aggregateTaxTotal: result.aggregateTaxTotal,
                totalRequired: result.totalRequired
            })
        );

        emit PayrollComputationFinalized(
            actionId,
            result.payrollId,
            result.privateLedgerRoot,
            result.employeeCount,
            result.employeeNetTotal,
            result.aggregateTaxTotal
        );
    }

    /** Only approved Zalary relayers may put a withdrawal into the public instruction lane. */
    function requestPrivateWithdrawal(uint256 payrollId, bytes calldata encryptedWithdrawal)
        external
        payable
        onlyRole(RELAYER_ROLE)
        nonReentrant
        returns (bytes32 instructionId)
    {
        _validateCiphertext(encryptedWithdrawal);
        _assertExtensionRegistration();
        if (activeWithdrawalInstruction[payrollId] != bytes32(0)) {
            revert ActiveRequestExists();
        }

        IZalaryPrivatePayrollVault.WithdrawalContext memory context =
            VAULT.getWithdrawalContext(payrollId);
        if (context.status != IZalaryPrivatePayrollVault.PayrollStatus.Active) {
            revert BadPayrollStatus();
        }
        if (block.timestamp > context.withdrawalDeadline) revert ResultExpired();

        bytes32 ciphertextHash = keccak256(encryptedWithdrawal);
        (address selectedTeeId, TeeBinding memory binding) = _selectBoundTee();
        uint256 extensionId_ = _getExtensionId();
        bytes32 requestCommitment = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                address(VAULT),
                payrollId,
                context.institution,
                context.stablecoin,
                context.stablecoinDecimals,
                context.privateLedgerRoot,
                ciphertextHash
            )
        );

        WithdrawalInstructionEnvelope memory envelope = WithdrawalInstructionEnvelope({
            domain: WITHDRAWAL_ENVELOPE_DOMAIN,
            gateway: address(this),
            vault: address(VAULT),
            chainId: block.chainid,
            extensionId: extensionId_,
            selectedTeeId: selectedTeeId,
            teeSignerEpoch: binding.epoch,
            payrollId: payrollId,
            institution: context.institution,
            stablecoin: context.stablecoin,
            stablecoinDecimals: context.stablecoinDecimals,
            expectedLedgerRoot: context.privateLedgerRoot,
            requestCommitment: requestCommitment,
            ciphertextHash: ciphertextHash
        });

        instructionId = _sendInstruction(
            selectedTeeId,
            OP_COMMAND_AUTHORIZE_WITHDRAWAL,
            abi.encode(envelope, encryptedWithdrawal),
            msg.sender,
            msg.value
        );
        if (_requests[instructionId].requestType != RequestType.None) {
            revert RequestAlreadyExists();
        }

        uint64 requestedAt = uint64(block.timestamp);
        _requests[instructionId] = Request({
            requestType: RequestType.AuthorizeWithdrawal,
            institution: context.institution,
            selectedTeeId: selectedTeeId,
            teeSigner: binding.signer,
            teeSignerEpoch: binding.epoch,
            requestedAt: requestedAt,
            extensionId: extensionId_,
            payrollId: payrollId,
            metadataHash: bytes32(0),
            stablecoin: context.stablecoin,
            stablecoinDecimals: context.stablecoinDecimals,
            ciphertextHash: ciphertextHash,
            expectedLedgerRoot: context.privateLedgerRoot,
            closed: false
        });
        activeWithdrawalInstruction[payrollId] = instructionId;
        VAULT.noteWithdrawalRequestOpened(payrollId, instructionId, requestedAt);

        emit PrivateWithdrawalRequested(
            instructionId,
            requestCommitment,
            selectedTeeId,
            binding.epoch,
            ciphertextHash
        );
    }

    /** Finalization remains enabled during a pause and throughout the settlement grace period. */
    function finalizePrivateWithdrawal(
        bytes calldata resultData,
        bytes32 actionId,
        string calldata submissionTag,
        uint8 status,
        bytes calldata signature
    ) external nonReentrant {
        Request storage request = _loadOpenRequest(actionId, RequestType.AuthorizeWithdrawal);
        _assertRequestBindingActive(request);
        _verifyActionResult(
            request.teeSigner,
            resultData,
            actionId,
            submissionTag,
            status,
            ACTION_STATUS_SUCCESS,
            signature
        );

        WithdrawalResult memory result = abi.decode(resultData, (WithdrawalResult));
        _validateWithdrawalResult(request, result);

        VAULT.executePrivateWithdrawal(
            IZalaryPrivatePayrollVault.PrivateWithdrawal({
                instructionId: actionId,
                payrollId: result.payrollId,
                stablecoin: result.stablecoin,
                destination: result.destination,
                amount: result.amount,
                oldLedgerRoot: result.oldLedgerRoot,
                newLedgerRoot: result.newLedgerRoot,
                withdrawalNullifier: result.withdrawalNullifier,
                requestedAt: result.requestedAt,
                validUntil: result.validUntil
            })
        );

        _closeRequest(actionId, request, false);

        emit PrivateWithdrawalFinalized(
            actionId,
            result.withdrawalNullifier,
            result.destination,
            result.amount,
            result.newLedgerRoot
        );
    }

    /** A TEE-signed failure closes the lane immediately without changing payroll balances. */
    function finalizeFailedRequest(
        bytes calldata resultData,
        bytes32 actionId,
        string calldata submissionTag,
        uint8 status,
        bytes calldata signature
    ) external nonReentrant {
        Request storage request = _loadOpenRequestAnyType(actionId);
        _assertRequestBindingActive(request);
        _verifyActionResult(
            request.teeSigner,
            resultData,
            actionId,
            submissionTag,
            status,
            ACTION_STATUS_FAILURE,
            signature
        );

        FailureResult memory result = abi.decode(resultData, (FailureResult));
        _validateFailureResult(request, result);
        _closeRequest(actionId, request, true);

        emit ConfidentialRequestFailed(actionId, request.requestType, result.errorCodeHash);
    }

    function expireStaleRequest(bytes32 instructionId) external nonReentrant {
        Request storage request = _loadOpenRequestAnyType(instructionId);
        if (block.timestamp <= uint256(request.requestedAt) + REQUEST_TTL) {
            revert RequestNotStale();
        }

        RequestType requestType = request.requestType;
        uint256 payrollId = request.payrollId;
        _closeRequest(instructionId, request, true);
        emit StaleRequestExpired(instructionId, requestType, payrollId);
    }

    function getRequestStatus(bytes32 instructionId)
        external
        view
        returns (
            RequestType requestType,
            address selectedTeeId,
            uint64 teeSignerEpoch,
            uint64 requestedAt,
            bool closed
        )
    {
        Request storage request = _requests[instructionId];
        if (request.requestType == RequestType.None) revert RequestNotFound();
        return (
            request.requestType,
            request.selectedTeeId,
            request.teeSignerEpoch,
            request.requestedAt,
            request.closed
        );
    }

    function getRequestFailureContext(bytes32 actionId)
        external
        view
        returns (
            RequestType requestType,
            address selectedTeeId,
            uint64 teeSignerEpoch,
            uint64 requestedAt,
            uint256 requestExtensionId,
            uint256 payrollId,
            address institution,
            address stablecoin,
            uint8 stablecoinDecimals,
            bytes32 ciphertextHash,
            bytes32 expectedLedgerRoot,
            bool closed
        )
    {
        Request storage request = _requests[actionId];
        if (request.requestType == RequestType.None) revert RequestNotFound();

        return (
            request.requestType,
            request.selectedTeeId,
            request.teeSignerEpoch,
            request.requestedAt,
            request.extensionId,
            request.payrollId,
            request.institution,
            request.stablecoin,
            request.stablecoinDecimals,
            request.ciphertextHash,
            request.expectedLedgerRoot,
            request.closed
        );
    }

    function rescueNative(address payable to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0) || amount == 0) revert InvalidAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
        emit NativeTokenRescued(to, amount);
    }

    function _closeRequest(bytes32 instructionId, Request storage request, bool resetPayroll)
        internal
    {
        request.closed = true;
        if (request.requestType == RequestType.ProcessPayroll) {
            if (activePayrollInstruction[request.payrollId] == instructionId) {
                activePayrollInstruction[request.payrollId] = bytes32(0);
            }
            if (resetPayroll) {
                IZalaryPrivatePayrollVault.PayrollGatewayContext memory context =
                    VAULT.getPayrollGatewayContext(request.payrollId);
                if (
                    context.status == IZalaryPrivatePayrollVault.PayrollStatus.ComputationRequested &&
                    context.ciphertextHash == request.ciphertextHash
                ) {
                    VAULT.resetComputationRequest(request.payrollId, request.ciphertextHash);
                }
            }
        } else {
            if (activeWithdrawalInstruction[request.payrollId] == instructionId) {
                activeWithdrawalInstruction[request.payrollId] = bytes32(0);
            }
            VAULT.noteWithdrawalRequestClosed(request.payrollId, instructionId);
        }
    }

    function _validatePayrollResult(Request storage request, PayrollResult memory result)
        internal
        view
    {
        if (
            result.domain != PAYROLL_RESULT_DOMAIN ||
            result.gateway != address(this) ||
            result.vault != address(VAULT) ||
            result.chainId != block.chainid ||
            result.extensionId != request.extensionId ||
            result.selectedTeeId != request.selectedTeeId ||
            result.teeSignerEpoch != request.teeSignerEpoch ||
            result.payrollId != request.payrollId ||
            result.institution != request.institution ||
            result.metadataHash != request.metadataHash ||
            result.stablecoin != request.stablecoin ||
            result.stablecoinDecimals != request.stablecoinDecimals ||
            result.ciphertextHash != request.ciphertextHash ||
            result.privateLedgerRoot == bytes32(0) ||
            result.employeeCount == 0 ||
            result.employeeNetTotal == 0 ||
            result.totalRequired == 0 ||
            result.totalRequired != result.employeeNetTotal + result.aggregateTaxTotal ||
            result.requestedAt != request.requestedAt
        ) revert InvalidResult();

        _validateResultLifetime(request, result.validUntil);
    }

    function _validateWithdrawalResult(Request storage request, WithdrawalResult memory result)
        internal
        view
    {
        IZalaryPrivatePayrollVault.WithdrawalContext memory context =
            VAULT.getWithdrawalContext(request.payrollId);
        if (
            result.domain != WITHDRAWAL_RESULT_DOMAIN ||
            result.gateway != address(this) ||
            result.vault != address(VAULT) ||
            result.chainId != block.chainid ||
            result.extensionId != request.extensionId ||
            result.selectedTeeId != request.selectedTeeId ||
            result.teeSignerEpoch != request.teeSignerEpoch ||
            result.payrollId != request.payrollId ||
            result.institution != request.institution ||
            result.stablecoin != request.stablecoin ||
            result.stablecoinDecimals != request.stablecoinDecimals ||
            result.ciphertextHash != request.ciphertextHash ||
            result.oldLedgerRoot != request.expectedLedgerRoot ||
            result.newLedgerRoot == bytes32(0) ||
            result.newLedgerRoot == result.oldLedgerRoot ||
            result.destination == address(0) ||
            result.amount < context.minimumWithdrawalAmount ||
            result.withdrawalNullifier == bytes32(0) ||
            result.requestedAt != request.requestedAt ||
            block.timestamp > context.settlementDeadline
        ) revert InvalidResult();

        _validateResultLifetime(request, result.validUntil);
    }

    function _validateFailureResult(Request storage request, FailureResult memory result)
        internal
        view
    {
        if (
            result.domain != FAILURE_RESULT_DOMAIN ||
            result.gateway != address(this) ||
            result.vault != address(VAULT) ||
            result.chainId != block.chainid ||
            result.extensionId != request.extensionId ||
            result.selectedTeeId != request.selectedTeeId ||
            result.teeSignerEpoch != request.teeSignerEpoch ||
            result.requestType != request.requestType ||
            result.payrollId != request.payrollId ||
            result.ciphertextHash != request.ciphertextHash ||
            result.errorCodeHash == bytes32(0) ||
            result.requestedAt != request.requestedAt
        ) revert InvalidResult();

        _validateResultLifetime(request, result.validUntil);
    }

    function _validateResultLifetime(Request storage request, uint64 validUntil)
        internal
        view
    {
        if (validUntil < block.timestamp) revert ResultExpired();
        if (validUntil > uint256(request.requestedAt) + MAX_RESULT_VALIDITY) {
            revert ResultLifetimeTooLong();
        }
    }

    function _verifyActionResult(
        address expectedSigner,
        bytes calldata resultData,
        bytes32 actionId,
        string calldata submissionTag,
        uint8 status,
        uint8 expectedStatus,
        bytes calldata signature
    ) internal view {
        if (status != expectedStatus) revert InvalidActionStatus();

        bytes32 resultHash = keccak256(
            abi.encodePacked(
                keccak256(resultData),
                actionId,
                keccak256(bytes(submissionTag)),
                status
            )
        );
        bytes32 payloadHash = keccak256(
            abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, resultHash)
        );
        address signer = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(payloadHash),
            signature
        );
        if (signer != expectedSigner) revert BadTeeSignature();
    }

    function _sendInstruction(
        address selectedTeeId,
        bytes32 command,
        bytes memory message,
        address claimBackAddress,
        uint256 fee
    ) internal returns (bytes32 instructionId) {
        address[] memory teeIds = new address[](1);
        teeIds[0] = selectedTeeId;
        address[] memory cosigners = new address[](0);

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: fee}(
            teeIds,
            ITeeExtensionRegistry.TeeInstructionParams({
                opType: OP_TYPE_ZALARY,
                opCommand: command,
                message: message,
                cosigners: cosigners,
                cosignersThreshold: 0,
                claimBackAddress: claimBackAddress
            })
        );
        if (instructionId == bytes32(0)) revert InvalidResult();
    }

    function _selectBoundTee()
        internal
        returns (address selectedTeeId, TeeBinding memory binding)
    {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        if (teeIds.length != 1 || teeIds[0] == address(0)) revert InvalidTeeSelection();
        selectedTeeId = teeIds[0];
        binding = teeBindings[selectedTeeId];
        if (!binding.active || binding.signer == address(0)) revert TeeSignerNotConfigured();
    }

    function _assertRequestBindingActive(Request storage request) internal view {
        TeeBinding memory current = teeBindings[request.selectedTeeId];
        if (
            !current.active ||
            current.signer != request.teeSigner ||
            current.epoch != request.teeSignerEpoch
        ) revert TeeBindingChanged();
        _assertExtensionRegistration();
    }

    function _assertExtensionRegistration() internal view {
        uint256 extensionId_ = _getExtensionId();
        if (
            TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(extensionId_) !=
            address(this)
        ) revert ExtensionSenderMismatch();
    }

    function _loadOpenRequest(bytes32 actionId, RequestType expectedType)
        internal
        view
        returns (Request storage request)
    {
        request = _requests[actionId];
        if (request.requestType == RequestType.None) revert RequestNotFound();
        if (request.requestType != expectedType) revert InvalidResult();
        if (request.closed) revert ActionAlreadyClosed();
    }

    function _loadOpenRequestAnyType(bytes32 actionId)
        internal
        view
        returns (Request storage request)
    {
        request = _requests[actionId];
        if (request.requestType == RequestType.None) revert RequestNotFound();
        if (request.closed) revert ActionAlreadyClosed();
    }

    function _validateCiphertext(bytes calldata ciphertext) internal pure {
        if (ciphertext.length == 0) revert EmptyCiphertext();
        if (ciphertext.length > MAX_ENCRYPTED_PAYLOAD_BYTES) revert PayloadTooLarge();
    }

    function _getExtensionId() internal view returns (uint256) {
        if (_extensionId == 0) revert ExtensionIdNotSet();
        return _extensionId;
    }
}
