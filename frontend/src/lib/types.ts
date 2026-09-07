export type Address = `0x${string}`;

export type Account = {
  id: number;
  wallet_address: Address;
  email?: string;
  display_name?: string;
};

export type AuthSession = {
  access: string;
  refresh: string;
  account: Account;
};

export type InstitutionRole = "admin" | "hr" | "finance";
export type MemberStatus = "invited" | "pending_onchain" | "active" | "removed" | "failed";

export type InstitutionMember = {
  id: number;
  wallet_address: Address;
  notification_email?: string;
  role: InstitutionRole;
  status: MemberStatus;
  approved_onchain?: boolean;
  assigned_tx_hash?: string;
  removed_tx_hash?: string;
  created_at: string;
  updated_at: string;
};

export type Institution = {
  id: number;
  name: string;
  notification_email?: string;
  institution_address: Address;
  admin_address: Address;
  treasury_address: Address;
  tax_vault_address: Address;
  chain: number;
  chain_id?: number;
  contract_address: Address;
  vault_address?: Address;
  can_manage?: boolean;
  is_active_onchain?: boolean;
  registration_status: string;
  registration_tx_hash?: string;
  registration_tx_status?: string;
  registration_tx_error?: string;
  can_retry_registration?: boolean;
  is_registered_onchain: boolean;
  members: InstitutionMember[];
  created_at: string;
  updated_at: string;
};

export type PayrollStatus =
  | "draft"
  | "validated"
  | "encrypted_ready"
  | "draft_tx_pending"
  | "draft_onchain"
  | "computation_tx_pending"
  | "tee_processing"
  | "computed"
  | "open_funding_tx_pending"
  | "funding_ready"
  | "approval_tx_pending"
  | "funding_tx_pending"
  | "active"
  | "closed"
  | "failed"
  | "uploaded"
  | "merkle_ready"
  | "pending_create_draft"
  | "draft_created_onchain"
  | "pending_upload"
  | "uploaded_onchain"
  | "pending_activation"
  | "pending_funding"
  | "finalized"
  | "expired"
  | "cancelled";

export type PayrollPayment = {
  id: number;
  payroll_run: number;
  payroll_index: number;
  employee_name: string;
  employee_email?: string;
  employee_address: Address;
  token_address: Address;
  net_amount: string;
  tax_amount: string;
  gross_amount: string;
  encrypted_ref: string;
  leaf?: string;
  proof?: string[];
  claimed: boolean;
  claim_tx_hash?: string;
  claimed_at?: string | null;
};

export type PayrollRun = {
  id: number;
  institution: number;
  chain: number;
  chain_id?: number;
  contract_address: Address;
  vault_address?: Address;
  can_manage?: boolean;
  is_active_onchain?: boolean;
  onchain_payroll_id?: string | null;
  title: string;
  period_label: string;
  execution_mode?: "manual" | "agent";
  payroll_type: "one_time" | "recurring";
  recurring_frequency?: "daily" | "weekly" | "monthly" | "";
  recurring_series_key?: string;
  recurring_index: number;
  recurring_total: number;
  token_address: Address;
  token_decimals: number;
  funding_starts_at: string;
  claim_deadline: string;
  metadata_hash?: string;
  payments_root?: string;
  total_payments: number;
  total_gross_amount: string;
  processed_count: number;
  status: PayrollStatus;
  create_draft_tx_hash?: string;
  upload_tx_hash?: string;
  activate_tx_hash?: string;
  fund_tx_hash?: string;
  close_tx_hash?: string;
  withdraw_tx_hash?: string;
  created_at: string;
  updated_at: string;
  payments?: PayrollPayment[];
};

export type PreparedTx = {
  id: string;
  chain_id: number;
  intent_type: string;
  from_address: Address;
  to: Address;
  data: `0x${string}`;
  value: string;
  expected_event: string;
  expires_at?: string;
  type?: "erc20_approve" | "payroll_fund" | string;
  contract_address?: Address;
  token_address?: Address;
  method?: string;
  args?: unknown[];
};

