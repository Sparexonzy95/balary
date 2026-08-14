import React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  useEligibleWithdrawals,
  usePrepareWithdrawal,
  useProcessWithdrawal,
  useSubmitWithdrawal,
  useSubmitPreparedWithdrawal,
  useWithdrawal,
  useWithdrawalContext,
  useWithdrawals,
} from "../hooks/useWithdrawals";
import { errorMessage } from "../lib/api";
import type { WithdrawalRequest } from "../lib/types";
import { formatDate, formatUsdc, shortAddress } from "../lib/utils";
import { useWallet } from "../lib/wallet";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  StatusBadge,
  useToast,
} from "../components/ui";
import { TransactionExplorerLink } from "../components/TransactionExplorerLink";
import { TransactionActivity } from "../components/TransactionActivity";
import { TransactionButton } from "../components/TransactionButton";

const TERMINAL_WITHDRAWAL_STATUSES = new Set([
  "finalized",
  "failed",
  "expired",
  "tee_failure",
]);

function isOpenWithdrawal(item: WithdrawalRequest) {
  return !TERMINAL_WITHDRAWAL_STATUSES.has(item.status);
}

function withdrawalActionLabel(item: WithdrawalRequest) {
  if (item.status === "signature_pending") return "Sign";
  if (isOpenWithdrawal(item)) return "Continue";
  return "Review";
}

export function withdrawalStatusText(status: string) {
  if (status === "signature_pending") return "Waiting for wallet confirmation";
  if (["authorized", "encrypted", "request_pending"].includes(status)) return "Preparing withdrawal";
  if (status === "tee_pending") return "TEE processing";
  if (["tee_success", "finalization_pending"].includes(status)) return "Finalizing settlement";
  if (status === "finalized") return "Withdrawal finalized";
  if (status === "expired") return "Withdrawal expired";
  if (["failed", "tee_failure"].includes(status)) return "Withdrawal failed";
  return "Preparing withdrawal";
}

