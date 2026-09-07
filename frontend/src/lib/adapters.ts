import { env } from "./env";
import type {
  Address,
  ArcConfig,
  ChainTransaction,
  Institution,
  InstitutionMember,
  NotificationItem,
  PayrollRun,
  PayrollStatus,
  PreparedTx,
} from "./types";

type AnyRecord = Record<string, any>;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function address(value: unknown, fallback: Address = ZERO_ADDRESS): Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : fallback;
}

export function adaptPreparedTransaction(value: AnyRecord): PreparedTx {
  const raw = value?.prepared_transaction || value;
  return {
    id: String(raw.id || ""),
    chain_id: Number(raw.chain_id || env.arcChainId),
    intent_type: String(raw.intent_type || ""),
    from_address: address(raw.from_address),
    to: address(raw.to || raw.contract_address),
    data: String(raw.data || "0x") as `0x${string}`,
    value: String(raw.value || "0"),
    expected_event: String(raw.expected_event || ""),
    expires_at: raw.expires_at ? String(raw.expires_at) : undefined,
    type:
      raw.intent_type === "APPROVE_PAYROLL_FUNDING"
        ? "erc20_approve"
        : raw.intent_type === "FUND_PAYROLL"
          ? "payroll_fund"
          : String(raw.intent_type || "prepared_transaction").toLowerCase(),
    contract_address: address(raw.to || raw.contract_address),
  };
}

export function adaptInstitutionMember(raw: AnyRecord): InstitutionMember {
  return {
    id: Number(raw.id),
    wallet_address: address(raw.wallet_address),
    notification_email: raw.notification_email || "",
    role: raw.role,
    status: raw.status,
    approved_onchain: Boolean(raw.approved_onchain),
    assigned_tx_hash: raw.assigned_tx_hash || "",
    removed_tx_hash: raw.removed_tx_hash || "",
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
  };
}

export function adaptInstitution(raw: AnyRecord): Institution {
  const status = String(raw.registration_status || "draft");
  return {
    id: Number(raw.id),
    name: String(raw.name || "Institution"),
    notification_email: raw.notification_email || "",
    institution_address: address(raw.institution_address),
    admin_address: address(raw.admin_address),
    treasury_address: address(raw.treasury_address),
    tax_vault_address: address(raw.tax_vault_address),
    chain: Number(raw.chain_id || env.arcChainId),
    chain_id: Number(raw.chain_id || env.arcChainId),
    contract_address: address(raw.vault_address, env.payrollManager),
    vault_address: address(raw.vault_address, env.payrollManager),
    can_manage: Boolean(raw.can_manage),
    is_active_onchain: Boolean(raw.is_active_onchain),
    registration_status: status,
    registration_tx_hash: raw.registration_tx_hash || "",
    registration_tx_status: status,
    registration_tx_error: "",
    can_retry_registration: status === "draft" || status === "failed",
    is_registered_onchain: Boolean(raw.is_registered_onchain),
    members: Array.isArray(raw.members) ? raw.members.map(adaptInstitutionMember) : [],
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
  };
}

function uiPayrollStatus(rawStatus: string): PayrollStatus {
  const map: Record<string, PayrollStatus> = {
    draft: "draft",
    validated: "uploaded",
    encrypted_ready: "merkle_ready",
    draft_tx_pending: "pending_create_draft",
    draft_onchain: "draft_created_onchain",
    computation_tx_pending: "pending_upload",
    tee_processing: "pending_upload",
    computed: "uploaded_onchain",
    open_funding_tx_pending: "pending_activation",
    funding_ready: "funding_ready",
    approval_tx_pending: "pending_funding",
    funding_tx_pending: "pending_funding",
    active: "active",
    closed: "finalized",
    failed: "failed",
  };
  return map[rawStatus] || (rawStatus as PayrollStatus);
}