export type AgentRoleAssignmentState = {
  status: "not_started" | "signature_required" | "pending_confirmation" | "confirmed" | "failed";
  target_wallet: Address | "";
  prepared_transaction?: PreparedTx;
  tx_hash?: string;
  error?: string;
};

export type AvailableClaim = {
  payment_id: string;
  payroll_run_id: string;
  payrollId?: string;
  institution: {
    name: string;
    address: Address;
  };
  period_label: string;
  token: Address;
  net: string;
  tax: string;
  gross: string;
  claim_deadline: string;
  status: PayrollStatus;
  claim_status?: "open" | "pending" | "claimed";
  claim_tx_hash?: string;
  claimed_at?: string | null;
};

export type ChainTransaction = {
  id: number;
  chain: number;
  chain_id?: number;
  prepared_transaction_id?: string;
  tx_hash: string;
  sender_address: Address | "";
  contract_address: Address | "";
  intent_type: string;
  status: "pending" | "confirmed" | "failed" | "event_mismatch" | "replaced";
  block_number?: number | null;
  gas_used?: number | null;
  error_message?: string;
  confirmations?: number;
  explorer_url?: string;
  related_model?: string;
  related_id?: string;
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: number;
  institution?: number | null;
  recipient_wallet?: Address | "";
  title: string;
  message: string;
  notification_type: string;
  channel: string;
  read: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPreference = {
  id: number;
  email: string;
  institution?: number | null;
  receive_institution_updates: boolean;
  receive_payroll_updates: boolean;
  receive_claim_updates: boolean;
  receive_security_updates: boolean;
};

export type ArcConfig = {
  chain: {
    name: string;
    chain_id: number;
    rpc_url: string;
    explorer_url: string;
    is_active?: boolean;
  };
  contract: {
    address: Address;
    abi_json: unknown[];
    name: string;
  };
  contracts?: {
    vault: { name: string; address: Address; is_active?: boolean };
    gateway: { name: string; address: Address; is_active?: boolean };
  };
  token: {
    address: Address;
    symbol: string;
    decimals: number;
    is_active?: boolean;
  };
  fcc?: { tee_id: Address; tee_signer_epoch: number; proxy_url: string };
};

export type AgentOnboardingStatus = {
  institution_id: string;
  agent_onboarding_status:
    | "not_started"
    | "config_blocked"
    | "wallet_creating"
    | "wallet_failed"
    | "wallet_created"
    | "hr_signature_required"
    | "hr_pending_confirmation"
    | "hr_confirmed"
    | "finance_signature_required"
    | "finance_pending_confirmation"
    | "finance_confirmed"
    | "policy_pending"
    | "ready";
  agent_wallet: {
    id?: number | null;
    wallet_address: Address | "";
    circle_wallet_id: string;
    status: string;
  };
  circle_config: {
    complete: boolean;
    missing: string[];
    message: string;
  };
  auto_role_assignment: {
    hr: AgentRoleAssignmentState;
    finance: AgentRoleAssignmentState;
    same_wallet_for_both_roles: boolean;
  };
  agent_wallet_created: boolean;
  circle_wallet_id: string;
  circle_wallet_address: string;
  wallet_status: string;
  wallet_error?: string;
  hr_role_confirmed: boolean;
  finance_role_confirmed: boolean;
  policy_created: boolean;
  policy_enabled: boolean;
  policy_paused: boolean;
  emergency_stop: boolean;
  execution_enabled: boolean;
  dry_run: boolean;
  chat_unlocked: boolean;
  next_step: "create_wallet" | "sign_hr_role" | "sign_finance_role" | "create_policy" | "completed";
};

export type AgentAutoRoleAssignmentResponse = Pick<AgentOnboardingStatus, "agent_wallet" | "auto_role_assignment" | "next_step">;

export type AgentWallet = {
  id: number;
  institution: number;
  circle_wallet_set_id: string;
  circle_wallet_id: string;
  wallet_address: Address | "";
  blockchain: string;
  custody_type: string;
  account_type: string;
  hr_role_confirmed: boolean;
  finance_role_confirmed: boolean;
  status: string;
  last_known_balance?: string;
  balance_checked_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentWalletBalance = {
  available: boolean;
  status: string;
  message: string;
  wallet_address: Address | "";
  circle_wallet_id: string;
  balance: string;
  balance_checked_at?: string | null;
};

export type AgentPolicy = {
  id: number;
  institution: number;
  agent_wallet: number;
  enabled: boolean;
  paused: boolean;
  emergency_stop: boolean;
  max_single_run_amount: string;
  max_monthly_amount: string;
  allowed_tokens: string[];
  require_manual_review_above_amount: string;
  agent_control_mode: "guided" | "policy_autonomy" | "autopilot";
  accepted_by?: number | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentTemplateStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "needs_correction"
  | "ready_to_proceed"
  | "locked"
  | "failed";

export type AgentInstructionRow = {
  id: number;
  instruction: number;
  employee_name: string;
  employee_email: string;
  employee_address: Address | "";
  department: string;
  role: string;
  gross_amount_atomic: string;
  bonus_amount_atomic: string;
  deduction_amount_atomic: string;
  net_amount_atomic: string;
  row_status: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

export type AgentParsedPayload = {
  payroll_title?: string;
  schedule?: {
    frequency?: string;
    scheduled_for?: string;
    claim_deadline?: string;
    runs?: Array<{ scheduled_for: string }>;
  };
  currency?: string;
  token_address?: Address | "";
  total_amount_atomic?: string;
  employee_count?: number;
  rows?: AgentInstructionRow[];
};

export type AgentTemplateUpload = {
  id: number;
  institution: number;
  uploaded_by?: number | null;
  file_type: string;
  original_filename: string;
  status: AgentTemplateStatus;
  parsed_payload: AgentParsedPayload;
  validation_errors: Array<{ field?: string; row?: number; message: string }>;
  parse_confidence: string;
  created_at: string;
  updated_at: string;
};

export type AgentInstruction = {
  id: number;
  institution: number;
  upload: number;
  payroll_title: string;
  schedule: AgentParsedPayload["schedule"];
  currency: string;
  token_address: Address | "";
  total_amount_atomic: string;
  employee_count: number;
  status: string;
  locked_at?: string | null;
  locked_by?: number | null;
  auto_execute_enabled: boolean;
  rows?: AgentInstructionRow[];
  created_at: string;
  updated_at: string;
};

export type AgentJob = {
  id: number;
  institution: number;
  instruction?: number | null;
  payroll_run?: number | null;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  status: string;
  circle_transaction_id: string;
  tx_hash: string;
  current_intent: string;
  current_step: string;
  current_contract_address: Address | "";
  circle_status: string;
  confirmation_attempts: number;
  failure_reason: string;
  retry_count: number;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

export type AgentAuditEvent = {
  id: number;
  institution: number;
  actor?: number | null;
  action: string;
  target_type: string;
  target_id: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentConversation = {
  id: number;
  institution: number;
  created_by?: number | null;
  title: string;
  status: "active" | "archived" | "failed";
  created_at: string;
  updated_at: string;
};

export type AgentMessage = {
  id: number;
  conversation: number;
  sender: "user" | "ai" | "system" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentToolCall = {
  id?: number;
  conversation?: number;
  message?: number | null;
  tool_name: string;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  status: "planned" | "allowed" | "denied" | "executed" | "failed";
  policy_decision?: Record<string, unknown>;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
};

export type AgentPlan = {
  id: number;
  conversation: number;
  institution: number;
  goal: string;
  steps: Array<{ tool: string; args?: Record<string, unknown> }>;
  status: "draft" | "awaiting_user" | "executing" | "completed" | "blocked" | "failed";
  created_by?: number | null;
  created_at: string;
  updated_at: string;
};

export type AgentChatAction = {
  type: "link" | "signature" | "confirmation";
  label: string;
  href?: string;
  tool?: string;
  role?: "hr" | "finance";
  tool_call_id?: number;
};

export type AgentChatResponse = {
  conversation_id: number;
  message: Pick<AgentMessage, "id" | "sender" | "content" | "metadata">;
  tool_calls: AgentToolCall[];
  ui_actions: AgentChatAction[];
  state: Record<string, unknown>;
};

export type EmployeeRecord = {
  id: number;
  institution_id: number;
  employee_ref: string;
  auth_wallet: Address;
  name: string;
  email: string;
  status: "active" | "inactive" | "removed";
  created_at: string;
  updated_at: string;
};

export type WithdrawalRequest = {
  id: string;
  payroll_run_id: number;
  payroll_id: string;
  employee_ref: string;
  destination: Address;
  amount: string;
  nonce: number;
  expires_at: string;
  auth_digest: `0x${string}`;
  instruction_id?: string | null;
  ciphertext_hash?: string;
  old_ledger_root?: string;
  new_ledger_root?: string;
  withdrawal_nullifier?: string | null;
  request_tx_hash?: string;
  finalization_tx_hash?: string;
  payroll_processing_tx_hash?: string;
  status: string;
  error_message?: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  signing?: {
    method: "personal_sign";
    message_hash: `0x${string}`;
    message_encoding: string;
  };
};

export type EligibleWithdrawalPayroll = {
  payroll_run_id: number;
  payroll_id: string;
  title: string;
  period_label: string;
  institution_name: string;
  status: string;
  minimum_withdrawal_amount: string;
  withdrawal_deadline: string;
  has_open_request: boolean;
  payroll_processing_tx_hash?: string;
};

export type WithdrawalContext = {
  institution: Address;
  private_ledger_root: string;
  stablecoin: Address;
  stablecoin_decimals: number;
  status: number;
  withdrawal_deadline: number;
  settlement_deadline: number;
  pending_withdrawal_requests: number;
  minimum_withdrawal_amount: number;
  extension_id: number;
  gateway: Address;
  vault: Address;
  token: Address;
  employee_ref: string;
  next_nonce: number;
  available_withdrawal_amount: string;
  destination_wallet: Address;
  authorization_expires_at: number;
  payroll_processing_tx_hash?: string;
};

export type FccInstruction = {
  id: number;
  instruction_id: string;
  request_type: string;
  payroll_run_id: number;
  payroll_id: string;
  ciphertext_hash: string;
  selected_tee_id: Address;
  tee_signer: Address;
  tee_signer_epoch: number;
  requested_at?: string | null;
  request_tx_hash?: string;
  status: string;
  action_status?: number | null;
  action_log?: string;
  action_result_available: boolean;
  signature_verified: boolean;
  action_received_at?: string | null;
  finalization_tx_hash?: string;
  finalization_block_number?: number | null;
  closed_at?: string | null;
  error_message?: string;
  poll_attempts: number;
  last_polled_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollScheduleExecution = {
  id: number;
  scheduled_for: string;
  payroll_run?: number | null;
  status: string;
  message: string;
  created_at: string;
};

export type PayrollSchedule = {
  id: number;
  institution: number;
  name: string;
  title_template: string;
  period_label_template: string;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly";
  timezone_name: string;
  anchor_day?: number | null;
  next_run_at: string;
  funding_start_offset_minutes: number;
  funding_window_hours: number;
  minimum_withdrawal_window_seconds: number;
  settlement_grace_period_seconds: number;
  active: boolean;
  max_runs?: number | null;
  end_at?: string | null;
  run_count: number;
  last_run_at?: string | null;
  executions: PayrollScheduleExecution[];
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: number;
  institution?: number | null;
  institution_name?: string;
  actor?: number | null;
  actor_wallet: string;
  actor_wallet_display: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  request_id: string;
  source: string;
  created_at: string;
};