export function PrivateWithdrawalsPage() {
  const withdrawals = useWithdrawals();
  const eligible = useEligibleWithdrawals();
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;
  const rows = withdrawals.data || [];
  const availablePayrolls = (eligible.data || []).filter((item) => !item.has_open_request);
  const openWithdrawals = rows.filter(isOpenWithdrawal);
  const finalizedWithdrawals = rows.filter((item) => item.status === "finalized");
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pendingTotal = openWithdrawals.reduce((sum, item) => sum + BigInt(item.amount || "0"), 0n);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign employee-claims-dashboard-page">
      <div className="employer-task-dashboard">
        <section className="employer-task-hero">
          <div className="employer-task-hero-copy">
            <span className="employer-task-kicker">Employee</span>
            <h1>
              Withdrawal <span>queue</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Prepare, authorize, and track private payroll withdrawals with the connected employee wallet.
            </p>
          </div>
          <div className="employer-task-hero-metrics" aria-label="Withdrawal summary">
            <div className="employer-task-hero-metric">
              <span>Available</span>
              <strong>{availablePayrolls.length}</strong>
            </div>
            <div className="employer-task-hero-metric">
              <span>Finalized</span>
              <strong>{finalizedWithdrawals.length}</strong>
            </div>
          </div>
        </section>

        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board">
            <div className="employer-task-card-head">
              <div>
                <span>Private settlement</span>
                <h2>Available Withdrawals</h2>
              </div>
              <Link className="btn btn-primary" to="/employee/claims/new">
                <LockKeyhole size={15} />
                New withdrawal
              </Link>
            </div>

            <div className="employee-claim-board-summary">
              <span>Open request total</span>
              <strong>{formatUsdc(pendingTotal, 6)} USD₮0</strong>
            </div>

            {withdrawals.isLoading || eligible.isLoading ? (
              <div className="employer-task-loading">Loading withdrawals...</div>
            ) : withdrawals.error || eligible.error ? (
              <ErrorState message={errorMessage(withdrawals.error || eligible.error)} />
            ) : availablePayrolls.length || rows.length ? (
              <>
                <div className="employer-task-payroll-list">
                  {availablePayrolls.map((payroll) => (
                    <Link
                      key={`available-${payroll.payroll_run_id}`}
                      className="employer-task-payroll-row"
                      to={`/employee/claims/new?payroll=${payroll.payroll_run_id}`}
                      aria-label={`Withdraw from ${payroll.title}`}
                    >
                      <span className="employer-task-row-copy">
                        <strong>{payroll.institution_name}</strong>
                        <span>{payroll.title} · {payroll.period_label}</span>
                      </span>
                      <StatusBadge value="claim" />
                      <span className="employer-task-view-link">Withdraw</span>
                      <ArrowRight size={16} strokeWidth={2} />
                    </Link>
                  ))}

                  {visibleRows.map((item) => (
                    <Link
                      key={item.id}
                      className="employer-task-payroll-row"
                      to={`/employee/claims/${item.id}`}
                      aria-label={`Open payroll ${item.payroll_id} withdrawal`}
                    >
                      <span className="employer-task-row-copy">
                        <strong>Payroll {item.payroll_id}</strong>
                        <span>
                          {formatUsdc(item.amount, 6)} USD₮0 · {shortAddress(item.destination)}
                        </span>
                      </span>
                      <StatusBadge value={item.status} />
                      <span className="employer-task-view-link">{withdrawalActionLabel(item)}</span>
                      <ArrowRight size={16} strokeWidth={2} />
                    </Link>
                  ))}
                </div>

                {rows.length > pageSize && (
                  <div className="employee-claims-pagination employer-payroll-pagination employer-task-pagination" aria-label="Withdrawals pagination">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
                    </span>
                    <div className="employee-claims-pagination-controls employer-payroll-pagination-controls">
                      <button
                        type="button"
                        className="employee-claims-page-btn employer-payroll-page-btn"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous withdrawals page"
                      >
                        <ChevronLeft size={15} strokeWidth={2} />
                      </button>
                      <span className="employee-claims-page-count employer-payroll-page-count">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="employee-claims-page-btn employer-payroll-page-btn"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next withdrawals page"
                      >
                        <ChevronRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title="No available withdrawals"
                description="Active payrolls available to this employee wallet will appear here automatically."
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function NewPrivateWithdrawalPage() {
  const prepare = usePrepareWithdrawal();
  const submitPrepared = useSubmitPreparedWithdrawal();
  const eligible = useEligibleWithdrawals();
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const navigate = useNavigate();
  const toast = useToast();
  const [payrollId, setPayrollId] = React.useState(searchParams.get("payroll") || "");
  const [phase, setPhase] = React.useState("Preparing withdrawal");
  const [error, setError] = React.useState<string | null>(null);
  const context = useWithdrawalContext(payrollId || undefined);
  const selectedPayroll = (eligible.data || []).find(
    (item) => String(item.payroll_run_id) === payrollId,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const parsedPayroll = Number(payrollId);
      if (!Number.isInteger(parsedPayroll) || parsedPayroll <= 0) {
        throw new Error("Select an available payroll.");
      }
      if (!context.data || BigInt(context.data.available_withdrawal_amount) <= 0n) {
        throw new Error("No withdrawable salary is available for this payroll.");
      }
      if (!wallet.provider || !wallet.address) {
        throw new Error("Connect the employee wallet before withdrawing salary.");
      }
      if (wallet.address.toLowerCase() !== context.data.destination_wallet.toLowerCase()) {
        throw new Error("Connected wallet does not match the backend-authorized destination wallet.");
      }
      setPhase("Preparing withdrawal");
      const request = await prepare.mutateAsync({ payroll_id: parsedPayroll });
      setPhase("Waiting for wallet confirmation");
      const signed = await wallet.provider.request({
        method: "personal_sign",
        params: [request.auth_digest, wallet.address],
      });
      if (typeof signed !== "string") {
        throw new Error("The wallet did not return a withdrawal signature.");
      }
      setPhase("TEE processing");
      await submitPrepared.mutateAsync({ withdrawalId: request.id, signature: signed });
      toast.push({
        kind: "success",
        title: "Withdrawal submitted",
        message: "The full authorized salary is now being processed by the TEE.",
      });
      navigate(`/employee/claims/${request.id}`);
    } catch (err) {
      setPhase("Withdrawal failed");
      setError(errorMessage(err));
    }
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign run-detail-page claim-detail-page">
      <Link className="template-detail-back-link run-detail-back-link" to="/employee/claims">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </Link>

      <section className="employer-task-hero run-detail-hero">
        <div className="employer-task-hero-copy run-detail-hero-copy">
          <span className="employer-task-kicker run-detail-hero-kicker">Employee withdrawal</span>
          <h1>Withdraw salary</h1>
          <p className="employer-task-hero-subtitle">
            Withdraw the complete backend-authorized salary allocation to your employee wallet.
          </p>
        </div>
        <div className="employer-task-hero-metrics run-detail-hero-metrics" aria-label="Withdrawal setup summary">
          <div className="employer-task-hero-metric">
            <span>Network</span>
            <strong>Coston2</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Asset</span>
            <strong>USD₮0</strong>
          </div>
        </div>
      </section>

      <form className="run-detail-command-panel" onSubmit={submit}>
        <div className="run-detail-summary-grid">
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ListChecks size={15} /></span>
            <Field label="Payroll ID">
              <select
                value={payrollId}
                onChange={(event) => setPayrollId(event.target.value)}
                required
              >
                <option value="">Select payroll</option>
                {(eligible.data || [])
                  .filter((item) => !item.has_open_request || String(item.payroll_run_id) === payrollId)
                  .map((item) => (
                    <option key={item.payroll_run_id} value={item.payroll_run_id}>
                      {item.payroll_id} · {item.institution_name} · {item.period_label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="template-detail-summary-item template-detail-summary-item-accent">
            <span className="template-detail-summary-icon"><CircleDollarSign size={15} /></span>
            <div>
              <span>Available withdrawable salary</span>
              <strong>
                {context.data
                  ? `${formatUsdc(context.data.available_withdrawal_amount, context.data.stablecoin_decimals)} USD₮0`
                  : context.isFetching ? "Checking..." : "Select payroll"}
              </strong>
            </div>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Wallet size={15} /></span>
            <div>
              <span>Destination wallet</span>
              <strong title={context.data?.destination_wallet}>
                {context.data?.destination_wallet ? shortAddress(context.data.destination_wallet) : "Connect wallet"}
              </strong>
            </div>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Clock3 size={15} /></span>
            <div>
              <span>Withdrawal expiry</span>
              <strong>
                {context.data?.authorization_expires_at
                  ? formatDate(new Date(context.data.authorization_expires_at * 1000).toISOString())
                  : context.isFetching
                    ? "Checking..."
                    : "Select payroll"}
              </strong>
            </div>
          </div>
        </div>

        <div className="run-detail-action-strip">
          <div>
            <strong>{phase}</strong>
            <span>
              {context.data
                ? "Amount, destination, payroll root, nonce, and expiry are fixed by the backend authorization."
                : selectedPayroll
                  ? `${selectedPayroll.institution_name} · ${selectedPayroll.period_label}`
                  : "Select an available payroll to load its full authorized salary."}
            </span>
            <TransactionExplorerLink
              hash={context.data?.payroll_processing_tx_hash}
              label="View payroll transaction"
            />
          </div>
          <TransactionButton
            type="submit"
            className="run-detail-primary-action"
            isProcessing={prepare.isPending || submitPrepared.isPending}
            idleLabel="Withdraw full salary"
            processingLabel={phase}
            icon={ShieldCheck}
            disabled={prepare.isPending || submitPrepared.isPending || !context.data}
          />
        </div>

        {(error || context.error) && (
          <div className="form-error">{error || errorMessage(context.error)}</div>
        )}
      </form>
    </div>
  );
}

export function PrivateWithdrawalDetailPage() {
  const { paymentId } = useParams();
  const withdrawal = useWithdrawal(paymentId);
  const submit = useSubmitWithdrawal(paymentId);
  const process = useProcessWithdrawal(paymentId);
  const wallet = useWallet();
  const toast = useToast();
  const [error, setError] = React.useState<string | null>(null);

  if (withdrawal.isLoading) return <LoadingState label="Loading private withdrawal" />;
  if (withdrawal.error || !withdrawal.data) return <ErrorState message={errorMessage(withdrawal.error)} />;

  const item = withdrawal.data;
  const waitingForSignature = item.status === "signature_pending";
  const processable = [
    "authorized",
    "encrypted",
    "request_pending",
    "tee_pending",
    "tee_success",
    "finalization_pending",
  ].includes(item.status);
  const completed = item.status === "finalized";
  const proof = item.finalization_tx_hash || item.request_tx_hash || item.instruction_id;

  async function signAuthorization() {
    setError(null);
    try {
      if (!wallet.provider || !wallet.address) {
        throw new Error("Connect the employee wallet before signing the withdrawal authorization");
      }
      const signed = await wallet.provider.request({
        method: "personal_sign",
        params: [item.auth_digest, wallet.address],
      });
      if (typeof signed !== "string") {
        throw new Error("The wallet did not return a withdrawal signature");
      }
      await submit.mutateAsync(signed);
      await withdrawal.refetch();
      toast.complete({
        title: "Withdrawal authorized",
        message: "The employee signature was verified and the private request is ready for processing.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function processRequest() {
    setError(null);
    try {
      await process.mutateAsync();
      await withdrawal.refetch();
      toast.push({
        kind: "success",
        title: "Withdrawal processing resumed",
        message: "Balary is tracking the private settlement and finalization workflow.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign run-detail-page claim-detail-page">
      <Link className="template-detail-back-link run-detail-back-link" to="/employee/claims">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </Link>

      <section className="employer-task-hero run-detail-hero">
        <div className="employer-task-hero-copy run-detail-hero-copy">
          <span className="employer-task-kicker run-detail-hero-kicker">Employee withdrawal</span>
          <h1>Payroll {item.payroll_id}</h1>
          <p className="employer-task-hero-subtitle">Root-bound private payroll settlement</p>
        </div>
        <div className="employer-task-hero-metrics run-detail-hero-metrics" aria-label="Withdrawal summary">
          <div className="employer-task-hero-metric">
            <span>Status</span>
            <strong>{withdrawalStatusText(item.status)}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Expires</span>
            <strong>{formatDate(item.expires_at)}</strong>
          </div>
        </div>
      </section>

      <section className="run-detail-command-panel">
        <div className="run-detail-summary-grid">
          <div className="template-detail-summary-item template-detail-summary-item-accent">
            <span className="template-detail-summary-icon"><CircleDollarSign size={15} /></span>
            <span>Available withdrawable salary</span>
            <strong>{formatUsdc(item.amount, 6)} USD₮0</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Wallet size={15} /></span>
            <span>Destination</span>
            <strong>{shortAddress(item.destination)}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ListChecks size={15} /></span>
            <span>Payroll id</span>
            <strong>{item.payroll_id}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Clock3 size={15} /></span>
            <span>Withdrawal expiry</span>
            <strong>{formatDate(item.expires_at)}</strong>
          </div>
        </div>

        {!completed && (
          <div className="run-detail-action-strip">
            <div>
              <strong>
                {waitingForSignature
                  ? "Authorize with wallet"
                  : processable
                    ? "Complete private settlement"
                    : withdrawalStatusText(item.status)}
              </strong>
              <span>
                {waitingForSignature
                  ? "Sign the exact authorization digest with the employee wallet."
                  : processable
                    ? "Resume the secure relayer and settlement workflow."
                    : `Current state: ${withdrawalStatusText(item.status)}.`}
              </span>
            </div>

            {waitingForSignature && (
              <TransactionButton
                type="button"
                className="run-detail-primary-action"
                onClick={signAuthorization}
                isProcessing={submit.isPending}
                idleLabel="Sign authorization"
                processingLabel="Confirm in wallet..."
                icon={ShieldCheck}
                disabled={submit.isPending}
              />
            )}

            {processable && (
              <TransactionButton
                type="button"
                className="run-detail-primary-action"
                onClick={processRequest}
                isProcessing={process.isPending}
                idleLabel="Process withdrawal"
                processingLabel="Processing withdrawal..."
                icon={RefreshCw}
                disabled={process.isPending}
              />
            )}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {item.error_message && <div className="form-error">{item.error_message}</div>}

        <TransactionActivity
          items={
            completed
              ? [
                  {
                    title: "Payroll transaction",
                    status: "Finalized",
                    txHash: item.payroll_processing_tx_hash,
                    tone: "complete",
                    emptyLabel: "No payroll transaction",
                  },
                  {
                    title: "Withdrawal request",
                    status: "Finalized",
                    txHash: item.request_tx_hash,
                    tone: "complete",
                    emptyLabel: "No request transaction",
                  },
                  {
                    title: "Final settlement",
                    status: `Finalized${item.completed_at ? ` on ${formatDate(item.completed_at)}` : ""}`,
                    txHash: item.finalization_tx_hash,
                    tone: "complete",
                    emptyLabel: "No settlement transaction",
                  },
                ]
              : [
                  {
                    title: "Private settlement",
                    status: withdrawalStatusText(item.status),
                    txHash: item.finalization_tx_hash || item.request_tx_hash,
                    tone: isOpenWithdrawal(item) ? "active" : "idle",
                    emptyLabel: proof ? shortAddress(proof) : "Pending",
                  },
                ]
          }
        />
      </section>
    </div>
  );
}