export function adaptPayrollRun(raw: AnyRecord): PayrollRun {
  const backendStatus = String(raw.status || "draft");
  const draftExists = Boolean(raw.draft_tx_hash) || [
    "draft_onchain",
    "computation_tx_pending",
    "tee_processing",
    "computed",
    "open_funding_tx_pending",
    "funding_ready",
    "approval_tx_pending",
    "funding_tx_pending",
    "active",
    "closed",
  ].includes(backendStatus);
  const root = raw.private_ledger_root || raw.ciphertext_hash || raw.metadata_hash || "";
  const count = Number(raw.employee_count || raw.latest_import?.row_count || 0);

  return {
    id: Number(raw.id),
    institution: Number(raw.institution_id || raw.institution),
    chain: Number(raw.chain_id || env.arcChainId),
    chain_id: Number(raw.chain_id || env.arcChainId),
    contract_address: env.payrollManager,
    vault_address: env.payrollManager,
    onchain_payroll_id: draftExists && raw.payroll_id ? String(raw.payroll_id) : null,
    title: String(raw.title || "Payroll"),
    period_label: String(raw.period_label || ""),
    execution_mode: "manual",
    payroll_type: "one_time",
    recurring_frequency: "",
    recurring_series_key: "",
    recurring_index: 1,
    recurring_total: 1,
    token_address: env.usdcToken,
    token_decimals: env.usdcDecimals,
    funding_starts_at: String(raw.funding_starts_at || ""),
    claim_deadline: String(raw.withdrawal_deadline || raw.funding_deadline || ""),
    metadata_hash: raw.metadata_hash || "",
    payments_root: root,
    total_payments: count,
    total_gross_amount: String(raw.total_required || "0"),
    processed_count: backendStatus === "active" || backendStatus === "closed" ? count : 0,
    create_draft_tx_hash: raw.draft_tx_hash || "",
    upload_tx_hash: raw.computation_request_tx_hash || raw.finalization_tx_hash || "",
    activate_tx_hash: raw.open_funding_tx_hash || "",
    fund_tx_hash: raw.funding_tx_hash || "",
    close_tx_hash: raw.finalization_tx_hash || "",
    withdraw_tx_hash: "",
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
    payments: [],
    // Runtime-only backend fields retained for current-flow decisions.
    ...(raw as object),
    status: uiPayrollStatus(backendStatus),
  } as PayrollRun;
}

export function adaptTransaction(raw: AnyRecord): ChainTransaction {
  return {
    id: Number(raw.id),
    chain: Number(raw.chain_id || env.arcChainId),
    chain_id: Number(raw.chain_id || env.arcChainId),
    prepared_transaction_id: raw.prepared_transaction_id || "",
    tx_hash: String(raw.tx_hash || ""),
    sender_address: address(raw.sender_address),
    contract_address: address(raw.contract_address),
    intent_type: String(raw.intent_type || "transaction"),
    status: raw.status,
    block_number: raw.block_number ?? null,
    gas_used: raw.gas_used ?? null,
    confirmations: Number(raw.confirmations || 0),
    error_message: raw.error_message || "",
    explorer_url: raw.explorer_url || "",
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
  };
}

export function adaptNotification(raw: AnyRecord): NotificationItem {
  return {
    id: Number(raw.id),
    institution: raw.institution ?? null,
    recipient_wallet: raw.recipient_wallet || "",
    title: String(raw.title || "Notification"),
    message: String(raw.message || ""),
    notification_type: String(raw.notification_type || raw.category || "update"),
    channel: String(raw.channel || "in_app"),
    read: Boolean(raw.read),
    created_at: String(raw.created_at || ""),
    updated_at: String(raw.updated_at || ""),
  };
}

export function adaptChainConfig(raw: AnyRecord): ArcConfig {
  return {
    chain: raw.chain,
    contract: {
      name: raw.contracts?.vault?.name || "BalaryVault",
      address: address(raw.contracts?.vault?.address, env.payrollManager),
      abi_json: [],
    },
    contracts: raw.contracts,
    token: raw.token,
    fcc: raw.fcc,
  };
}
