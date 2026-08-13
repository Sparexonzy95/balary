// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IZalaryPrivatePayrollVault} from "./interfaces/IZalaryPrivatePayrollVault.sol";

/**
 * @title ZalaryPrivatePayrollVault
 * @notice Stablecoin escrow for payrolls computed by a Flare Compute Extension.
 * @dev Employee rows and private balances never enter this contract. The vault stores
 *      aggregate totals and a rolling commitment to the FCE's private ledger.
 */
contract ZalaryPrivatePayrollVault is
    IZalaryPrivatePayrollVault,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    bytes32 public constant PROTOCOL_ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    uint256 public constant MIN_FUNDING_WINDOW = 1 hours;
    uint256 public constant MIN_ACTIVE_WITHDRAWAL_WINDOW = 1 hours;
    uint256 public constant MAX_ACTIVE_WITHDRAWAL_WINDOW = 90 days;
    uint256 public constant MIN_SETTLEMENT_GRACE_PERIOD = 15 minutes;
    uint256 public constant MAX_SETTLEMENT_GRACE_PERIOD = 7 days;
    uint256 public constant ADMIN_RECOVERY_DELAY = 2 days;
    uint256 public constant ADMIN_TRANSFER_EXPIRY = 7 days;
    uint256 public constant MAX_EMPLOYEE_COUNT = type(uint32).max;

    struct Institution {
        bool registered;
        bool active;
        address treasury;
        address taxVault;
    }

    struct PayrollData {
        address institution;
        address createdBy;
        address treasury;
        address taxVault;
        bytes32 metadataHash;
        bytes32 ciphertextHash;
        bytes32 privateLedgerRoot;
        uint256 employeeCount;
        uint256 employeeNetTotal;
        uint256 aggregateTaxTotal;
        uint256 totalRequired;
        uint256 fundedAmount;
        uint256 netWithdrawnAmount;
        uint256 taxPaidAmount;
        uint256 minimumWithdrawalAmount;
        uint256 pauseSecondsAtCreation;
        uint256 pauseSecondsAtActivation;
        uint256 pendingWithdrawalRequests;
        uint64 fundingStartsAt;
        uint64 fundingDeadline;
        uint64 minimumWithdrawalWindow;
        uint64 settlementGracePeriod;
        uint64 activatedAt;
        uint64 withdrawalDeadline;
        uint64 settlementDeadline;
        PayrollStatus status;
    }

    struct AdminTransfer {
        address from;
        address to;
        uint64 expiresAt;
    }

    struct AdminRecovery {
        address newAdmin;
        uint64 executableAt;
    }

    IERC20 public immutable STABLECOIN;
    uint8 public immutable STABLECOIN_DECIMALS;

    address public confidentialGateway;
    uint256 public nextPayrollId = 1;
    uint256 public totalEscrowed;
    uint256 public defaultMinimumWithdrawalAmount;

    uint64 public pauseStartedAt;
    uint256 public accumulatedPausedSeconds;

    mapping(address => Institution) public institutions;
    mapping(address => mapping(address => bool)) public institutionAdmins;
    mapping(address => mapping(address => bool)) public institutionHR;
    mapping(address => mapping(address => bool)) public institutionFinance;
    mapping(address => uint256) public institutionAdminCount;
    mapping(address => AdminTransfer) public pendingAdminTransfers;
    mapping(address => AdminRecovery) public pendingAdminRecoveries;

    mapping(uint256 => PayrollData) private _payrolls;
    mapping(bytes32 => bool) public usedWithdrawalNullifiers;
    mapping(bytes32 => uint256) public pendingWithdrawalInstructionPayroll;

    error AdminRecoveryNotReady();
    error AdminTransferExpired();
    error AdminTransferMissing();
    error BadStatus();
    error ComputationHashMismatch();
    error ConfidentialGatewayAlreadySet();
    error DeadlinePassed();
    error DeadlineNotReached();
    error FeeOnTransferDetected();
    error FundingNotOpen();
    error InstitutionExists();
    error InstitutionInactive();
    error InstitutionNotRegistered();
    error InsufficientEscrow();
    error InvalidAddress();
    error InvalidCommitment();
    error InvalidDeadline();
    error InvalidStablecoin();
    error InvalidTokenDecimals();
    error InvalidWithdrawal();
    error LastInstitutionAdmin();
    error NativeTransferFailed();
    error NotAuthorized();
    error PayrollExists();
    error PendingWithdrawalExists();
    error RequestAlreadyTracked();
    error RequestNotTracked();
    error StablecoinRescueForbidden();
    error UnauthorizedGateway();
    error UnknownPayroll();
    error WithdrawalAlreadyUsed();
    error WithdrawalExpired();
    error ZeroAmount();

    event InstitutionRegistered(
        address indexed institution,
        address indexed institutionAdmin,
        address indexed treasury,
        address taxVault
    );
    event InstitutionActiveUpdated(address indexed institution, bool active);
    event InstitutionAdminUpdated(address indexed institution, address indexed account, bool approved);
    event InstitutionAdminTransferProposed(
        address indexed institution,
        address indexed from,
        address indexed to,
        uint64 expiresAt
    );
    event InstitutionAdminTransferred(address indexed institution, address indexed from, address indexed to);
    event InstitutionAdminRecoveryProposed(
        address indexed institution,
        address indexed newAdmin,
        uint64 executableAt
    );
    event InstitutionAdminRecovered(address indexed institution, address indexed newAdmin);
    event InstitutionHRUpdated(address indexed institution, address indexed account, bool approved);
    event InstitutionFinanceUpdated(address indexed institution, address indexed account, bool approved);
    event InstitutionTreasuryUpdated(address indexed institution, address indexed oldTreasury, address indexed newTreasury);
    event InstitutionTaxVaultUpdated(address indexed institution, address indexed oldTaxVault, address indexed newTaxVault);
    event ConfidentialGatewaySet(address indexed gateway);
    event DefaultMinimumWithdrawalAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event ProtocolPaused(uint64 startedAt);
    event ProtocolUnpaused(uint64 endedAt, uint256 pausedSeconds, uint256 cumulativePausedSeconds);

    event PayrollDraftCreated(
        uint256 indexed payrollId,
        address indexed institution,
        address indexed createdBy,
        bytes32 metadataHash,
        uint64 fundingStartsAt,
        uint64 fundingDeadline,
        uint64 minimumWithdrawalWindow,
        uint64 settlementGracePeriod
    );
    event PayrollComputationRequested(uint256 indexed payrollId, bytes32 indexed ciphertextHash);
    event PayrollComputationReset(uint256 indexed payrollId, bytes32 indexed ciphertextHash);
    event ConfidentialPayrollCommitted(
        uint256 indexed payrollId,
        bytes32 indexed privateLedgerRoot,
        bytes32 indexed ciphertextHash,
        uint256 employeeCount,
        uint256 employeeNetTotal,
        uint256 aggregateTaxTotal,
        uint256 totalRequired
    );
    event PayrollFundingOpened(uint256 indexed payrollId);
    event PayrollFunded(
        uint256 indexed payrollId,
        address indexed funder,
        uint256 amount,
        uint256 fundedAmount,
        uint256 totalRequired
    );
    event PayrollActivated(
        uint256 indexed payrollId,
        uint64 activatedAt,
        uint64 withdrawalDeadline,
        uint64 settlementDeadline,
        uint256 employeeEscrow,
        uint256 aggregateTaxPaid
    );
    event WithdrawalRequestTracked(uint256 indexed payrollId, bytes32 indexed instructionId, uint64 requestedAt);
    event WithdrawalRequestUntracked(uint256 indexed payrollId, bytes32 indexed instructionId);
    event PrivateWithdrawalExecuted(
        bytes32 indexed instructionId,
        bytes32 indexed withdrawalNullifier,
        address indexed destination,
        uint256 amount,
        bytes32 newLedgerRoot
    );
    event PayrollClosed(uint256 indexed payrollId, uint256 remainingReturned);
    event PayrollCancelled(uint256 indexed payrollId, uint256 refundedAmount, bytes32 reasonHash);
    event ForeignTokenRescued(address indexed token, address indexed to, uint256 amount);
    event StablecoinSurplusRescued(address indexed to, uint256 amount);
    event NativeTokenRescued(address indexed to, uint256 amount);

    constructor(
        address protocolAdmin,
        address stablecoin,
        uint256 minimumWithdrawalAmount
    ) {
        if (protocolAdmin == address(0) || stablecoin == address(0)) revert InvalidAddress();
        if (stablecoin.code.length == 0) revert InvalidAddress();
        if (minimumWithdrawalAmount == 0) revert ZeroAmount();

        uint8 decimals_ = IERC20Metadata(stablecoin).decimals();
        if (decimals_ == 0 || decimals_ > 18) revert InvalidTokenDecimals();

        STABLECOIN = IERC20(stablecoin);
        STABLECOIN_DECIMALS = decimals_;
        defaultMinimumWithdrawalAmount = minimumWithdrawalAmount;
        _grantRole(DEFAULT_ADMIN_ROLE, protocolAdmin);
    }

    receive() external payable {}

    modifier onlyGateway() {
        if (msg.sender != confidentialGateway) revert UnauthorizedGateway();
        _;
    }

    modifier onlyRegisteredInstitution(address institution) {
        Institution memory item = institutions[institution];
        if (!item.registered) revert InstitutionNotRegistered();
        if (!item.active) revert InstitutionInactive();
        _;
    }

    modifier onlyInstitutionAdmin(address institution) {
        if (!institutionAdmins[institution][msg.sender]) revert NotAuthorized();
        _;
    }

    modifier onlyInstitutionHR(address institution) {
        if (!institutionHR[institution][msg.sender]) revert NotAuthorized();
        _;
    }

    modifier onlyInstitutionFinance(address institution) {
        if (!institutionFinance[institution][msg.sender]) revert NotAuthorized();
        _;
    }

    modifier onlyRegisteredOrProtocolAdmin(address institution) {
        if (!institutions[institution].registered) revert InstitutionNotRegistered();
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !institutionAdmins[institution][msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        pauseStartedAt = uint64(block.timestamp);
        emit ProtocolPaused(pauseStartedAt);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint64 startedAt = pauseStartedAt;
        uint256 elapsed = block.timestamp - uint256(startedAt);
        accumulatedPausedSeconds += elapsed;
        pauseStartedAt = 0;
        _unpause();
        emit ProtocolUnpaused(uint64(block.timestamp), elapsed, accumulatedPausedSeconds);
    }

    function currentPausedSeconds() public view returns (uint256) {
        if (paused()) {
            return accumulatedPausedSeconds + (block.timestamp - uint256(pauseStartedAt));
        }
        return accumulatedPausedSeconds;
    }

    /** One-time configuration. A new gateway requires a new vault deployment. */
    function setConfidentialGateway(address gateway) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (confidentialGateway != address(0)) revert ConfidentialGatewayAlreadySet();
        if (gateway == address(0) || gateway.code.length == 0) revert InvalidAddress();
        confidentialGateway = gateway;
        emit ConfidentialGatewaySet(gateway);
    }

    function setDefaultMinimumWithdrawalAmount(uint256 newAmount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newAmount == 0) revert ZeroAmount();
        uint256 oldAmount = defaultMinimumWithdrawalAmount;
        defaultMinimumWithdrawalAmount = newAmount;
        emit DefaultMinimumWithdrawalAmountUpdated(oldAmount, newAmount);
    }

    function registerMyInstitution(address treasury, address taxVault) external whenNotPaused {
        _registerInstitution(msg.sender, msg.sender, treasury, taxVault);
    }

    function adminRegisterInstitution(
        address institution,
        address institutionAdmin,
        address treasury,
        address taxVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _registerInstitution(institution, institutionAdmin, treasury, taxVault);
    }

    function _registerInstitution(
        address institution,
        address institutionAdmin,
        address treasury,
        address taxVault
    ) internal {
        _requireAddress(institution);
        _requireAddress(institutionAdmin);
        _requireExternalAddress(treasury);
        _requireExternalAddress(taxVault);
        if (institutions[institution].registered) revert InstitutionExists();

        institutions[institution] = Institution({
            registered: true,
            active: true,
            treasury: treasury,
            taxVault: taxVault
        });
        institutionAdmins[institution][institutionAdmin] = true;
        institutionAdminCount[institution] = 1;

        emit InstitutionRegistered(institution, institutionAdmin, treasury, taxVault);
        emit InstitutionAdminUpdated(institution, institutionAdmin, true);
    }

    function setInstitutionActive(address institution, bool active)
        external
        onlyRegisteredOrProtocolAdmin(institution)
    {
        institutions[institution].active = active;
        emit InstitutionActiveUpdated(institution, active);
    }

    function setInstitutionAdmin(address institution, address account, bool approved)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireAddress(account);
        bool current = institutionAdmins[institution][account];
        if (current == approved) return;

        if (approved) {
            institutionAdmins[institution][account] = true;
            institutionAdminCount[institution] += 1;
        } else {
            if (institutionAdminCount[institution] <= 1) revert LastInstitutionAdmin();
            institutionAdmins[institution][account] = false;
            institutionAdminCount[institution] -= 1;
        }
        emit InstitutionAdminUpdated(institution, account, approved);
    }

    function proposeInstitutionAdminTransfer(address institution, address newAdmin)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireAddress(newAdmin);
        if (institutionAdmins[institution][newAdmin]) revert InvalidAddress();
        uint64 expiresAt = uint64(block.timestamp + ADMIN_TRANSFER_EXPIRY);
        pendingAdminTransfers[institution] = AdminTransfer({
            from: msg.sender,
            to: newAdmin,
            expiresAt: expiresAt
        });
        emit InstitutionAdminTransferProposed(institution, msg.sender, newAdmin, expiresAt);
    }

    function acceptInstitutionAdminTransfer(address institution) external {
        AdminTransfer memory transfer = pendingAdminTransfers[institution];
        if (transfer.to == address(0) || transfer.to != msg.sender) revert AdminTransferMissing();
        if (block.timestamp > transfer.expiresAt) revert AdminTransferExpired();
        if (!institutionAdmins[institution][transfer.from]) revert NotAuthorized();
        if (institutionAdmins[institution][transfer.to]) revert InvalidAddress();

        institutionAdmins[institution][transfer.from] = false;
        institutionAdmins[institution][transfer.to] = true;
        delete pendingAdminTransfers[institution];

        emit InstitutionAdminUpdated(institution, transfer.from, false);
        emit InstitutionAdminUpdated(institution, transfer.to, true);
        emit InstitutionAdminTransferred(institution, transfer.from, transfer.to);
    }

    function proposeInstitutionAdminRecovery(address institution, address newAdmin)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!institutions[institution].registered) revert InstitutionNotRegistered();
        _requireAddress(newAdmin);
        uint64 executableAt = uint64(block.timestamp + ADMIN_RECOVERY_DELAY);
        pendingAdminRecoveries[institution] = AdminRecovery({
            newAdmin: newAdmin,
            executableAt: executableAt
        });
        emit InstitutionAdminRecoveryProposed(institution, newAdmin, executableAt);
    }

    function executeInstitutionAdminRecovery(address institution)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        AdminRecovery memory recovery = pendingAdminRecoveries[institution];
        if (recovery.newAdmin == address(0) || block.timestamp < recovery.executableAt) {
            revert AdminRecoveryNotReady();
        }
        if (!institutionAdmins[institution][recovery.newAdmin]) {
            institutionAdmins[institution][recovery.newAdmin] = true;
            institutionAdminCount[institution] += 1;
        }
        delete pendingAdminRecoveries[institution];
        emit InstitutionAdminUpdated(institution, recovery.newAdmin, true);
        emit InstitutionAdminRecovered(institution, recovery.newAdmin);
    }

    function setInstitutionHR(address institution, address account, bool approved)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireAddress(account);
        institutionHR[institution][account] = approved;
        emit InstitutionHRUpdated(institution, account, approved);
    }

    function setInstitutionFinance(address institution, address account, bool approved)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireAddress(account);
        institutionFinance[institution][account] = approved;
        emit InstitutionFinanceUpdated(institution, account, approved);
    }

    function setInstitutionTreasury(address institution, address newTreasury)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireExternalAddress(newTreasury);
        address oldTreasury = institutions[institution].treasury;
        institutions[institution].treasury = newTreasury;
        emit InstitutionTreasuryUpdated(institution, oldTreasury, newTreasury);
    }

    function setInstitutionTaxVault(address institution, address newTaxVault)
        external
        onlyRegisteredInstitution(institution)
        onlyInstitutionAdmin(institution)
    {
        _requireExternalAddress(newTaxVault);
        address oldTaxVault = institutions[institution].taxVault;
        institutions[institution].taxVault = newTaxVault;
        emit InstitutionTaxVaultUpdated(institution, oldTaxVault, newTaxVault);
    }

    function createPayrollDraft(
        uint256 payrollId,
        address institution,
        bytes32 metadataHash,
        uint64 fundingStartsAt,
        uint64 fundingDeadline,
        uint64 minimumWithdrawalWindow,
        uint64 settlementGracePeriod
    )
        public
        whenNotPaused
        onlyRegisteredInstitution(institution)
        onlyInstitutionHR(institution)
    {
        if (payrollId == 0) revert UnknownPayroll();
        if (_payrolls[payrollId].institution != address(0)) revert PayrollExists();
        if (metadataHash == bytes32(0)) revert InvalidCommitment();
        _validateTiming(
            fundingStartsAt,
            fundingDeadline,
            minimumWithdrawalWindow,
            settlementGracePeriod
        );

        Institution memory item = institutions[institution];
        _payrolls[payrollId] = PayrollData({
            institution: institution,
            createdBy: msg.sender,
            treasury: item.treasury,
            taxVault: item.taxVault,
            metadataHash: metadataHash,
            ciphertextHash: bytes32(0),
            privateLedgerRoot: bytes32(0),
            employeeCount: 0,
            employeeNetTotal: 0,
            aggregateTaxTotal: 0,
            totalRequired: 0,
            fundedAmount: 0,
            netWithdrawnAmount: 0,
            taxPaidAmount: 0,
            minimumWithdrawalAmount: defaultMinimumWithdrawalAmount,
            pauseSecondsAtCreation: currentPausedSeconds(),
            pauseSecondsAtActivation: 0,
            pendingWithdrawalRequests: 0,
            fundingStartsAt: fundingStartsAt,
            fundingDeadline: fundingDeadline,
            minimumWithdrawalWindow: minimumWithdrawalWindow,
            settlementGracePeriod: settlementGracePeriod,
            activatedAt: 0,
            withdrawalDeadline: 0,
            settlementDeadline: 0,
            status: PayrollStatus.Draft
        });

        if (payrollId >= nextPayrollId) nextPayrollId = payrollId + 1;

        emit PayrollDraftCreated(
            payrollId,
            institution,
            msg.sender,
            metadataHash,
            fundingStartsAt,
            fundingDeadline,
            minimumWithdrawalWindow,
            settlementGracePeriod
        );
    }

    function createPayrollDraftAuto(
        address institution,
        bytes32 metadataHash,
        uint64 fundingStartsAt,
        uint64 fundingDeadline,
        uint64 minimumWithdrawalWindow,
        uint64 settlementGracePeriod
    ) external returns (uint256 payrollId) {
        payrollId = nextPayrollId++;
        createPayrollDraft(
            payrollId,
            institution,
            metadataHash,
            fundingStartsAt,
            fundingDeadline,
            minimumWithdrawalWindow,
            settlementGracePeriod
        );
    }

    function markComputationRequested(uint256 payrollId, bytes32 ciphertextHash)
        external
        override
        onlyGateway
        whenNotPaused
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.status != PayrollStatus.Draft) revert BadStatus();
        if (ciphertextHash == bytes32(0)) revert InvalidCommitment();
        if (block.timestamp > effectiveFundingDeadline(payrollId)) revert DeadlinePassed();

        payroll.ciphertextHash = ciphertextHash;
        payroll.status = PayrollStatus.ComputationRequested;
        emit PayrollComputationRequested(payrollId, ciphertextHash);
    }

    function resetComputationRequest(uint256 payrollId, bytes32 ciphertextHash)
        external
        override
        onlyGateway
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.status != PayrollStatus.ComputationRequested) revert BadStatus();
        if (payroll.ciphertextHash != ciphertextHash) revert ComputationHashMismatch();

        payroll.ciphertextHash = bytes32(0);
        payroll.status = PayrollStatus.Draft;
        emit PayrollComputationReset(payrollId, ciphertextHash);
    }

    /** Finalization is deliberately allowed during a protocol pause. */
    function commitConfidentialPayroll(PayrollCommitment calldata commitment)
        external
        override
        onlyGateway
    {
        PayrollData storage payroll = _getPayroll(commitment.payrollId);
        if (payroll.status != PayrollStatus.ComputationRequested) revert BadStatus();
        if (payroll.metadataHash != commitment.metadataHash) revert InvalidCommitment();
        if (payroll.ciphertextHash != commitment.ciphertextHash) {
            revert ComputationHashMismatch();
        }
        if (
            commitment.privateLedgerRoot == bytes32(0) ||
            commitment.employeeCount == 0 ||
            commitment.employeeCount > MAX_EMPLOYEE_COUNT ||
            commitment.employeeNetTotal == 0 ||
            commitment.totalRequired == 0 ||
            commitment.totalRequired != commitment.employeeNetTotal + commitment.aggregateTaxTotal
        ) revert InvalidCommitment();

        payroll.privateLedgerRoot = commitment.privateLedgerRoot;
        payroll.employeeCount = commitment.employeeCount;
        payroll.employeeNetTotal = commitment.employeeNetTotal;
        payroll.aggregateTaxTotal = commitment.aggregateTaxTotal;
        payroll.totalRequired = commitment.totalRequired;
        payroll.status = PayrollStatus.Computed;

        emit ConfidentialPayrollCommitted(
            commitment.payrollId,
            commitment.privateLedgerRoot,
            commitment.ciphertextHash,
            commitment.employeeCount,
            commitment.employeeNetTotal,
            commitment.aggregateTaxTotal,
            commitment.totalRequired
        );
    }

    function openFunding(uint256 payrollId) external whenNotPaused {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (!canHR(payroll.institution, msg.sender)) revert NotAuthorized();
        if (payroll.status != PayrollStatus.Computed) revert BadStatus();
        if (block.timestamp > effectiveFundingDeadline(payrollId)) revert DeadlinePassed();

        payroll.status = PayrollStatus.FundingReady;
        emit PayrollFundingOpened(payrollId);
    }

    function fundPayroll(uint256 payrollId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (!institutionFinance[payroll.institution][msg.sender]) revert NotAuthorized();
        if (!institutions[payroll.institution].active) revert InstitutionInactive();
        if (payroll.status != PayrollStatus.FundingReady) revert BadStatus();
        if (block.timestamp < effectiveFundingStartsAt(payrollId)) revert FundingNotOpen();
        if (block.timestamp > effectiveFundingDeadline(payrollId)) revert DeadlinePassed();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = payroll.totalRequired - payroll.fundedAmount;
        if (amount > remaining) revert InvalidCommitment();

        _pullExact(msg.sender, amount);
        payroll.fundedAmount += amount;
        totalEscrowed += amount;

        emit PayrollFunded(payrollId, msg.sender, amount, payroll.fundedAmount, payroll.totalRequired);

        if (payroll.fundedAmount == payroll.totalRequired) {
            _activatePayroll(payrollId, payroll);
        }
    }

    function noteWithdrawalRequestOpened(
        uint256 payrollId,
        bytes32 instructionId,
        uint64 requestedAt
    ) external override onlyGateway {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.status != PayrollStatus.Active) revert BadStatus();
        if (instructionId == bytes32(0)) revert InvalidCommitment();
        if (pendingWithdrawalInstructionPayroll[instructionId] != 0) {
            revert RequestAlreadyTracked();
        }
        if (requestedAt > effectiveWithdrawalDeadline(payrollId)) revert DeadlinePassed();

        pendingWithdrawalInstructionPayroll[instructionId] = payrollId;
        payroll.pendingWithdrawalRequests += 1;
        emit WithdrawalRequestTracked(payrollId, instructionId, requestedAt);
    }

    function noteWithdrawalRequestClosed(uint256 payrollId, bytes32 instructionId)
        external
        override
        onlyGateway
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (pendingWithdrawalInstructionPayroll[instructionId] != payrollId) {
            revert RequestNotTracked();
        }
        delete pendingWithdrawalInstructionPayroll[instructionId];
        payroll.pendingWithdrawalRequests -= 1;
        emit WithdrawalRequestUntracked(payrollId, instructionId);
    }

    /** Already-approved withdrawals may settle during a pause. */
    function executePrivateWithdrawal(PrivateWithdrawal calldata withdrawal)
        external
        override
        onlyGateway
        nonReentrant
    {
        PayrollData storage payroll = _getPayroll(withdrawal.payrollId);
        if (payroll.status != PayrollStatus.Active) revert BadStatus();
        if (pendingWithdrawalInstructionPayroll[withdrawal.instructionId] != withdrawal.payrollId) {
            revert RequestNotTracked();
        }
        if (withdrawal.requestedAt > effectiveWithdrawalDeadline(withdrawal.payrollId)) {
            revert DeadlinePassed();
        }
        if (block.timestamp > effectiveSettlementDeadline(withdrawal.payrollId)) {
            revert DeadlinePassed();
        }
        if (withdrawal.validUntil < block.timestamp) revert WithdrawalExpired();
        if (withdrawal.stablecoin != address(STABLECOIN)) revert InvalidStablecoin();
        if (
            withdrawal.destination == address(0) ||
            withdrawal.destination == address(this) ||
            withdrawal.amount < payroll.minimumWithdrawalAmount
        ) revert InvalidWithdrawal();
        if (
            withdrawal.oldLedgerRoot != payroll.privateLedgerRoot ||
            withdrawal.newLedgerRoot == bytes32(0) ||
            withdrawal.newLedgerRoot == withdrawal.oldLedgerRoot ||
            withdrawal.withdrawalNullifier == bytes32(0)
        ) revert InvalidWithdrawal();
        if (usedWithdrawalNullifiers[withdrawal.withdrawalNullifier]) {
            revert WithdrawalAlreadyUsed();
        }

        uint256 remainingNet = payroll.employeeNetTotal - payroll.netWithdrawnAmount;
        if (withdrawal.amount > remainingNet || withdrawal.amount > totalEscrowed) {
            revert InsufficientEscrow();
        }

        usedWithdrawalNullifiers[withdrawal.withdrawalNullifier] = true;
        payroll.privateLedgerRoot = withdrawal.newLedgerRoot;
        payroll.netWithdrawnAmount += withdrawal.amount;
        totalEscrowed -= withdrawal.amount;

        _pushExact(withdrawal.destination, withdrawal.amount);

        emit PrivateWithdrawalExecuted(
            withdrawal.instructionId,
            withdrawal.withdrawalNullifier,
            withdrawal.destination,
            withdrawal.amount,
            withdrawal.newLedgerRoot
        );

        if (payroll.netWithdrawnAmount == payroll.employeeNetTotal) {
            payroll.status = PayrollStatus.Closed;
            emit PayrollClosed(withdrawal.payrollId, 0);
        }
    }

    function cancelPayroll(uint256 payrollId, bytes32 reasonHash)
        external
        nonReentrant
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (!institutionAdmins[payroll.institution][msg.sender]) revert NotAuthorized();
        if (
            payroll.status == PayrollStatus.Active ||
            payroll.status == PayrollStatus.Closed ||
            payroll.status == PayrollStatus.Cancelled ||
            payroll.status == PayrollStatus.None
        ) revert BadStatus();

        uint256 refund = payroll.fundedAmount;
        payroll.status = PayrollStatus.Cancelled;
        payroll.fundedAmount = 0;

        if (refund > 0) {
            totalEscrowed -= refund;
            _pushExact(payroll.treasury, refund);
        }

        emit PayrollCancelled(payrollId, refund, reasonHash);
    }

    function closeExpiredPayroll(uint256 payrollId) external nonReentrant {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (
            !institutionAdmins[payroll.institution][msg.sender] &&
            !institutionFinance[payroll.institution][msg.sender]
        ) revert NotAuthorized();
        if (payroll.status != PayrollStatus.Active) revert BadStatus();
        if (block.timestamp <= effectiveSettlementDeadline(payrollId)) {
            revert DeadlineNotReached();
        }
        if (payroll.pendingWithdrawalRequests != 0) revert PendingWithdrawalExists();

        uint256 refund = payroll.employeeNetTotal - payroll.netWithdrawnAmount;
        payroll.status = PayrollStatus.Closed;

        if (refund > 0) {
            if (refund > totalEscrowed) revert InsufficientEscrow();
            totalEscrowed -= refund;
            _pushExact(payroll.treasury, refund);
        }

        emit PayrollClosed(payrollId, refund);
    }

    function rescueForeignToken(address token, address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (token == address(STABLECOIN)) revert StablecoinRescueForbidden();
        _requireAddress(token);
        _requireExternalAddress(to);
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit ForeignTokenRescued(token, to, amount);
    }


    function rescueStablecoinSurplus(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        _requireExternalAddress(to);
        if (amount == 0) revert ZeroAmount();
        uint256 balance = STABLECOIN.balanceOf(address(this));
        if (balance < totalEscrowed || amount > balance - totalEscrowed) {
            revert InsufficientEscrow();
        }
        _pushExact(to, amount);
        emit StablecoinSurplusRescued(to, amount);
    }

    function rescueNative(address payable to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        _requireExternalAddress(to);
        if (amount == 0) revert ZeroAmount();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
        emit NativeTokenRescued(to, amount);
    }

    function canHR(address institution, address account)
        public
        view
        override
        returns (bool)
    {
        return
            institutions[institution].registered &&
            institutions[institution].active &&
            (institutionHR[institution][account] || institutionAdmins[institution][account]);
    }

    function getPayrollGatewayContext(uint256 payrollId)
        external
        view
        override
        returns (PayrollGatewayContext memory context)
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        context = PayrollGatewayContext({
            institution: payroll.institution,
            metadataHash: payroll.metadataHash,
            ciphertextHash: payroll.ciphertextHash,
            privateLedgerRoot: payroll.privateLedgerRoot,
            stablecoin: address(STABLECOIN),
            stablecoinDecimals: STABLECOIN_DECIMALS,
            status: payroll.status
        });
    }

    function getWithdrawalContext(uint256 payrollId)
        external
        view
        override
        returns (WithdrawalContext memory context)
    {
        PayrollData storage payroll = _getPayroll(payrollId);
        context = WithdrawalContext({
            institution: payroll.institution,
            privateLedgerRoot: payroll.privateLedgerRoot,
            stablecoin: address(STABLECOIN),
            stablecoinDecimals: STABLECOIN_DECIMALS,
            status: payroll.status,
            withdrawalDeadline: uint64(effectiveWithdrawalDeadline(payrollId)),
            settlementDeadline: uint64(effectiveSettlementDeadline(payrollId)),
            pendingWithdrawalRequests: payroll.pendingWithdrawalRequests,
            minimumWithdrawalAmount: payroll.minimumWithdrawalAmount
        });
    }

    function getPayroll(uint256 payrollId) external view returns (PayrollData memory payrollData) {
        PayrollData storage payroll = _getPayroll(payrollId);
        payrollData = payroll;
    }

    function payrollEscrowRemaining(uint256 payrollId) external view returns (uint256) {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.status == PayrollStatus.Active) {
            return payroll.employeeNetTotal - payroll.netWithdrawnAmount;
        }
        if (payroll.status == PayrollStatus.FundingReady) {
            return payroll.fundedAmount;
        }
        return 0;
    }

    function effectiveFundingStartsAt(uint256 payrollId) public view returns (uint256) {
        PayrollData storage payroll = _getPayroll(payrollId);
        return uint256(payroll.fundingStartsAt) + _pauseDelta(payroll.pauseSecondsAtCreation);
    }

    function effectiveFundingDeadline(uint256 payrollId) public view returns (uint256) {
        PayrollData storage payroll = _getPayroll(payrollId);
        return uint256(payroll.fundingDeadline) + _pauseDelta(payroll.pauseSecondsAtCreation);
    }

    function effectiveWithdrawalDeadline(uint256 payrollId) public view returns (uint256) {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.activatedAt == 0) return 0;
        return uint256(payroll.withdrawalDeadline) + _pauseDelta(payroll.pauseSecondsAtActivation);
    }

    function effectiveSettlementDeadline(uint256 payrollId) public view returns (uint256) {
        PayrollData storage payroll = _getPayroll(payrollId);
        if (payroll.activatedAt == 0) return 0;
        return uint256(payroll.settlementDeadline) + _pauseDelta(payroll.pauseSecondsAtActivation);
    }

    function _activatePayroll(uint256 payrollId, PayrollData storage payroll) internal {
        if (block.timestamp > effectiveFundingDeadline(payrollId)) revert DeadlinePassed();

        payroll.status = PayrollStatus.Active;
        payroll.activatedAt = uint64(block.timestamp);
        payroll.pauseSecondsAtActivation = currentPausedSeconds();
        payroll.withdrawalDeadline = uint64(block.timestamp + payroll.minimumWithdrawalWindow);
        payroll.settlementDeadline = uint64(
            uint256(payroll.withdrawalDeadline) + payroll.settlementGracePeriod
        );

        uint256 tax = payroll.aggregateTaxTotal;
        if (tax > 0) {
            payroll.taxPaidAmount = tax;
            totalEscrowed -= tax;
            _pushExact(payroll.taxVault, tax);
        }

        emit PayrollActivated(
            payrollId,
            payroll.activatedAt,
            payroll.withdrawalDeadline,
            payroll.settlementDeadline,
            payroll.employeeNetTotal,
            tax
        );
    }

    function _pullExact(address from, uint256 amount) internal {
        uint256 beforeBalance = STABLECOIN.balanceOf(address(this));
        STABLECOIN.safeTransferFrom(from, address(this), amount);
        uint256 received = STABLECOIN.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert FeeOnTransferDetected();
    }

    function _pushExact(address to, uint256 amount) internal {
        uint256 senderBefore = STABLECOIN.balanceOf(address(this));
        uint256 recipientBefore = STABLECOIN.balanceOf(to);
        STABLECOIN.safeTransfer(to, amount);
        uint256 senderSpent = senderBefore - STABLECOIN.balanceOf(address(this));
        uint256 recipientReceived = STABLECOIN.balanceOf(to) - recipientBefore;
        if (senderSpent != amount || recipientReceived != amount) {
            revert FeeOnTransferDetected();
        }
    }

    function _getPayroll(uint256 payrollId)
        internal
        view
        returns (PayrollData storage payroll)
    {
        payroll = _payrolls[payrollId];
        if (payroll.institution == address(0)) revert UnknownPayroll();
    }

    function _validateTiming(
        uint64 fundingStartsAt,
        uint64 fundingDeadline,
        uint64 minimumWithdrawalWindow,
        uint64 settlementGracePeriod
    ) internal view {
        if (
            fundingDeadline <= block.timestamp ||
            fundingDeadline <= fundingStartsAt ||
            uint256(fundingDeadline) - uint256(fundingStartsAt) < MIN_FUNDING_WINDOW ||
            minimumWithdrawalWindow < MIN_ACTIVE_WITHDRAWAL_WINDOW ||
            minimumWithdrawalWindow > MAX_ACTIVE_WITHDRAWAL_WINDOW ||
            settlementGracePeriod < MIN_SETTLEMENT_GRACE_PERIOD ||
            settlementGracePeriod > MAX_SETTLEMENT_GRACE_PERIOD
        ) revert InvalidDeadline();
    }

    function _pauseDelta(uint256 snapshot) internal view returns (uint256) {
        return currentPausedSeconds() - snapshot;
    }

    function _requireAddress(address account) internal pure {
        if (account == address(0)) revert InvalidAddress();
    }

    function _requireExternalAddress(address account) internal view {
        if (account == address(0) || account == address(this)) revert InvalidAddress();
    }
}
