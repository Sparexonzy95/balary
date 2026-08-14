import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  FileUp,
  Landmark,
  ListChecks,
  LogOut,
  Mail,
  PenLine,
  Plus,
  ReceiptText,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserMinus,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { adaptPayrollRun, adaptPreparedTransaction } from "../lib/adapters";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { txExplorerUrl } from "../lib/chains";
import { env } from "../lib/env";
import { backendReportedPayrollStatus, canGenerateMerkle } from "../lib/readiness";
import { routes } from "../lib/routes";
import type { InstitutionMember, PayrollRun, PreparedTx } from "../lib/types";
import { formatDate, formatUsdc, parseUsdc, shortAddress, titleCase } from "../lib/utils";
import { useWallet } from "../lib/wallet";
import { useAvailableClaims, useClaimPayload, useConfirmClaim } from "../hooks/useClaims";
import {
  hasInstitutionRole,
  useActiveInstitution,
  useConfirmRegistration,
  useConfirmRole,
  useConfirmRoleRemoval,
  useInstitutions,
  usePrepareRegistration,
  usePrepareRole,
  usePrepareRoleRemoval,
} from "../hooks/useInstitutions";
import {
  useConfirmPayrollTx,
  useCreatePayrollRun,
  useGeneratePayrollPackage,
  usePayrollRun,
  usePayrollRuns,
  usePreparePayrollTx,
  useValidatePayroll,
  useUploadPayroll,
} from "../hooks/usePayroll";
import { useTxSender } from "../hooks/useTxSender";
import { LandingPage as PremiumLandingPage } from "./LandingPage";
import { WelcomePage } from "./WelcomePage";
import { RegistrationStatusPanel } from "../components/RegistrationStatusPanel";
import { TransactionExplorerLink } from "../components/TransactionExplorerLink";
import { TransactionActivity } from "../components/TransactionActivity";
import { TransactionButton } from "../components/TransactionButton";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ExternalAnchor,
  Field,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
  SuccessNote,
  useToast,
} from "../components/ui";

function FormError({ message }: { message?: string | null }) {
  return message ? <div className="form-error">{message}</div> : null;
}

export function validateRegistrationInputs({
  treasury,
  taxVault,
  managerAddress,
}: {
  treasury: string;
  taxVault: string;
  managerAddress: string;
}) {
  const normalizedTreasury = treasury.trim().toLowerCase();
  const normalizedTaxVault = taxVault.trim().toLowerCase();
  const normalizedManager = managerAddress.trim().toLowerCase();

  if (normalizedTreasury === normalizedManager) {
    return "Treasury wallet cannot be the BalaryPayrollManager contract.";
  }
  if (normalizedTaxVault === normalizedManager) {
    return "Tax vault wallet cannot be the BalaryPayrollManager contract.";
  }
  return null;
}

function runActivityValue(run: PayrollRun) {
  const candidate = run.updated_at || run.created_at || run.claim_deadline;
  const timestamp = candidate ? new Date(candidate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : Number(run.id || 0);
}

function payrollAmount(run?: Pick<PayrollRun, "total_gross_amount" | "token_decimals"> | null) {
  if (!run) return "0 USD₮0";
  return `${formatUsdc(run.total_gross_amount, run.token_decimals)} USD₮0`;
}

function payrollDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function employeeClaimStatus(claim?: { claim_status?: "open" | "pending" | "claimed"; claim_tx_hash?: string | null } | null) {
  if (!claim) return "open";
  if (claim.claim_status) return claim.claim_status;
  return claim.claim_tx_hash ? "pending" : "open";
}

function TransactionProofActivity({
  title,
  status,
  txHash,
  tone,
}: {
  title: string;
  status: string;
  txHash?: string | null;
  tone: "complete" | "pending" | "active" | "idle";
}) {
  return <TransactionActivity items={[{ title, status, txHash, tone }]} />;
}

function payrollDisplayStatus(run?: PayrollRun | null) {
  const status = backendReportedPayrollStatus(run ?? undefined);
  if (status !== "funding_ready") return status;

  const fundingStartsAt = run?.funding_starts_at ? new Date(run.funding_starts_at) : null;
  if (fundingStartsAt && !Number.isNaN(fundingStartsAt.getTime()) && fundingStartsAt.getTime() > Date.now()) {
    return "scheduled";
  }

  return status;
}

function payrollListPriority(run: PayrollRun) {
  const status = payrollDisplayStatus(run);
  if (status === "funding_ready") return 0;
  if (status === "active" || status === "pending_funding") return 1;
  if (status === "scheduled") return 2;
  if (status === "finalized" || status === "finalised" || status === "completed" || status === "complete") return 3;
  return 4;
}

function sortPayrollRunsForList(runs: PayrollRun[]) {
  return [...runs].sort((a, b) => {
    const priorityDelta = payrollListPriority(a) - payrollListPriority(b);
    if (priorityDelta) return priorityDelta;
    return runActivityValue(b) - runActivityValue(a);
  });
}

function PayrollTable({
  runs,
  emptyLabel = "No payroll runs yet.",
  detailBasePath = "/hr/payrolls",
}: {
  runs?: PayrollRun[];
  emptyLabel?: string;
  detailBasePath?: "/hr/payrolls" | "/finance/payrolls";
}) {
  if (!runs?.length) {
    return (
      <div className="employer-task-card employer-payroll-board">
        <EmptyState title={emptyLabel} description="Create or fund a run to see it here." />
      </div>
    );
  }
  return (
    <div className="employer-task-payroll-list">
      {sortPayrollRunsForList(runs).map((run) => (
        <Link
          key={run.id}
          className="employer-task-payroll-row"
          to={`${detailBasePath}/${run.id}`}
          aria-label={`Open ${run.title}`}
        >
          <span className="employer-task-row-copy">
            <strong>{run.title}</strong>
            <span>{run.period_label} - {payrollAmount(run)}</span>
          </span>
          <StatusBadge value={payrollDisplayStatus(run)} />
          <span className="employer-task-view-link">View</span>
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
      ))}
    </div>
  );
}

export function LandingPage() {
  return <PremiumLandingPage />;
}

export function LoginPage() {
  return <WelcomePage />;
}

export function AppHomePage() {
  const auth = useAuth();
  const institutions = useInstitutions();
  const walletAddress = auth.account?.wallet_address;
  const institutionList = institutions.data || [];

  if (institutions.isLoading) return <LoadingState label="Loading workspace" />;

  const target =
    institutionList.some((institution) => hasInstitutionRole(institution, walletAddress, "admin"))
      ? "/institution"
      : institutionList.some((institution) => hasInstitutionRole(institution, walletAddress, "hr"))
        ? "/hr"
        : institutionList.some((institution) => hasInstitutionRole(institution, walletAddress, "finance"))
          ? "/finance"
          : institutionList.length === 0
            ? "/institution/register"
            : "/employee/claims";

  return <Navigate to={target} replace />;
}

export function InstitutionPage() {
  const { institution, isLoading, error } = useActiveInstitution();
  const auth = useAuth();

  if (isLoading) {
    return (
      <div className="onboarding-page employer-onboarding-page dashboard-shell">
        <div className="employer-onboarding-head">
          <div>
            <div className="employer-kicker">Institution</div>
            <h1>Loading workspace</h1>
            <p>Checking the connected wallet against your Balary institution.</p>
          </div>
        </div>
        <Card className="employer-onboarding-card" title="Institution status">
          <LoadingState label="Loading institution" />
        </Card>
      </div>
    );
  }
  if (error) return <ErrorState message={errorMessage(error)} />;

  if (!institution) {
    return (
      <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign">
        <section className="employer-task-hero">
          <div className="employer-task-hero-copy">
            <h1>
              Register your <span>institution</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Set treasury and tax vault wallets before assigning payroll roles.
            </p>
          </div>
          <div className="employer-task-actions">
            <Link className="employer-task-primary-action" to="/institution/register">
              <Building2 size={15} strokeWidth={2} />
              Register institution
            </Link>
          </div>
        </section>
        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board">
            <EmptyState
              title="No active institution found"
              description="Register with the connected wallet, then wait for backend receipt sync to activate the admin role."
            />
          </section>
        </main>
      </div>
    );
  }

  const activeRoles = institution.members.filter((member) => member.status === "active");
  const roleOrder: Record<string, number> = { admin: 0, hr: 1, finance: 2 };
  const sortedMembers = [...activeRoles].sort((a, b) => {
    const roleDelta = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
    if (roleDelta) return roleDelta;
    return a.wallet_address.localeCompare(b.wallet_address);
  });

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign template-detail-page institution-workspace-page">
      <section className="employer-task-hero template-detail-hero">
        <div className="employer-task-hero-copy template-detail-hero-copy">
          <span className="employer-task-kicker">Institution workspace</span>
          <h1>{institution.name}</h1>
          <p className="employer-task-hero-subtitle">
            Connected as {shortAddress(auth.account?.wallet_address)}.
          </p>
        </div>

        <div className="employer-task-hero-metrics template-detail-hero-metrics" aria-label="Institution summary">
          <div className="employer-task-hero-metric">
            <span>Status</span>
            <strong>{titleCase(institution.registration_status)}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Active members</span>
            <strong>{activeRoles.length}</strong>
          </div>
        </div>
      </section>

      <div className="template-detail-layout institution-workspace-layout">
        <main className="template-detail-main institution-workspace-main">
          <section className="template-detail-command-panel institution-profile-panel">
            <div className="institution-panel-head">
              <div>
                <span className="institution-panel-kicker">Members</span>
                <h2>Active access</h2>
              </div>
              <Link className="btn run-detail-primary-action institution-panel-action" to="/institution/roles">
                <UsersRound size={15} />
                Manage roles
              </Link>
            </div>

            <div className="institution-member-list">
              {sortedMembers.length ? (
                sortedMembers.map((member) => (
                  <div className="institution-member-row" key={member.id}>
                    <span className="institution-member-icon"><UsersRound size={15} /></span>
                    <span className="institution-member-copy">
                      <strong>{titleCase(member.role)}</strong>
                      <span>{shortAddress(member.wallet_address)}</span>
                    </span>
                    <StatusBadge value={member.status} />
                  </div>
                ))
              ) : (
                <EmptyState title="No active members" description="Use Manage roles to assign payroll access." />
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function RegisterInstitutionPage() {
  const auth = useAuth();
  const institutionQuery = useActiveInstitution();
  const prepare = usePrepareRegistration();
  const confirm = useConfirmRegistration();
  const txSender = useTxSender();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [notificationEmail, setNotificationEmail] = React.useState(auth.account?.email || "");
  const [treasury, setTreasury] = React.useState("");
  const [taxVault, setTaxVault] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [lastHash, setLastHash] = React.useState<string | null>(null);
  const [registrationStep, setRegistrationStep] = React.useState<0 | 1 | 2>(1);

  React.useEffect(() => {
    const institution = institutionQuery.institution;
    if (!institution || institution.registration_status !== "failed") return;
    if (!name) setName(institution.name);
    if (!notificationEmail) setNotificationEmail(institution.notification_email || auth.account?.email || "");
    if (!treasury) setTreasury(institution.treasury_address);
    if (!taxVault) setTaxVault(institution.tax_vault_address);
  }, [auth.account?.email, institutionQuery.institution, name, notificationEmail, taxVault, treasury]);

  React.useEffect(() => {
    if (!notificationEmail && auth.account?.email) setNotificationEmail(auth.account.email);
  }, [auth.account?.email, notificationEmail]);

  const existingInstitution = institutionQuery.institution;
  const showRegistrationForm =
    !existingInstitution ||
    existingInstitution.registration_status === "draft" ||
    (existingInstitution.registration_status === "failed" && existingInstitution.can_retry_registration);
  const detailsReady = Boolean(name.trim() && isValidEmail(notificationEmail.trim()) && treasury.trim() && taxVault.trim());
  const walletAddress = auth.account?.wallet_address;
  const registrationConfirmed = Boolean(
    existingInstitution?.is_registered_onchain ||
      existingInstitution?.registration_status === "confirmed"
  );
  const registrationPending = existingInstitution?.registration_status === "pending";
  const registrationFailed = existingInstitution?.registration_status === "failed";
  const activeStepCopy = [
    { label: "Step 01", title: "Wallet verified" },
    { label: "Step 02", title: "Institution profile" },
    { label: "Step 03", title: registrationConfirmed ? "Registration confirmed" : registrationFailed ? "Registration needs attention" : "Submit registration" },
  ][registrationStep];

  React.useEffect(() => {
    if (registrationConfirmed || registrationPending || registrationFailed || lastHash) {
      setRegistrationStep(2);
    }
  }, [lastHash, registrationConfirmed, registrationFailed, registrationPending]);

  function canOpenRegistrationStep(step: 0 | 1 | 2) {
    if (step < 2) return true;
    return detailsReady || Boolean(existingInstitution);
  }

  function goToRegistrationStep(step: 0 | 1 | 2) {
    if (!canOpenRegistrationStep(step)) return;
    setRegistrationStep(step);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!showRegistrationForm) {
        throw new Error("Registration is already being tracked. Refresh status before submitting another transaction.");
      }
      if (!detailsReady) {
        throw new Error("Institution name, notification email, treasury wallet, and tax vault wallet are required.");
      }
      const validationError = validateRegistrationInputs({
        treasury,
        taxVault,
        managerAddress: env.payrollManager,
      });
      if (validationError) throw new Error(validationError);
      const prepared = await prepare.mutateAsync({
        name,
        notification_email: notificationEmail.trim().toLowerCase(),
        treasury_address: treasury,
        tax_vault_address: taxVault,
      });
      const hash = await txSender.sendPrepared(prepared, "Institution registration");
      setLastHash(hash);
      await confirm.mutateAsync({ institution_id: prepared.institution_id, tx_hash: hash });
      // Wait for the institution data to be available after confirmation
      await institutionQuery.refetch();
      toast.complete({
        title: "Institution registration confirmed",
        message: "Your institution is now registered on Flare Coston2. Admin access activated.",
      });
      navigate("/institution");
    } catch (err) {
      setError(errorMessage(err));
      institutionQuery.refetch();
    }
  }

  if (institutionQuery.isLoading) return <LoadingState label="Loading registration" />;
  if (institutionQuery.error) return <ErrorState message={errorMessage(institutionQuery.error)} />;

  return (
    <div className="onboarding-page employer-onboarding-page dashboard-shell">
      <div className="employer-onboarding-head">
        <div>
          <div className="employer-kicker">Institution onboarding</div>
          <h1>Register institution</h1>
          <p>
            The connected wallet becomes Institution Admin after Flare Coston2 confirmation.
          </p>
        </div>

        <div className="employer-onboarding-side">
          <div className="employer-onboarding-wallet">
            <span className="employer-onboarding-wallet-icon" aria-label="Verified wallet">
              <Wallet size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <strong>{shortAddress(walletAddress)}</strong>
          </div>
        </div>
      </div>

      <div className="employer-onboarding-carousel">
        <div className="employer-onboarding-flow-top">
          <div className="employer-onboarding-flow-copy">
            <span>{activeStepCopy.label}</span>
            <h2>{activeStepCopy.title}</h2>
          </div>
          <div className="employer-onboarding-flow-count">
            Step {registrationStep + 1} of 3
          </div>
        </div>

        <div className="employer-onboarding-status" aria-label="Institution registration progress">
          {([
            { number: "01", title: "Wallet", caption: "Verified", step: 0 as const },
            { number: "02", title: "Profile", caption: "Institution details", step: 1 as const },
            { number: "03", title: "On-chain", caption: registrationConfirmed ? "Confirmed" : "Flare Coston2", step: 2 as const },
          ]).map((step) => {
            const active = step.step === registrationStep;
            const complete =
              step.step === 0 ||
              (step.step === 1 && detailsReady) ||
              (step.step === 2 && registrationConfirmed);
            return (
              <button
                key={step.number}
                type="button"
                className={`employer-onboarding-status-item${active ? " active" : ""}${complete ? " complete" : ""}`}
                onClick={() => goToRegistrationStep(step.step)}
                disabled={!canOpenRegistrationStep(step.step)}
                aria-current={active ? "step" : undefined}
              >
                <span>{complete ? <Check size={13} strokeWidth={2} /> : step.number}</span>
                <strong>{step.title}</strong>
                <small>{step.caption}</small>
              </button>
            );
          })}
        </div>

        <div className="employer-onboarding-carousel-viewport">
          <div
            className="employer-onboarding-carousel-track"
            style={{ transform: `translateX(-${registrationStep * 100}%)` }}
          >
            <div className="employer-onboarding-slide">
              <Card
                className="employer-onboarding-card employer-onboarding-wallet-verified-card"
                title="Wallet verified"
                subtitle="This wallet is attached to your Balary institution workspace."
                actions={
                  <div className="employer-onboarding-wallet-card">
                    <strong>{shortAddress(walletAddress)}</strong>
                    <span className="employer-onboarding-wallet-icon" aria-label="Verified wallet">
                      <Wallet size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </div>
                }
              >
                <div className="employer-onboarding-slide-actions">
                  <Button type="button" onClick={() => goToRegistrationStep(1)}>
                    Continue to Profile
                    <ArrowRight size={15} strokeWidth={1.8} />
                  </Button>
                </div>
              </Card>
            </div>

            <div className="employer-onboarding-slide">
              <Card
                className="employer-onboarding-card"
                title="Institution profile"
                subtitle="Treasury and tax vault addresses for payroll operations."
              >
                <div className="form-stack">
                  <Field label="Institution name">
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Balary Academy" required />
                  </Field>
                  <Field label="Institution email">
                    <input type="email" value={notificationEmail} onChange={(event) => setNotificationEmail(event.target.value)} placeholder="ops@example.com" required />
                  </Field>
                  <Field label="Treasury wallet">
                    <input value={treasury} onChange={(event) => setTreasury(event.target.value)} placeholder="0x..." required />
                  </Field>
                  <Field label="Tax vault wallet">
                    <input value={taxVault} onChange={(event) => setTaxVault(event.target.value)} placeholder="0x..." required />
                  </Field>
                  <div className="employer-onboarding-slide-actions">
                    <Button type="button" variant="secondary" onClick={() => goToRegistrationStep(0)}>
                      <ArrowLeft size={15} strokeWidth={1.8} />
                      Back
                    </Button>
                    <Button type="button" onClick={() => goToRegistrationStep(2)} disabled={!detailsReady}>
                      Review Registration
                      <ArrowRight size={15} strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <div className="employer-onboarding-slide">
              {existingInstitution && !showRegistrationForm ? (
                <RegistrationStatusPanel
                  institution={existingInstitution}
                  onRefresh={() => institutionQuery.refetch()}
                  isRefreshing={institutionQuery.isFetching}
                />
              ) : (
                <Card
                  className="employer-onboarding-card"
                  title={existingInstitution?.registration_status === "failed" ? "Retry registration" : "Submit registration"}
                  subtitle="Balary prepares the transaction and your wallet signs it."
                >
                  <form className="form-stack" onSubmit={submit}>
                    <div className="create-payroll-review-list">
                      <div className="review-row">
                        <span>Institution</span>
                        <strong>{name || "Not set"}</strong>
                      </div>
                      <div className="review-row">
                        <span>Email</span>
                        <strong>{notificationEmail || "Not set"}</strong>
                      </div>
                      <div className="review-row">
                        <span>Treasury</span>
                        <strong>{shortAddress(treasury)}</strong>
                      </div>
                      <div className="review-row">
                        <span>Tax vault</span>
                        <strong>{shortAddress(taxVault)}</strong>
                      </div>
                      <div className="review-row">
                        <span>Manager</span>
                        <strong>{shortAddress(env.payrollManager)}</strong>
                      </div>
                    </div>
                    <FormError message={error || txSender.lastError} />
                    {lastHash && <SuccessNote>Submitted {shortAddress(lastHash)}. Check status in transactions.</SuccessNote>}
                    <div className="employer-onboarding-slide-actions">
                      <Button type="button" variant="secondary" onClick={() => goToRegistrationStep(1)}>
                        <ArrowLeft size={15} strokeWidth={1.8} />
                        Back
                      </Button>
                      <TransactionButton
                        type="submit"
                        isProcessing={prepare.isPending || confirm.isPending || txSender.busy}
                        idleLabel={existingInstitution?.registration_status === "failed" ? "Retry with wallet" : "Register with wallet"}
                        processingLabel="Processing registration..."
                        icon={Send}
                        disabled={!detailsReady}
                      />
                    </div>
                  </form>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RolesPage() {
  const auth = useAuth();
  const { institution, isLoading } = useActiveInstitution();
  const prepare = usePrepareRole(institution?.id);
  const confirm = useConfirmRole(institution?.id);
  const prepareRemoval = usePrepareRoleRemoval(institution?.id);
  const confirmRemoval = useConfirmRoleRemoval(institution?.id);
  const txSender = useTxSender();
  const toast = useToast();
  const [walletAddress, setWalletAddress] = React.useState("");
  const [roleEmail, setRoleEmail] = React.useState("");
  const [role, setRole] = React.useState<"hr" | "finance">("hr");
  const [assignmentStep, setAssignmentStep] = React.useState<0 | 1 | 2>(0);
  const [showAssignmentWizard, setShowAssignmentWizard] = React.useState(false);
  const [selectedRemovalId, setSelectedRemovalId] = React.useState<number | null>(null);
  const [lastRoleHash, setLastRoleHash] = React.useState<string | null>(null);
  const [lastRemovalHash, setLastRemovalHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [removalError, setRemovalError] = React.useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading roles" />;
  if (!institution) return <EmptyState title="Register an institution first" action={<Link className="btn btn-primary btn-md" to="/institution/register">Register</Link>} />;

  const isAdmin = hasInstitutionRole(institution, auth.account?.wallet_address, "admin");
  const activeHrMembers = institution.members.filter((member) => member.role === "hr" && member.status === "active");
  const activeFinanceMembers = institution.members.filter((member) => member.role === "finance" && member.status === "active");
  const removableMembers = institution.members.filter(
    (member) => (member.role === "hr" || member.role === "finance") && member.status === "active",
  );
  const selectedRemovalMember = removableMembers.find((member) => member.id === selectedRemovalId) || null;
  const currentWalletHasHr = hasInstitutionRole(institution, auth.account?.wallet_address, "hr");
  const currentWalletHasFinance = hasInstitutionRole(institution, auth.account?.wallet_address, "finance");
  const roleSetupComplete = activeHrMembers.length > 0 && activeFinanceMembers.length > 0;
  const shouldShowAssignmentWizard = showAssignmentWizard || !roleSetupComplete;
  const trimmedWalletAddress = walletAddress.trim();
  const trimmedRoleEmail = roleEmail.trim().toLowerCase();
  const normalizedWalletAddress = trimmedWalletAddress.toLowerCase();
  const walletLooksValid = /^0x[a-fA-F0-9]{40}$/.test(trimmedWalletAddress);
  const roleEmailLooksValid = isValidEmail(trimmedRoleEmail);
  const existingRoleMember = normalizedWalletAddress
    ? institution.members.find(
        (member) =>
          member.wallet_address.toLowerCase() === normalizedWalletAddress &&
          member.role === role &&
          member.status !== "removed",
      )
    : null;
  const roleAlreadyAssigned = Boolean(
    existingRoleMember &&
      (existingRoleMember.status === "active" ||
        existingRoleMember.status === "pending_onchain" ||
        existingRoleMember.assigned_tx_hash),
  );
  const assignmentNotice = existingRoleMember
    ? roleAlreadyAssigned
      ? existingRoleMember.status === "active"
        ? `${shortAddress(existingRoleMember.wallet_address)} already has ${titleCase(role)} access.`
        : `${shortAddress(existingRoleMember.wallet_address)} already has a ${titleCase(role)} transaction pending.`
      : `${shortAddress(existingRoleMember.wallet_address)} has an invite record. Continue to submit the on-chain ${titleCase(role)} transaction.`
    : null;
  const selectedRoleCopy = role === "hr"
    ? {
        title: "HR",
        detail: "Creates payroll drafts, uploads rows, schedules runs, and marks payroll ready for funding.",
        dashboard: "HR dashboard",
      }
    : {
        title: "Finance",
        detail: "Funds payroll runs after HR has created and activated them for funding.",
        dashboard: "Finance dashboard",
      };
  const assignmentSteps = [
    { title: "Role", caption: selectedRoleCopy.title },
    { title: "Wallet", caption: walletLooksValid ? shortAddress(trimmedWalletAddress) : "Target address" },
    { title: "Submit", caption: roleAlreadyAssigned ? "Blocked" : roleEmailLooksValid ? "On-chain" : "Email needed" },
  ];

  function chooseRole(nextRole: "hr" | "finance") {
    setRole(nextRole);
    setError(null);
    setLastRoleHash(null);
  }

  function startAnotherAssignment() {
    setShowAssignmentWizard(true);
    setAssignmentStep(0);
    setWalletAddress("");
    setRoleEmail("");
    setSelectedRemovalId(null);
    setError(null);
    setRemovalError(null);
    setLastRoleHash(null);
    setLastRemovalHash(null);
  }

  function startRoleRemoval(member: InstitutionMember) {
    if (member.role !== "hr" && member.role !== "finance") return;
    setShowAssignmentWizard(false);
    setSelectedRemovalId(member.id);
    setRemovalError(null);
    setError(null);
    setLastRemovalHash(null);
  }

  function cancelRoleRemoval() {
    setSelectedRemovalId(null);
    setRemovalError(null);
    setLastRemovalHash(null);
  }

  function memberStatusLabel(member: InstitutionMember) {
    if (member.status === "active" && member.removed_tx_hash) return "Pending removal";
    return titleCase(member.status);
  }

  function updateWalletAddress(value: string) {
    setWalletAddress(value);
    setError(null);
    setLastRoleHash(null);
  }

  function updateRoleEmail(value: string) {
    setRoleEmail(value);
    setError(null);
    setLastRoleHash(null);
  }

  function goToAssignmentStep(step: 0 | 1 | 2) {
    if (step === 2 && (!walletLooksValid || !roleEmailLooksValid)) {
      setError("Enter a valid wallet address and notification email before review.");
      return;
    }
    setError(null);
    setAssignmentStep(step);
  }

  function continueToReview() {
    if (!walletLooksValid || !roleEmailLooksValid) {
      setError("Enter a valid wallet address and notification email before review.");
      return;
    }
    if (roleAlreadyAssigned) {
      setError(assignmentNotice);
      return;
    }
    goToAssignmentStep(2);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!walletLooksValid || !roleEmailLooksValid) {
      setError("Enter a valid wallet address and notification email before submitting.");
      setAssignmentStep(1);
      return;
    }
    if (roleAlreadyAssigned) {
      setError(assignmentNotice);
      return;
    }
    try {
      const prepared = await prepare.mutateAsync({ role, wallet_address: trimmedWalletAddress, notification_email: trimmedRoleEmail });
      const hash = await txSender.sendPrepared(prepared, `Assign ${titleCase(role)}`);
      await confirm.mutateAsync({ role, wallet_address: trimmedWalletAddress, notification_email: trimmedRoleEmail, tx_hash: hash });
      setLastRoleHash(hash);
      toast.complete({
        title: `${selectedRoleCopy.title} role submitted`,
        message: `${shortAddress(trimmedWalletAddress)} will receive ${selectedRoleCopy.dashboard} access after confirmation.`,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitRoleRemoval(member: InstitutionMember) {
    if (member.role !== "hr" && member.role !== "finance") return;
    setRemovalError(null);
    try {
      const prepared = await prepareRemoval.mutateAsync({ role: member.role, wallet_address: member.wallet_address });
      const hash = await txSender.sendPrepared(prepared, `Remove ${titleCase(member.role)}`);
      await confirmRemoval.mutateAsync({ role: member.role, wallet_address: member.wallet_address, tx_hash: hash });
      setLastRemovalHash(hash);
      toast.complete({
        title: `${titleCase(member.role)} removal submitted`,
        message: `${shortAddress(member.wallet_address)} will lose access after the revoke transaction confirms.`,
      });
    } catch (err) {
      setRemovalError(errorMessage(err));
    }
  }

  function renderRoleRemovalPanel() {
    if (removableMembers.length === 0) return null;
    return (
      <div className="role-removal-panel">
        <div className="role-removal-head">
          <div>
            <span>Active role wallets</span>
            <strong>Remove access</strong>
          </div>
        </div>
        <div className="role-removal-list">
          {removableMembers.map((member) => {
            const pendingRemoval = Boolean(member.removed_tx_hash);
            return (
              <div className="role-removal-row" key={member.id}>
                <span className="template-detail-sidebar-row-icon"><UsersRound size={14} /></span>
                <div>
                  <strong>{titleCase(member.role)} - {pendingRemoval ? "Pending removal" : "Active"}</strong>
                  <span>{shortAddress(member.wallet_address)}</span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => startRoleRemoval(member)}
                  disabled={pendingRemoval || Boolean(lastRemovalHash)}
                >
                  <UserMinus size={14} />
                  {pendingRemoval ? "Pending" : "Remove"}
                </Button>
              </div>
            );
          })}
        </div>
        {selectedRemovalMember && (
          <div className="role-removal-confirm">
            <div>
              <span>Confirm removal</span>
              <strong>
                Remove {titleCase(selectedRemovalMember.role)} from {shortAddress(selectedRemovalMember.wallet_address)}
              </strong>
            </div>
            <p>
              This submits an on-chain role update. The wallet keeps access until the revoke transaction confirms.
            </p>
            {lastRemovalHash && (
              <SuccessNote>
                Removal submitted {shortAddress(lastRemovalHash)}. Refresh after confirmation.
              </SuccessNote>
            )}
            <FormError message={removalError || txSender.lastError} />
            <div className="role-removal-actions">
              <Button type="button" variant="secondary" onClick={cancelRoleRemoval} disabled={prepareRemoval.isPending || confirmRemoval.isPending || txSender.busy}>
                Cancel
              </Button>
              <TransactionButton
                type="button"
                variant="danger"
                onClick={() => submitRoleRemoval(selectedRemovalMember)}
                isProcessing={prepareRemoval.isPending || confirmRemoval.isPending || txSender.busy}
                idleLabel={lastRemovalHash ? "Submitted" : "Remove role"}
                processingLabel={txSender.busy ? "Confirming transaction..." : "Processing removal..."}
                icon={UserMinus}
                disabled={
                  prepareRemoval.isPending ||
                  confirmRemoval.isPending ||
                  txSender.busy ||
                  Boolean(selectedRemovalMember.removed_tx_hash) ||
                  Boolean(lastRemovalHash)
                }
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign template-detail-page role-assignment-page">
      <section className="employer-task-hero template-detail-hero">
        <div className="employer-task-hero-copy template-detail-hero-copy">
          <span className="employer-task-kicker">Roles</span>
          <h1>Institution roles</h1>
          <p className="employer-task-hero-subtitle">
            Admins assign HR and Finance wallets.
          </p>
        </div>
        <div className="employer-task-hero-metrics template-detail-hero-metrics">
          <div className="employer-task-hero-metric">
            <span>Members</span>
            <strong>{institution.members.length}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Access</span>
            <strong>{isAdmin ? "Admin" : "Read only"}</strong>
          </div>
        </div>
      </section>

      <div className="template-detail-layout">
        <main className="template-detail-main">
          <section className="template-detail-command-panel">
            <div className="template-detail-action-strip">
              <div>
                <strong>{roleSetupComplete && !shouldShowAssignmentWizard ? "Role setup complete" : "Assign role"}</strong>
                <span>
                  {roleSetupComplete && !shouldShowAssignmentWizard
                    ? "HR and Finance access are active."
                    : "Choose a payroll role and wallet."}
                </span>
              </div>
            </div>
            {!isAdmin ? (
              <EmptyState title="Admin role required" description="Only an active institution admin can assign payroll roles." />
            ) : roleSetupComplete && !shouldShowAssignmentWizard ? (
              <div className="role-complete-panel">
                <div className="role-complete-head">
                  <span className="role-complete-icon"><CheckCircle2 size={18} /></span>
                  <div>
                    <span>Setup complete</span>
                    <h2>Roles are active</h2>
                    <p>Institution access is ready. Active HR and Finance wallets can now enter their dashboards.</p>
                  </div>
                </div>

                <div className="role-complete-grid">
                  <div className="role-complete-card">
                    <span>HR wallets</span>
                    <strong>{activeHrMembers.length}</strong>
                  </div>
                  <div className="role-complete-card">
                    <span>Finance wallets</span>
                    <strong>{activeFinanceMembers.length}</strong>
                  </div>
                  <div className="role-complete-card">
                    <span>Your access</span>
                    <strong>{[isAdmin && "Admin", currentWalletHasHr && "HR", currentWalletHasFinance && "Finance"].filter(Boolean).join(" / ")}</strong>
                  </div>
                </div>

                {renderRoleRemovalPanel()}

                <div className="role-complete-actions">
                  <Link className="btn btn-secondary" to="/institution">
                    <Building2 size={15} />
                    Institution
                  </Link>
                  {currentWalletHasHr && (
                    <Link className="btn" to="/hr">
                      <ListChecks size={15} />
                      HR dashboard
                    </Link>
                  )}
                  {currentWalletHasFinance && (
                    <Link className="btn" to="/finance">
                      <Landmark size={15} />
                      Finance dashboard
                    </Link>
                  )}
                  <Button type="button" variant="secondary" onClick={startAnotherAssignment}>
                    <Plus size={15} />
                    Assign another
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <form className="role-assignment-wizard" onSubmit={submit}>
                  <div className="role-assignment-steps" aria-label="Role assignment progress">
                    {assignmentSteps.map((step, index) => {
                      const stepIndex = index as 0 | 1 | 2;
                      const active = assignmentStep === stepIndex;
                      const complete = assignmentStep > stepIndex || Boolean(lastRoleHash && stepIndex === 2);
                      const disabled = stepIndex === 2 && (!walletLooksValid || !roleEmailLooksValid);
                      return (
                        <button
                          type="button"
                          key={step.title}
                          className={`role-assignment-step${active ? " active" : ""}${complete ? " complete" : ""}`}
                          onClick={() => goToAssignmentStep(stepIndex)}
                          disabled={disabled}
                          aria-current={active ? "step" : undefined}
                        >
                          <span>{complete ? <Check size={13} strokeWidth={2.2} /> : `0${index + 1}`}</span>
                          <strong>{step.title}</strong>
                          <small>{step.caption}</small>
                        </button>
                      );
                    })}
                  </div>

                {assignmentStep === 0 && (
                  <div className="role-assignment-panel">
                    <div className="role-assignment-panel-head">
                      <span>Step 1 of 3</span>
                      <h2>Choose role</h2>
                    </div>
                    <div className="role-choice-grid">
                      {([
                        ["hr", "HR", "Create payroll drafts, upload rows, and prepare runs for Finance."],
                        ["finance", "Finance", "Fund ready payroll runs and move employees into the claim stage."],
                      ] as const).map(([value, title, detail]) => (
                        <button
                          type="button"
                          key={value}
                          className={`role-choice-card${role === value ? " active" : ""}`}
                          onClick={() => chooseRole(value)}
                        >
                          <span className="role-choice-icon">
                            {value === "hr" ? <UsersRound size={17} /> : <Landmark size={17} />}
                          </span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </button>
                      ))}
                    </div>
                    <div className="role-assignment-actions">
                      <Button type="button" onClick={() => goToAssignmentStep(1)}>
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}

                {assignmentStep === 1 && (
                  <div className="role-assignment-panel">
                    <div className="role-assignment-panel-head">
                      <span>Step 2 of 3</span>
                      <h2>Enter wallet</h2>
                    </div>
                    <Field label={`${selectedRoleCopy.title} wallet address`}>
                      <input value={walletAddress} onChange={(event) => updateWalletAddress(event.target.value)} placeholder="0x..." required />
                    </Field>
                    <Field label={`${selectedRoleCopy.title} email`}>
                      <input type="email" value={roleEmail} onChange={(event) => updateRoleEmail(event.target.value)} placeholder={role === "hr" ? "hr@example.com" : "finance@example.com"} required />
                    </Field>
                    <div className="role-access-note">
                      {selectedRoleCopy.dashboard} access becomes available after the role transaction confirms on-chain. Notifications are sent to this email.
                    </div>
                    <div className="role-assignment-actions">
                      <Button type="button" variant="secondary" onClick={() => goToAssignmentStep(0)}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <Button type="button" onClick={continueToReview} disabled={!walletLooksValid || !roleEmailLooksValid || roleAlreadyAssigned}>
                        Review
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}

                {assignmentStep === 2 && (
                  <div className="role-assignment-panel">
                    <div className="role-assignment-panel-head">
                      <span>Step 3 of 3</span>
                      <h2>Review assignment</h2>
                    </div>
                    <div className="create-payroll-review-list role-review-list">
                      <div className="review-row"><span>Institution</span><strong>{institution.name}</strong></div>
                      <div className="review-row"><span>Role</span><strong>{selectedRoleCopy.title}</strong></div>
                      <div className="review-row"><span>Wallet</span><strong>{shortAddress(trimmedWalletAddress)}</strong></div>
                      <div className="review-row"><span>Email</span><strong>{trimmedRoleEmail}</strong></div>
                      <div className="review-row"><span>Access</span><strong>{selectedRoleCopy.dashboard}</strong></div>
                    </div>
                    <div className="role-access-note">
                      The wallet can open the {selectedRoleCopy.dashboard} after the transaction is confirmed.
                    </div>
                    {lastRoleHash && (
                      <SuccessNote>
                        Submitted {shortAddress(lastRoleHash)}. Refresh the institution page after confirmation.
                      </SuccessNote>
                    )}
                    <div className="role-assignment-actions">
                      <Button type="button" variant="secondary" onClick={() => goToAssignmentStep(1)}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <TransactionButton
                        type="submit"
                        isProcessing={prepare.isPending || confirm.isPending || txSender.busy}
                        idleLabel={roleAlreadyAssigned ? "Role already assigned" : lastRoleHash ? "Submitted" : "Submit role"}
                        processingLabel="Processing assignment..."
                        icon={UsersRound}
                        disabled={roleAlreadyAssigned || !roleEmailLooksValid || Boolean(lastRoleHash)}
                      />
                    </div>
                  </div>
                )}

                {assignmentNotice && (
                  <div className="role-assignment-notice">
                    {assignmentNotice}
                  </div>
                )}
                  <FormError message={error || txSender.lastError} />
                </form>
                {renderRoleRemovalPanel()}
              </>
            )}
          </section>
        </main>

        <aside className="template-detail-sidebar">
          <div className="template-detail-sidebar-card">
            <span className="template-detail-sidebar-card-label">{institution.name}</span>
            {institution.members.map((member) => (
              <div className="template-detail-sidebar-row" key={member.id}>
                <span className="template-detail-sidebar-row-icon"><UsersRound size={14} /></span>
                <div>
                  <span>{titleCase(member.role)} - {memberStatusLabel(member)}</span>
                  <strong>{shortAddress(member.wallet_address)}</strong>
                  {member.notification_email && <small>{member.notification_email}</small>}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function HRDashboardPage() {
  const payrolls = usePayrollRuns();
  const { institution } = useActiveInstitution();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "draft" | "ready" | "active" | "failed">("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;

  const runs = React.useMemo(
    () => sortPayrollRunsForList(payrolls.data || []),
    [payrolls.data],
  );
  const filteredRuns = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return runs.filter((run) => {
      const status = backendReportedPayrollStatus(run);
      const matchesSearch =
        !query ||
        run.title.toLowerCase().includes(query) ||
        run.period_label.toLowerCase().includes(query) ||
        String(run.id).includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "draft" && ["draft", "uploaded", "validated", "merkle_ready", "pending_create_draft", "draft_created_onchain"].includes(status)) ||
        (filter === "ready" && ["pending_upload", "uploaded_onchain", "pending_activation", "funding_ready"].includes(status)) ||
        (filter === "active" && ["pending_funding", "active", "finalized"].includes(status)) ||
        (filter === "failed" && ["failed", "cancelled", "expired"].includes(status));
      return matchesSearch && matchesFilter;
    });
  }, [filter, runs, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const visibleRuns = filteredRuns.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const latestRun = runs[0];
  const totalVolume = runs.reduce((sum, run) => sum + BigInt(run.total_gross_amount || "0"), 0n);
  const statusCounts = runs.reduce(
    (counts, run) => {
      const status = backendReportedPayrollStatus(run);
      if (["failed", "cancelled", "expired"].includes(status)) counts.failed += 1;
      else if (["pending_funding", "active", "finalized"].includes(status)) counts.active += 1;
      else if (["pending_upload", "uploaded_onchain", "pending_activation", "funding_ready"].includes(status)) counts.ready += 1;
      else counts.draft += 1;
      return counts;
    },
    { draft: 0, ready: 0, active: 0, failed: 0 },
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  const filterOptions = [
    { value: "all" as const, label: "All" },
    { value: "draft" as const, label: "Draft" },
    { value: "ready" as const, label: "Ready" },
    { value: "active" as const, label: "Active" },
    { value: "failed" as const, label: "Failed" },
  ];

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign">
      <div className="employer-task-dashboard">
        <section className="employer-task-hero" data-tour="employer-hero">
          <div className="employer-task-hero-copy">
            <span className="employer-task-kicker">HR payroll</span>
            <h1>
              Welcome back, <span>{institution?.name || "Balary"}</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Create drafts, upload payroll rows, build Merkle packages, and move runs to Finance.
            </p>
          </div>

          <div className="employer-task-hero-metrics" aria-label="Payroll summary">
            <div className="employer-task-hero-metric">
              <span>Payroll Volume</span>
              <strong>{formatUsdc(totalVolume, latestRun?.token_decimals || 6)} USD₮0</strong>
            </div>
            <div className="employer-task-hero-metric">
              <span>Latest Run</span>
              <strong>{payrollDate(latestRun?.updated_at || latestRun?.created_at)}</strong>
            </div>
          </div>

          <div className="employer-task-actions">
            <Link className="employer-task-primary-action" to="/hr/payrolls/new" data-tour="employer-new-template">
              <Plus size={15} strokeWidth={2} />
              New Payroll
            </Link>
          </div>
        </section>

        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board" data-tour="employer-templates">
            <div className="employer-task-card-head">
              <div>
                <span>Payroll queue</span>
                <h2>Your Payroll</h2>
              </div>
              <span className="employer-task-count">
                {filteredRuns.length} item{filteredRuns.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="employer-task-board-tools">
              <label className="employer-task-search">
                <Search size={17} strokeWidth={1.8} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search payroll..."
                />
              </label>

              <div className="employer-payroll-filter-area employer-task-filter-area">
                <button type="button" className="employer-payroll-filter-trigger" aria-label="Filter payroll">
                  <SlidersHorizontal size={15} strokeWidth={1.9} />
                  <span>{filterOptions.find((option) => option.value === filter)?.label}</span>
                </button>
                <div className="filter-tabs employer-payroll-filters employer-task-filters">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`filter-tab${filter === option.value ? " active" : ""}`}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {payrolls.isLoading ? (
              <div className="employer-task-loading">Loading payroll...</div>
            ) : runs.length === 0 ? (
              <EmptyState
                title="No payroll yet"
                description="Create a draft run, then upload and validate payment rows."
                action={<Link className="btn" to="/hr/payrolls/new">Create Payroll</Link>}
              />
            ) : filteredRuns.length === 0 ? (
              <p className="muted employer-task-empty">No payroll matches your current filter.</p>
            ) : (
              <>
                <PayrollTable runs={visibleRuns} />
                {totalPages > 1 && (
                  <div className="employee-claims-pagination employer-payroll-pagination employer-task-pagination" aria-label="Payroll pagination">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRuns.length)} of {filteredRuns.length}
                    </span>
                    <div className="employee-claims-pagination-controls employer-payroll-pagination-controls">
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous payroll page">
                        <ChevronLeft size={15} strokeWidth={2} />
                      </button>
                      <span className="employee-claims-page-count employer-payroll-page-count">
                        {currentPage} / {totalPages}
                      </span>
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next payroll page">
                        <ChevronRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>

        <aside className="employer-task-side">
          <Link className="employer-task-primary-action employer-sidebar-new-payroll" to="/hr/payrolls/new">
            <Plus size={15} strokeWidth={2} />
            New Payroll
          </Link>
          <div className="employer-task-card employer-status-sidebar">
            <div className="employer-status-sidebar-head">
              <span className="employer-task-side-icon">
                <ListChecks size={14} strokeWidth={1.9} />
              </span>
              <div>
                <span>Payroll Status</span>
                <strong>{runs.length} total</strong>
              </div>
            </div>
            {[
              { label: "Draft", value: statusCounts.draft },
              { label: "Ready", value: statusCounts.ready },
              { label: "Active", value: statusCounts.active },
              { label: "Failed", value: statusCounts.failed },
            ].map((item) => (
              <div key={item.label} className="employer-status-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

type EmployeeDraftRow = {
  employeeRef?: string;
  address: string;
  name: string;
  email: string;
  amount: string;
};

type PayrollWizardPhase = 0 | 1 | 2;
type Frequency = "one_time" | "daily" | "weekly" | "monthly";
type RecurringFrequency = Exclude<Frequency, "one_time">;

type ScheduleFormState = {
  frequency: Frequency;
  firstRunAt: string;
  claimDeadlineAt: string;
  cycles: number;
};

type RecurringDraft = {
  startsOn: string;
  sendTime: string;
  frequency: RecurringFrequency;
  runCount: number;
};

type PayrollPreparationStep = "create" | "upload" | "activate";

const RECURRING_FREQ_OPTIONS: {
  value: RecurringFrequency;
  label: string;
}[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const PHASE_COPY: Record<PayrollWizardPhase, { nextLabel?: string }> = {
  0: { nextLabel: "Continue to Schedule" },
  1: { nextLabel: "Review Draft" },
  2: {},
};

const PAYROLL_CONFIRMATION_POLL_MS = 4_000;
const PAYROLL_CONFIRMATION_ATTEMPTS = 60;
const MAX_RECURRING_RUNS = 24;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preparedPayloads(payload: PreparedTx | PreparedTx[]) {
  return Array.isArray(payload) ? payload : [payload];
}

function payrollStepConfirmed(run: PayrollRun, step: PayrollPreparationStep) {
  if (run.status === "failed") return false;
  if (step === "create") {
    return Boolean(
      run.onchain_payroll_id &&
        [
          "draft_created_onchain",
          "merkle_ready",
          "pending_upload",
          "uploaded_onchain",
          "pending_activation",
          "funding_ready",
          "pending_funding",
          "active",
          "finalized",
        ].includes(run.status),
    );
  }
  if (step === "upload") {
    return ["uploaded_onchain", "pending_activation", "funding_ready", "pending_funding", "active", "finalized"].includes(run.status);
  }
  return ["funding_ready", "pending_funding", "active", "finalized"].includes(run.status);
}

function payrollStepLabel(step: PayrollPreparationStep) {
  if (step === "create") return "payroll draft";
  if (step === "upload") return "payroll package";
  return "funding handoff";
}

function emptyEmployeeDraftRow(): EmployeeDraftRow {
  return { address: "", name: "", email: "", amount: "" };
}

function hasEmployeeInput(row: EmployeeDraftRow) {
  return Boolean(row.address.trim() || row.name.trim() || row.email.trim() || row.amount.trim());
}

function isValidAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseEmployeesCsv(content: string): EmployeeDraftRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one employee row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const addressIndex = headers.findIndex((header) =>
    ["address", "wallet", "wallet_address", "employee_address"].includes(header),
  );
  const nameIndex = headers.findIndex((header) =>
    ["name", "employee_name", "fullname", "full_name"].includes(header),
  );
  const emailIndex = headers.findIndex((header) =>
    ["email", "employee_email", "work_email"].includes(header),
  );
  const amountIndex = headers.findIndex((header) =>
    ["amount", "salary", "amount_usdc", "pay", "pay_amount", "net_amount"].includes(header),
  );

  if (addressIndex === -1 || emailIndex === -1 || amountIndex === -1) {
    throw new Error("CSV headers must include address, email, and amount. Optional header: name.");
  }

  return lines
    .slice(1)
    .map(parseCsvLine)
    .map((cells) => ({
      address: cells[addressIndex] ?? "",
      name: nameIndex >= 0 ? cells[nameIndex] ?? "" : "",
      email: cells[emailIndex] ?? "",
      amount: cells[amountIndex] ?? "",
    }))
    .filter(hasEmployeeInput);
}

function csvEscape(value: string) {
  const normalized = value.trim();
  if (!/[",\n\r]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

type BackendEmployee = {
  id: number;
  employee_ref: string;
  auth_wallet: string;
  name: string;
  email: string;
  status: string;
};

async function ensureBackendEmployees(institutionId: number, rows: EmployeeDraftRow[]) {
  const existingResponse = await api.get<BackendEmployee[]>(routes.employees.list, {
    params: { institution_id: institutionId },
  });
  const byWallet = new Map(
    existingResponse.data.map((employee) => [employee.auth_wallet.toLowerCase(), employee]),
  );
  const enriched: EmployeeDraftRow[] = [];

  for (const row of rows) {
    const wallet = row.address.trim().toLowerCase();
    let employee = byWallet.get(wallet);
    if (!employee) {
      const created = await api.post<BackendEmployee>(routes.employees.list, {
        institution_id: institutionId,
        auth_wallet: wallet,
        name: row.name.trim() || "Employee",
        email: row.email.trim().toLowerCase(),
      });
      employee = created.data;
      byWallet.set(wallet, employee);
    } else if (employee.status !== "active") {
      const activated = await api.patch<BackendEmployee>(routes.employees.status(employee.id), {
        status: "active",
      });
      employee = activated.data;
      byWallet.set(wallet, employee);
    }
    enriched.push({ ...row, employeeRef: employee.employee_ref });
  }

  return enriched;
}

function buildBackendPayrollCsv(rows: EmployeeDraftRow[]) {
  return [
    "employee_ref,auth_address,gross_amount,bonus_amount,deductions_amount,tax_amount",
    ...rows.map((row) =>
      [
        csvEscape(row.employeeRef || ""),
        csvEscape(row.address.toLowerCase()),
        csvEscape(row.amount),
        "0",
        "0",
        "0",
      ].join(","),
    ),
  ].join("\n");
}

function defaultFirstRunAt() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return localDateTimeInputValue(date);
}

function addDaysToLocalDateTime(value: string, days: number) {
  const date = parseLocalDatetime(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return localDateTimeInputValue(date);
}

function localDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toTimeInputValue(value: string) {
  return value && value.includes("T") ? value.slice(11, 16) : "09:00";
}

function mergeDateAndTime(date: string, time: string) {
  if (!date) return "";
  return `${date}T${time || "09:00"}`;
}

function addMonthsSafe(date: Date, months: number) {
  const next = new Date(date);
  const originalDate = next.getDate();

  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== originalDate) {
    next.setDate(0);
  }

  return next;
}

function addFrequencyToDate(date: Date, frequency: Frequency, offset: number) {
  const next = new Date(date);
  if (offset <= 0 || frequency === "one_time") return next;
  if (frequency === "daily") next.setDate(next.getDate() + offset);
  if (frequency === "weekly") next.setDate(next.getDate() + offset * 7);
  if (frequency === "monthly") return addMonthsSafe(next, offset);
  return next;
}

function claimWindowMs(schedule: ScheduleFormState) {
  const funding = parseLocalDatetime(schedule.firstRunAt);
  const deadline = parseLocalDatetime(schedule.claimDeadlineAt);
  if (Number.isNaN(funding.getTime()) || Number.isNaN(deadline.getTime())) return 0;
  return deadline.getTime() - funding.getTime();
}

function buildScheduleOccurrences(schedule: ScheduleFormState) {
  const firstFunding = parseLocalDatetime(schedule.firstRunAt);
  const windowMs = claimWindowMs(schedule);
  const count = resolveRunCount(schedule);

  if (Number.isNaN(firstFunding.getTime()) || windowMs <= 0 || count < 1) return [];

  return Array.from({ length: count }, (_, index) => {
    const fundingDate = addFrequencyToDate(firstFunding, schedule.frequency, index);
    const claimDeadline = new Date(fundingDate.getTime() + windowMs);

    return {
      fundingStartsAt: localDateTimeInputValue(fundingDate),
      claimDeadlineAt: localDateTimeInputValue(claimDeadline),
      periodLabel: periodLabelFor(localDateTimeInputValue(fundingDate)),
    };
  });
}

function formatDateOnly(value: string) {
  if (!value) return "Not selected";

  const date = new Date(`${value}T00:00`);

  if (Number.isNaN(date.getTime())) return "Not selected";

  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatScheduleDateTime(value: string) {
  if (!value) return "Not selected";

  const date = parseLocalDatetime(value);

  if (Number.isNaN(date.getTime())) return "Not selected";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function frequencyLabel(value: Frequency | RecurringFrequency) {
  if (value === "one_time") return "One-time";
  if (value === "daily") return "Daily";
  if (value === "weekly") return "Weekly";
  if (value === "monthly") return "Monthly";
  return value;
}

function parseLocalDatetime(value: string) {
  return new Date(value);
}

function resolveRunCount(schedule: ScheduleFormState) {
  if (schedule.frequency === "one_time") return 1;
  const cycles = Number(schedule.cycles ?? 0);
  return Number.isFinite(cycles) && cycles > 0 ? cycles : 0;
}

function schedulePreview(schedule: ScheduleFormState) {
  if (!schedule.firstRunAt) return "Pick when funding opens.";

  const fundingDate = parseLocalDatetime(schedule.firstRunAt);
  const claimDeadline = parseLocalDatetime(schedule.claimDeadlineAt);
  if (Number.isNaN(fundingDate.getTime()) || Number.isNaN(claimDeadline.getTime())) return "Invalid schedule.";

  const funding = fundingDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const deadline = claimDeadline.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (schedule.frequency === "one_time") {
    return `Funding opens ${funding}. Claims close ${deadline}.`;
  }

  const runs = resolveRunCount(schedule);
  const cadence =
    schedule.frequency === "daily"
      ? "every day"
      : schedule.frequency === "weekly"
        ? "every week"
        : "every month";

  return `Funding opens ${cadence} starting ${funding}. Claims close per run after the same window. Total ${runs} run${runs === 1 ? "" : "s"}.`;
}

function validateScheduleForm(schedule: ScheduleFormState) {
  const errors: Record<string, string> = {};

  if (!schedule.firstRunAt) {
    errors.firstRunAt = "Funding open date & time is required.";
  } else {
    const date = parseLocalDatetime(schedule.firstRunAt);
    if (Number.isNaN(date.getTime())) {
      errors.firstRunAt = "Invalid date / time.";
    } else if (date.getTime() < Date.now() - 60_000) {
      errors.firstRunAt = "Funding open time must not be in the past.";
    }
  }

  if (!schedule.claimDeadlineAt) {
    errors.claimDeadlineAt = "Claim deadline is required.";
  } else {
    const fundingDate = parseLocalDatetime(schedule.firstRunAt);
    const deadline = parseLocalDatetime(schedule.claimDeadlineAt);
    if (Number.isNaN(deadline.getTime())) {
      errors.claimDeadlineAt = "Invalid claim deadline.";
    } else if (!Number.isNaN(fundingDate.getTime()) && deadline.getTime() < fundingDate.getTime() + 24 * 60 * 60 * 1000) {
      errors.claimDeadlineAt = "Claim deadline must be at least 1 day after funding opens.";
    }
  }

  if (schedule.frequency !== "one_time") {
    const cycles = Number(schedule.cycles ?? 0);
    if (!Number.isFinite(cycles) || cycles < 2) errors.cycles = "Enter at least 2 runs for recurring payroll.";
    else if (cycles > MAX_RECURRING_RUNS) errors.cycles = `Maximum ${MAX_RECURRING_RUNS} runs for upfront on-chain creation.`;
  }

  return errors;
}

function periodLabelFor(firstRunAt: string) {
  const parsed = new Date(firstRunAt);
  if (Number.isNaN(parsed.getTime())) return "Payroll period";
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(parsed);
}

export function CreatePayrollPage() {
  const auth = useAuth();
  const { institution } = useActiveInstitution();
  const create = useCreatePayrollRun();
  const txSender = useTxSender();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const csvInputRef = React.useRef<HTMLInputElement | null>(null);
  const employeeStackRef = React.useRef<HTMLDivElement | null>(null);
  const defaultRunAt = React.useMemo(() => defaultFirstRunAt(), []);
  const defaultClaimDeadlineAt = React.useMemo(() => addDaysToLocalDateTime(defaultRunAt, 7), [defaultRunAt]);
  const initialScheduleDate = toDateInputValue(defaultRunAt);
  const [title, setTitle] = React.useState("");
  const [schedule, setSchedule] = React.useState<ScheduleFormState>({
    frequency: "one_time",
    firstRunAt: defaultRunAt,
    claimDeadlineAt: defaultClaimDeadlineAt,
    cycles: 1,
  });
  const [recurringSaved, setRecurringSaved] = React.useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = React.useState(false);
  const [recurringDraft, setRecurringDraft] = React.useState<RecurringDraft>({
    startsOn: initialScheduleDate,
    sendTime: toTimeInputValue(defaultRunAt),
    frequency: "monthly",
    runCount: 12,
  });
  const [employees, setEmployees] = React.useState<EmployeeDraftRow[]>([emptyEmployeeDraftRow()]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = React.useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [wizardPhase, setWizardPhase] = React.useState<PayrollWizardPhase>(0);
  const activeEmployees = employees.filter(hasEmployeeInput);
  const perRunTotal = employees.reduce((sum, employee) => {
    const value = Number(employee.amount.trim());
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const runCount = resolveRunCount(schedule);
  const totalBudget = perRunTotal * runCount;
  const previewText = schedulePreview(schedule);
  const phaseCopy = PHASE_COPY[wizardPhase];
  const sendDate = toDateInputValue(schedule.firstRunAt);
  const sendTime = toTimeInputValue(schedule.firstRunAt);
  const claimDeadlineDate = toDateInputValue(schedule.claimDeadlineAt);
  const claimDeadlineTime = toTimeInputValue(schedule.claimDeadlineAt);
  const isRecurringPayroll = recurringSaved && schedule.frequency !== "one_time";

  function setSched(patch: Partial<ScheduleFormState>) {
    setSchedule((current) => ({ ...current, ...patch }));
  }

  function handleSendDateChange(dateValue: string) {
    const currentTime = toTimeInputValue(schedule.firstRunAt);
    const nextFirstRunAt = mergeDateAndTime(dateValue, currentTime);
    const windowMs = Math.max(claimWindowMs(schedule), 7 * 24 * 60 * 60 * 1000);
    const nextFundingDate = parseLocalDatetime(nextFirstRunAt);
    const nextClaimDeadlineAt = Number.isNaN(nextFundingDate.getTime())
      ? schedule.claimDeadlineAt
      : localDateTimeInputValue(new Date(nextFundingDate.getTime() + windowMs));

    setSched({ firstRunAt: nextFirstRunAt, claimDeadlineAt: nextClaimDeadlineAt });

    setRecurringDraft((current) => ({
      ...current,
      startsOn: dateValue,
    }));
  }

  function handleSendTimeChange(timeValue: string) {
    const currentDate = toDateInputValue(schedule.firstRunAt);
    const nextFirstRunAt = mergeDateAndTime(currentDate, timeValue);
    const windowMs = Math.max(claimWindowMs(schedule), 7 * 24 * 60 * 60 * 1000);
    const nextFundingDate = parseLocalDatetime(nextFirstRunAt);
    const nextClaimDeadlineAt = Number.isNaN(nextFundingDate.getTime())
      ? schedule.claimDeadlineAt
      : localDateTimeInputValue(new Date(nextFundingDate.getTime() + windowMs));

    setSched({ firstRunAt: nextFirstRunAt, claimDeadlineAt: nextClaimDeadlineAt });

    setRecurringDraft((current) => ({
      ...current,
      sendTime: timeValue,
    }));
  }

  function handleClaimDeadlineDateChange(dateValue: string) {
    const currentTime = toTimeInputValue(schedule.claimDeadlineAt);
    setSched({ claimDeadlineAt: mergeDateAndTime(dateValue, currentTime) });
  }

  function handleClaimDeadlineTimeChange(timeValue: string) {
    const currentDate = toDateInputValue(schedule.claimDeadlineAt);
    setSched({ claimDeadlineAt: mergeDateAndTime(currentDate, timeValue) });
  }

  function openRecurringModal() {
    const currentDate = toDateInputValue(schedule.firstRunAt);
    const currentTime = toTimeInputValue(schedule.firstRunAt);

    setRecurringDraft((current) => ({
      ...current,
      startsOn: current.startsOn || currentDate,
      sendTime: current.sendTime || currentTime,
      frequency: schedule.frequency === "one_time" ? current.frequency : (schedule.frequency as RecurringFrequency),
      runCount: Math.max(1, schedule.cycles || current.runCount || 12),
    }));

    setRecurringModalOpen(true);
  }

  function closeRecurringModal() {
    setRecurringModalOpen(false);
  }

  function turnOffRecurringPayroll() {
    setRecurringSaved(false);
    setRecurringModalOpen(false);
    setSched({ frequency: "one_time", cycles: 1 });
  }

function saveRecurringDetails() {
    const startsOn = recurringDraft.startsOn;
    const nextSendTime = recurringDraft.sendTime || "09:00";

    if (!startsOn) {
      setError("Select the recurring payroll start date.");
      return;
    }

    if (!nextSendTime) {
      setError("Select the payroll send time.");
      return;
    }

    const nextCycles = Number(recurringDraft.runCount || 1);

    if (!Number.isFinite(nextCycles) || nextCycles < 2) {
      setError("Enter at least 2 payroll runs.");
      return;
    }

    setError(null);
    setRecurringSaved(true);
    setRecurringModalOpen(false);
    const nextFirstRunAt = mergeDateAndTime(startsOn, nextSendTime);
    const windowMs = Math.max(claimWindowMs(schedule), 7 * 24 * 60 * 60 * 1000);
    const nextFundingDate = parseLocalDatetime(nextFirstRunAt);
    const nextClaimDeadlineAt = Number.isNaN(nextFundingDate.getTime())
      ? schedule.claimDeadlineAt
      : localDateTimeInputValue(new Date(nextFundingDate.getTime() + windowMs));
    setSchedule({
      frequency: recurringDraft.frequency,
      firstRunAt: nextFirstRunAt,
      claimDeadlineAt: nextClaimDeadlineAt,
      cycles: Math.max(2, Math.min(nextCycles, MAX_RECURRING_RUNS)),
    });
  }

  function updateEmployee(index: number, patch: Partial<EmployeeDraftRow>) {
    setEmployees((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function scrollToEmployeeFields() {
    window.setTimeout(() => {
      employeeStackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function addEmployeeRow() {
    setEmployees((rows) => [...rows, emptyEmployeeDraftRow()]);
    scrollToEmployeeFields();
  }

  function removeEmployeeRow(index: number) {
    setEmployees((rows) => (rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function triggerCsvUpload() {
    csvInputRef.current?.click();
  }

  function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedRows = parseEmployeesCsv(String(reader.result ?? ""));
        if (importedRows.length === 0) throw new Error("No employees found in the CSV file.");
        setEmployees((rows) => {
          const existingRows = rows.filter(hasEmployeeInput);
          return existingRows.length === 0 ? importedRows : [...existingRows, ...importedRows];
        });
        setError(null);
        toast.push({
          kind: "success",
          title: "CSV imported",
          message: `${importedRows.length} employee${importedRows.length === 1 ? "" : "s"} added from CSV.`,
        });
        scrollToEmployeeFields();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not import CSV file.";
        setError(message);
        toast.push({ kind: "error", title: "CSV import failed", message });
      }
    };
    reader.onerror = () => setError("Could not read the CSV file.");
    reader.readAsText(file);
  }

  function validatePayrollSetup() {
    setError(null);
    if (!title.trim()) {
      setError("Add a payroll title before continuing.");
      return false;
    }
    return true;
  }

  function validateEmployeeRows() {
    setError(null);
    if (activeEmployees.length === 0) {
      setError("Add at least one employee before continuing.");
      return false;
    }

    const seenAddresses = new Set<string>();
    for (const row of activeEmployees) {
      const address = row.address.trim();
      const email = row.email.trim();
      const amount = row.amount.trim();

      if (!isValidAddress(address)) {
        setError(`Invalid employee wallet address: ${address || "empty"}`);
        return false;
      }
      if (!email || !isValidEmail(email)) {
        setError(`Invalid employee email: ${email || "empty"}`);
        return false;
      }
      try {
        if (BigInt(parseUsdc(amount, 6)) <= 0n) {
          setError(`Invalid amount for ${address}.`);
          return false;
        }
      } catch {
        setError(`Invalid amount for ${address}.`);
        return false;
      }
      const normalizedAddress = address.toLowerCase();
      if (seenAddresses.has(normalizedAddress)) {
        setError(`Duplicate employee wallet address: ${normalizedAddress}`);
        return false;
      }
      seenAddresses.add(normalizedAddress);
    }
    return true;
  }

  function validatePayrollSchedule() {
    setError(null);
    const errors = validateScheduleForm(schedule);
    setScheduleErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0]);
      return false;
    }

    return true;
  }

  function goNextPhase() {
    if (wizardPhase === 0 && (!validatePayrollSetup() || !validateEmployeeRows())) return;
    if (wizardPhase === 1 && !validatePayrollSchedule()) return;
    setError(null);
    setWizardPhase((phase) => (phase === 0 ? 1 : 2));
  }

  function goPreviousPhase() {
    setError(null);
    setWizardPhase((phase) => (phase === 2 ? 1 : 0));
  }

  async function syncAndFetchPayroll(runId: number) {
    await api.get(routes.transactions.list).catch(() => undefined);
    const response = await api.get<Record<string, unknown>>(routes.payroll.detail(runId));
    return adaptPayrollRun(response.data);
  }

  async function waitForPayrollStep(runId: number, step: PayrollPreparationStep) {
    const label = payrollStepLabel(step);
    for (let attempt = 0; attempt < PAYROLL_CONFIRMATION_ATTEMPTS; attempt += 1) {
      const latest = await syncAndFetchPayroll(runId);
      if (latest.status === "failed") {
        throw new Error(`The ${label} transaction failed on-chain. Open Transactions for the tracked error.`);
      }
      if (payrollStepConfirmed(latest, step)) return latest;
      setSubmitStatus(`Waiting for ${label} confirmation...`);
      await sleep(PAYROLL_CONFIRMATION_POLL_MS);
    }
    throw new Error(`The ${label} transaction is still pending. The backend will keep syncing it automatically.`);
  }

  async function submitPayrollTransaction(runId: number, step: PayrollPreparationStep, label: string) {
    const prepareEndpoint = {
      create: routes.payroll.prepareCreateDraft(runId),
      upload: routes.payroll.prepareUpload(runId),
      activate: routes.payroll.prepareActivate(runId),
    }[step];
    const confirmEndpoint = {
      create: routes.payroll.confirmCreateDraft(runId),
      upload: routes.payroll.confirmUpload(runId),
      activate: routes.payroll.confirmActivate(runId),
    }[step];
    const response = await api.post<{ prepared_transaction: Record<string, unknown> }>(
      prepareEndpoint,
      {},
      { headers: { "Idempotency-Key": `payroll-${runId}-${step}-${Date.now()}` } },
    );
    const payload = adaptPreparedTransaction(response.data.prepared_transaction);
    const lastHash = await txSender.sendPrepared(payload, label);
    await api.post(confirmEndpoint, {
      prepared_transaction_id: payload.id,
      tx_hash: lastHash,
    });
    return lastHash;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!institution) return;
    setBusy(true);
    setError(null);
    setSubmitStatus(null);
    try {
      if (!validatePayrollSetup() || !validateEmployeeRows() || !validatePayrollSchedule()) return;
      const occurrences = buildScheduleOccurrences(schedule);
      if (occurrences.length === 0) throw new Error("Invalid payroll schedule.");

      const payrollType = schedule.frequency === "one_time" ? "one_time" : "recurring";
      const seriesKey =
        payrollType === "recurring"
          ? `series-${Date.now()}-${Math.random().toString(16).slice(2)}`
          : "";
      setSubmitStatus("Syncing encrypted employee records...");
      const backendEmployees = await ensureBackendEmployees(institution.id, activeEmployees);
      const csvContent = buildBackendPayrollCsv(backendEmployees);
      let financeReadyRun: PayrollRun | null = null;

      for (let index = 0; index < occurrences.length; index += 1) {
        const occurrence = occurrences[index];
        const fundingStartsAt = parseLocalDatetime(occurrence.fundingStartsAt);
        const claimDeadline = parseLocalDatetime(occurrence.claimDeadlineAt);
        if (Number.isNaN(fundingStartsAt.getTime()) || Number.isNaN(claimDeadline.getTime())) {
          throw new Error("Invalid payroll date / time.");
        }

        const runNumber = occurrences.length > 1 ? ` ${index + 1}/${occurrences.length}` : "";
        setSubmitStatus(`Creating payroll draft${runNumber}...`);
        const run = await create.mutateAsync({
          institution_id: institution.id,
          title: occurrences.length > 1 ? `${title.trim()} - ${occurrence.periodLabel}` : title.trim(),
          period_label: occurrence.periodLabel,
          payroll_type: payrollType,
          recurring_frequency: payrollType === "recurring" ? (schedule.frequency as RecurringFrequency) : "",
          recurring_series_key: seriesKey,
          recurring_index: index + 1,
          recurring_total: occurrences.length,
          funding_starts_at: fundingStartsAt.toISOString(),
          claim_deadline: claimDeadline.toISOString(),
          token_address: env.usdcToken,
        });
        setSubmitStatus(`Uploading and validating employee rows${runNumber}...`);
        const payrollFile = new FormData();
        payrollFile.append("file", new File([csvContent], "payroll.csv", { type: "text/csv" }));
        await api.post(routes.payroll.upload(run.id), payrollFile);

        setSubmitStatus(`Creating payroll draft on-chain${runNumber}...`);
        await submitPayrollTransaction(run.id, "create", "Create payroll draft");
        const draftRun = await waitForPayrollStep(run.id, "create");

        setSubmitStatus(`Requesting confidential computation${runNumber}...`);
        await submitPayrollTransaction(draftRun.id, "upload", "Upload payroll package");
        const uploadedRun = await waitForPayrollStep(draftRun.id, "upload");

        setSubmitStatus(`Marking payroll ready for Finance${runNumber}...`);
        await submitPayrollTransaction(uploadedRun.id, "activate", "Mark funding ready");
        financeReadyRun = await waitForPayrollStep(uploadedRun.id, "activate");
      }

      if (!financeReadyRun) throw new Error("Payroll was not created.");

      await queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });

      toast.push({
        kind: "success",
        title: occurrences.length > 1 ? "Recurring payroll ready for Finance" : "Payroll ready for Finance",
        message:
          occurrences.length > 1
            ? `${occurrences.length} scheduled payroll run${occurrences.length === 1 ? "" : "s"} created. Finance can fund each after its send time.`
            : "HR setup is complete. Finance can fund after the scheduled send time.",
      });
      toast.complete({
        title: occurrences.length > 1 ? "Recurring payroll ready for Finance" : "Payroll ready for Finance",
        message:
          occurrences.length > 1
            ? `${occurrences.length} scheduled payroll runs were created on-chain. Finance can fund each after its send time.`
            : "HR setup is complete. Finance can fund after the scheduled send time.",
      });
      const canFund = hasInstitutionRole(institution, auth.account?.wallet_address, "finance");
      navigate(canFund ? `/finance/payrolls/${financeReadyRun.id}` : "/hr");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setSubmitStatus(null);
    }
  }

  if (!institution) {
    return (
      <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign create-payroll-page">
        <EmptyState
          title="Institution required"
          description="Register or activate an institution before creating payroll."
          action={<Link className="btn btn-primary btn-md" to="/institution/register">Register</Link>}
        />
      </div>
    );
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign create-payroll-page">
      <Link className="template-detail-back-link" to="/hr">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </Link>

      <form
        className={`create-payroll-form create-payroll-form-redesigned${
          recurringModalOpen ? " create-payroll-form-modal-open" : ""
        }`}
        data-phase={wizardPhase}
        onSubmit={submit}
      >
        <Card className="create-payroll-card create-payroll-main-card">
          <div className="create-payroll-card-body">
            <div className="create-payroll-step-content">
              <section className="create-payroll-phase create-payroll-details-card">
                <section className="create-payroll-hero">
                  <div className="create-payroll-hero-copy">
                    <span className="create-payroll-hero-eyebrow">Step 1 of 3</span>
                    <h1>
                      Create <span>Payroll</span>
                    </h1>
                  </div>
                </section>

                <div className="create-payroll-basics-grid">
                  <Field label="Payroll title">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. April core team payroll"
                    />
                  </Field>
                </div>

                <div className="create-payroll-merged-section-head">
                  <div>
                    <h3>Employees Added</h3>
                    <p>
                      {activeEmployees.length} employee{activeEmployees.length === 1 ? "" : "s"} added •{" "}
                      {perRunTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}{" "}
                      USD₮0 per run
                    </p>
                  </div>

                  <div className="create-payroll-employee-actions">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="create-payroll-csv-input"
                      onChange={handleCsvUpload}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="create-payroll-upload-csv-btn"
                      onClick={triggerCsvUpload}
                    >
                      <Upload size={15} strokeWidth={1.8} />
                      Upload CSV
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="create-payroll-add-manual-btn"
                      onClick={addEmployeeRow}
                    >
                      + Add Manually
                    </Button>
                  </div>
                </div>

                <div className="create-payroll-csv-hint">
                  CSV format: <strong>address,name,email,amount</strong>
                </div>

                <div ref={employeeStackRef} className="stack create-payroll-employee-stack">
                  {employees.map((employee, index) => (
                    <div key={index} className="employee-row create-payroll-employee-row">
                      <div className="create-payroll-employee-row-head">
                        <div className="employee-row-num">Employee {index + 1}</div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="create-payroll-remove-employee"
                          onClick={() => removeEmployeeRow(index)}
                          disabled={employees.length === 1}
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="create-payroll-employee-grid">
                        <Field label="Wallet address">
                          <input
                            value={employee.address}
                            onChange={(event) => updateEmployee(index, { address: event.target.value })}
                            placeholder="0x742d...f44e"
                          />
                        </Field>
                        <Field label="Name (optional)">
                          <input
                            value={employee.name}
                            onChange={(event) => updateEmployee(index, { name: event.target.value })}
                            placeholder="Amara Okafor"
                          />
                        </Field>
                        <Field label="Email">
                          <input
                            type="email"
                            value={employee.email}
                            onChange={(event) => updateEmployee(index, { email: event.target.value })}
                            placeholder="amara@company.com"
                          />
                        </Field>
                        <Field label="Amount per run">
                          <input
                            value={employee.amount}
                            onChange={(event) => updateEmployee(index, { amount: event.target.value })}
                            placeholder="2500.00"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="create-payroll-phase create-payroll-schedule-card">
                <section className="create-payroll-hero">
                  <div className="create-payroll-hero-copy">
                    <span className="create-payroll-hero-eyebrow">Step 2 of 3</span>
                    <h1>Schedule</h1>
                  </div>
                </section>

                <div className="create-payroll-schedule-redesign">
                  <div className="payroll-type-card">
                    <span className="schedule-card-eyebrow">Payroll type</span>

                    <div className="payroll-type-options">
                      <button
                        type="button"
                        className={`payroll-type-option${!isRecurringPayroll ? " active" : ""}`}
                        onClick={turnOffRecurringPayroll}
                      >
                        <div className="payroll-type-option-icon">
                          <CalendarDays size={15} strokeWidth={1.7} />
                        </div>
                        <span>One-time payroll</span>
                        <span className="payroll-type-radio" />
                      </button>

                      <button
                        type="button"
                        className={`payroll-type-option${isRecurringPayroll ? " active" : ""}`}
                        onClick={openRecurringModal}
                      >
                        <div className="payroll-type-option-icon">
                          <Repeat2 size={15} strokeWidth={1.7} />
                        </div>
                        <span>Recurring payroll</span>
                        <span className="payroll-type-radio" />
                      </button>
                    </div>
                  </div>

                  <div className="payroll-send-card">
                    <span className="schedule-card-eyebrow">
                      {isRecurringPayroll ? "First funding open time" : "Funding open time"}
                    </span>
                    <div className="payroll-send-grid">
                      <Field label={isRecurringPayroll ? "First funding date" : "Funding date"}>
                        <input type="date" value={sendDate} onChange={(event) => handleSendDateChange(event.target.value)} />
                      </Field>
                      <Field label="Send time">
                        <input type="time" value={sendTime} onChange={(event) => handleSendTimeChange(event.target.value)} />
                      </Field>
                    </div>
                    {scheduleErrors.firstRunAt && (
                      <p className="text-danger create-payroll-schedule-error">
                        {scheduleErrors.firstRunAt}
                      </p>
                    )}
                  </div>

                  <div className="payroll-send-card">
                    <span className="schedule-card-eyebrow">
                      {isRecurringPayroll ? "First claim deadline" : "Claim deadline"}
                    </span>
                    <div className="payroll-send-grid">
                      <Field label={isRecurringPayroll ? "First claim close date" : "Claim close date"}>
                        <input type="date" value={claimDeadlineDate} onChange={(event) => handleClaimDeadlineDateChange(event.target.value)} />
                      </Field>
                      <Field label="Close time">
                        <input type="time" value={claimDeadlineTime} onChange={(event) => handleClaimDeadlineTimeChange(event.target.value)} />
                      </Field>
                    </div>
                    {scheduleErrors.claimDeadlineAt && (
                      <p className="text-danger create-payroll-schedule-error">
                        {scheduleErrors.claimDeadlineAt}
                      </p>
                    )}
                  </div>

                  {isRecurringPayroll && (
                    <div className="recurring-payroll-summary">
                      <div className="recurring-payroll-summary-head">
                        <div>
                          <span className="recurring-payroll-badge">Recurring</span>
                          <h5>{frequencyLabel(schedule.frequency)}</h5>
                        </div>

                        <button type="button" className="recurring-payroll-edit-btn" onClick={openRecurringModal}>
                          <PenLine size={14} strokeWidth={1.8} />
                          Edit
                        </button>
                      </div>

                      <div className="recurring-payroll-summary-grid">
                        <div>
                          <span>Funding opens</span>
                          <strong>{formatDateOnly(recurringDraft.startsOn)}</strong>
                        </div>

                        <div>
                          <span>Time</span>
                          <strong>{recurringDraft.sendTime}</strong>
                        </div>

                        <div>
                          <span>Frequency</span>
                          <strong>{frequencyLabel(recurringDraft.frequency)}</strong>
                        </div>

                        <div>
                          <span>Ends</span>
                          <strong>{recurringDraft.runCount} runs</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="create-payroll-schedule-preview">
                    <div>
                      <span>Preview</span>
                      <strong>{previewText}</strong>
                    </div>
                    <div>
                      <span>Runs</span>
                      <strong>{runCount}</strong>
                    </div>
                    <div>
                      <span>Claim window</span>
                      <strong>{Math.max(1, Math.round(claimWindowMs(schedule) / (24 * 60 * 60 * 1000)))} days</strong>
                    </div>
                  </div>
                </div>
              </section>

              {recurringModalOpen && (
                <div className="recurring-modal-overlay" role="presentation" onClick={closeRecurringModal}>
                  <div
                    className="recurring-modal-panel"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="recurring-payroll-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="recurring-modal-grabber" />

                    <div className="recurring-modal-header">
                      <div>
                        <span>Recurring payroll</span>
                        <h3 id="recurring-payroll-title">Set schedule</h3>
                      </div>

                      <button
                        type="button"
                        className="recurring-modal-close"
                        onClick={closeRecurringModal}
                        aria-label="Close recurring payroll modal"
                      >
                        <X size={17} strokeWidth={2} />
                      </button>
                    </div>

                    <div className="recurring-modal-form">
                      <div className="recurring-modal-toggle-row">
                        <div>
                          <strong>Recurring payroll</strong>
                          <span>Enabled</span>
                        </div>

                        <button
                          type="button"
                          className="balary-switch active"
                          aria-pressed="true"
                          aria-label="Turn off recurring payroll"
                          onClick={turnOffRecurringPayroll}
                        >
                          <span />
                        </button>
                      </div>

                      <div className="recurring-modal-row">
                        <label>Starts</label>
                        <div className="recurring-modal-control recurring-modal-date-control">
                          <input
                            type="date"
                            value={recurringDraft.startsOn}
                            onChange={(event) =>
                              setRecurringDraft((current) => ({
                                ...current,
                                startsOn: event.target.value,
                              }))
                            }
                          />
                          <CalendarDays size={16} strokeWidth={1.7} />
                        </div>
                      </div>

                      <div className="recurring-modal-row">
                        <label>Time</label>
                        <div className="recurring-modal-control recurring-modal-date-control">
                          <input
                            type="time"
                            value={recurringDraft.sendTime}
                            onChange={(event) =>
                              setRecurringDraft((current) => ({
                                ...current,
                                sendTime: event.target.value,
                              }))
                            }
                          />
                          <Clock3 size={16} strokeWidth={1.7} />
                        </div>
                      </div>

                      <div className="recurring-modal-row">
                        <label>Frequency</label>
                        <select
                          value={recurringDraft.frequency}
                          onChange={(event) =>
                            setRecurringDraft((current) => ({
                              ...current,
                              frequency: event.target.value as RecurringFrequency,
                            }))
                          }
                        >
                          {RECURRING_FREQ_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="recurring-modal-row recurring-modal-run-count-row">
                        <label>Number of runs</label>
                        <input
                          type="number"
                          min={2}
                          max={MAX_RECURRING_RUNS}
                          value={recurringDraft.runCount}
                          onChange={(event) =>
                            setRecurringDraft((current) => ({
                              ...current,
                              runCount: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="recurring-modal-actions">
                      <Button type="button" variant="secondary" onClick={closeRecurringModal}>
                        Cancel
                      </Button>

                      <Button type="button" onClick={saveRecurringDetails}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <section className="create-payroll-phase create-payroll-review-card">
                <section className="create-payroll-hero">
                  <div className="create-payroll-hero-copy">
                    <span className="create-payroll-hero-eyebrow">Step 3 of 3</span>
                    <h1>Review</h1>
                  </div>
                </section>

                <div className="create-payroll-review-list">
                  <div className="review-row">
                    <span>Connected HR</span>
                    <strong className="create-payroll-review-wallet">
                      {auth.account?.wallet_address || "Not connected"}
                    </strong>
                  </div>
                  <div className="review-row">
                    <span>Employees</span>
                    <strong>{activeEmployees.length}</strong>
                  </div>
                  <div className="review-row">
                    <span>Per-run total</span>
                    <strong>
                      {perRunTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}{" "}
                      USD₮0
                    </strong>
                  </div>
                  <div className="review-row">
                    <span>Total runs</span>
                    <strong>{runCount}</strong>
                  </div>
                  <div className="review-row">
                    <span>Funding opens</span>
                    <strong>{formatScheduleDateTime(schedule.firstRunAt)}</strong>
                  </div>
                  <div className="review-row">
                    <span>Claims close</span>
                    <strong>{formatScheduleDateTime(schedule.claimDeadlineAt)}</strong>
                  </div>
                  <div className="review-row">
                    <span>Total payroll budget</span>
                    <strong style={{ color: "var(--z-accent)" }}>
                      {totalBudget.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}{" "}
                      USD₮0
                    </strong>
                  </div>
                  <div className="review-row">
                    <span>Email-ready employees</span>
                    <strong>{activeEmployees.filter((employee) => isValidEmail(employee.email.trim())).length} ready</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="create-payroll-action-footer">
            <div className="create-payroll-footer-progress">
              <span>{wizardPhase + 1}/3</span>
            </div>

            <div className="create-payroll-footer-buttons">
              <Button
                type="button"
                variant="secondary"
                className="create-payroll-footer-back"
                onClick={goPreviousPhase}
                disabled={wizardPhase === 0}
              >
                <ArrowLeft size={15} strokeWidth={1.8} />
                Back
              </Button>

              {wizardPhase < 2 && (
                <Button type="button" className="create-payroll-footer-next" onClick={goNextPhase}>
                  <span>{phaseCopy.nextLabel}</span>
                  <ArrowRight size={15} strokeWidth={1.8} />
                </Button>
              )}

              {wizardPhase === 2 && (
                <TransactionButton
                  disabled={busy || create.isPending || txSender.busy}
                  type="submit"
                  className="create-payroll-footer-next"
                  isProcessing={busy || create.isPending || txSender.busy}
                  idleLabel="Create On-chain"
                  processingLabel={submitStatus || "Creating on-chain..."}
                  icon={ArrowRight}
                />
              )}
            </div>
          </div>

          {error && (
            <p className="text-danger create-payroll-footer-error-message">
              {error}
            </p>
          )}

          {!error && submitStatus && (
            <p className="create-payroll-footer-status-message">
              {submitStatus}
            </p>
          )}
        </Card>
      </form>
    </div>
  );
}

function PayrollPayments({ runId }: { runId?: string }) {
  const run = usePayrollRun(runId);
  const payments = run.data?.payments || [];
  if (!payments.length) return <EmptyState title="No rows uploaded" description="Use Upload Salaries to add employee payment rows." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Wallet</th>
            <th>Net</th>
            <th>Tax</th>
            <th>Claim</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.employee_name}</td>
              <td>{shortAddress(payment.employee_address)}</td>
              <td>{formatUsdc(payment.net_amount)} USD₮0</td>
              <td>{formatUsdc(payment.tax_amount)} USD₮0</td>
              <td>{payment.claimed ? "Claimed" : payment.claim_tx_hash ? "Pending" : "Open"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HRPayrollDetailPage() {
  const { runId } = useParams();
  const run = usePayrollRun(runId);
  const upload = useUploadPayroll(runId);
  const validate = useValidatePayroll(runId);
  const buildPackage = useGeneratePayrollPackage(runId);
  const prepare = usePreparePayrollTx(runId);
  const confirm = useConfirmPayrollTx(runId);
  const txSender = useTxSender();
  const toast = useToast();
  const csvInputRef = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<unknown[]>([]);

  if (run.isLoading) return <LoadingState label="Loading payroll" />;
  if (run.error || !run.data) return <ErrorState message={errorMessage(run.error)} />;

  const currentRun = run.data;
  const displayedStatus = backendReportedPayrollStatus(currentRun);
  const hasCreateDraft = Boolean(currentRun.create_draft_tx_hash || currentRun.onchain_payroll_id);
  const hasRows = currentRun.total_payments > 0;
  const hasRoot = Boolean(currentRun.payments_root);
  const hasUploadedPackage = Boolean(
    currentRun.upload_tx_hash ||
      ["uploaded_onchain", "pending_activation", "funding_ready", "pending_funding", "active", "finalized"].includes(displayedStatus),
  );
  const hasFundingReady = ["funding_ready", "pending_funding", "active", "finalized"].includes(displayedStatus);

  async function sendStep(step: "create" | "upload" | "activate") {
    setError(null);
    try {
      const prepared = await prepare.mutateAsync(step);
      const payload = Array.isArray(prepared) ? prepared[0] : prepared;
      const hash = await txSender.sendPrepared(payload, titleCase(step));
      await confirm.mutateAsync({ step, tx_hash: hash });
      await run.refetch();
      toast.complete({
        title: `${payrollStepLabel(step)} submitted`,
        message: "Balary is tracking the transaction and will update the payroll status after confirmation.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function uploadCsvContent(content: string, filename: string) {
    setError(null);
    try {
      await upload.mutateAsync({ content, filename });
      const latest = await validate.mutateAsync();
      setValidationErrors(latest.errors || []);
      await run.refetch();
      toast.complete({
        title: "Payroll rows uploaded",
        message: "The employee rows were saved and validated for this payroll run.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function triggerCsvUpload() {
    csvInputRef.current?.click();
  }

  function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => void uploadCsvContent(String(reader.result ?? ""), file.name);
    reader.onerror = () => setError("Could not read the CSV file.");
    reader.readAsText(file);
  }

  async function buildRootPackage() {
    setError(null);
    try {
      await buildPackage.mutateAsync();
      await run.refetch();
      toast.complete({
        title: "Merkle package built",
        message: "The payroll package is ready for the next on-chain step.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const stageItems = [
    {
      title: "Upload rows",
      detail: "Validate and encrypt the private employee payroll CSV.",
      complete: hasRows,
      ready: true,
    },
    {
      title: "Encrypt salaries",
      detail: "Bind the private payload to the registered Flare TEE.",
      complete: hasRoot,
      ready: hasRows,
    },
    {
      title: "Create draft",
      detail: "Prepare and submit the on-chain payroll draft.",
      complete: hasCreateDraft,
      ready: hasRoot,
    },
    {
      title: "Verify payroll",
      detail: "Verify the private payroll result before funding.",
      complete: hasUploadedPackage,
      ready: hasCreateDraft,
    },
    {
      title: "Open funding",
      detail: "Mark the computed payroll ready for Finance funding.",
      complete: hasFundingReady,
      ready: hasUploadedPackage,
    },
  ];
  const completeStageCount = stageItems.filter((stage) => stage.complete).length;
  const progressPercent = Math.max(8, Math.round((completeStageCount / stageItems.length) * 100));
  const anyBusy =
    upload.isPending ||
    validate.isPending ||
    buildPackage.isPending ||
    prepare.isPending ||
    confirm.isPending ||
    txSender.busy;
  const transactionBusy = prepare.isPending || confirm.isPending || txSender.busy;
  const nextAction = (() => {
    if (!hasRows || !hasRoot) {
      return {
        title: "Upload private salaries",
        description: "Validate and encrypt the employee payroll CSV for the registered TEE.",
        button: "Upload Salaries",
        icon: <FileUp size={15} strokeWidth={2} />,
        disabled: anyBusy,
        onClick: triggerCsvUpload,
      };
    }
    if (!hasCreateDraft) {
      return {
        title: "Create payroll draft",
        description: "Submit the encrypted payroll commitment to Flare Coston2.",
        button: "Create Payroll",
        icon: <Send size={15} strokeWidth={2} />,
        disabled: anyBusy,
        onClick: () => void sendStep("create"),
      };
    }
    if (!hasUploadedPackage) {
      return {
        title: "Verify private payroll",
        description: "Complete private payroll verification on Flare before funding.",
        button: "Verify Payroll",
        icon: <ShieldCheck size={15} strokeWidth={2} />,
        disabled: anyBusy,
        onClick: () => void sendStep("upload"),
      };
    }
    if (!hasFundingReady) {
      return {
        title: "Open payroll funding",
        description: "Open the verified confidential payroll for exact Finance funding.",
        button: "Open Funding",
        icon: <Landmark size={15} strokeWidth={2} />,
        disabled: anyBusy,
        onClick: () => void sendStep("activate"),
      };
    }
    return {
      title: "Ready for Finance",
      description: "Finance can now fund this payroll run.",
      button: "",
      icon: <Check size={15} strokeWidth={2} />,
      disabled: true,
      onClick: () => undefined,
    };
  })();

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign run-detail-page">
      <Link className="template-detail-back-link run-detail-back-link" to="/hr">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </Link>

      <section className="employer-task-hero run-detail-hero">
        <div className="employer-task-hero-copy run-detail-hero-copy">
          <span className="employer-task-kicker run-detail-hero-kicker">Payroll run</span>
          <h1>{currentRun.title}</h1>
          <p className="employer-task-hero-subtitle">
            Track confirmations, funding, and activation for this payroll run.
          </p>
        </div>
        <div className="employer-task-hero-metrics run-detail-hero-metrics" aria-label="Run summary">
          <div className="employer-task-hero-metric">
            <span>Status</span>
            <strong>{titleCase(displayedStatus)}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Deadline</span>
            <strong>{payrollDate(currentRun.claim_deadline)}</strong>
          </div>
        </div>
      </section>

      <section className="employer-task-card template-detail-command-panel run-detail-command-panel">
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="create-payroll-csv-input"
          onChange={handleCsvUpload}
        />

        <div className="template-detail-summary-grid run-detail-summary-grid">
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ReceiptText size={15} /></span>
            <div>
              <span>On-chain id</span>
              <strong>{currentRun.onchain_payroll_id || "Waiting"}</strong>
            </div>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><FileUp size={15} /></span>
            <div>
              <span>Rows</span>
              <strong>{currentRun.total_payments}</strong>
            </div>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><CheckCircle2 size={15} /></span>
            <div>
              <span>Processed</span>
              <strong>{currentRun.processed_count}</strong>
            </div>
          </div>
          <div className="template-detail-summary-item template-detail-summary-item-accent">
            <span className="template-detail-summary-icon"><ShieldCheck size={15} /></span>
            <div>
              <span>Root</span>
              <strong>{currentRun.payments_root ? shortAddress(currentRun.payments_root) : "Not built"}</strong>
            </div>
          </div>
        </div>

        <div className="template-detail-action-strip run-detail-action-strip">
          <div>
            <strong>{nextAction.title}</strong>
            <span>{nextAction.description}</span>
          </div>
          {nextAction.button && (
            <TransactionButton
              type="button"
              className="run-detail-primary-action"
              onClick={nextAction.onClick}
              isProcessing={transactionBusy}
              idleLabel={nextAction.button}
              processingLabel={
                txSender.busy
                  ? "Confirming transaction..."
                  : prepare.isPending
                    ? "Preparing transaction..."
                    : "Finalizing..."
              }
              disabled={nextAction.disabled}
            />
          )}
        </div>

        <FormError message={error || txSender.lastError} />
        {validationErrors.length > 0 && (
          <div className="validation-errors run-detail-panel-error" role="alert">
            <strong>CSV validation errors</strong>
            <ul>
              {validationErrors.map((item, index) => (
                <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="run-detail-progress-section">
          <div className="template-detail-runs-head run-detail-progress-head">
            <h2>
              <ListChecks size={16} strokeWidth={1.8} />
              Progress
            </h2>
            <span>Step {Math.min(completeStageCount + 1, stageItems.length)} of {stageItems.length}</span>
          </div>
          <div className={`run-detail-progress-meter${completeStageCount < stageItems.length ? " run-detail-progress-meter-active" : ""}`}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="run-detail-stage-table">
            <div className="run-detail-stage-table-head">
              <span>Step</span>
              <span>Task</span>
              <span>Details</span>
              <span>Status</span>
            </div>
            <div className="run-detail-stage-grid">
              {stageItems.map((stage, index) => (
                <div
                  key={stage.title}
                  className={`run-detail-stage-card${stage.complete ? " run-detail-stage-card-complete" : stage.ready ? " run-detail-stage-card-current" : " run-detail-stage-card-locked"}`}
                >
                  <div className="run-detail-stage-index">
                    <span className="run-detail-stage-icon">
                      {stage.complete ? <Check size={14} /> : index + 1}
                    </span>
                    <span className="run-detail-stage-step">Step {index + 1}</span>
                  </div>
                  <div className="run-detail-stage-body">
                    <strong>{stage.title}</strong>
                  </div>
                  <small className="run-detail-stage-detail">{stage.detail}</small>
                  <span className={`run-detail-stage-pill run-detail-stage-pill-${stage.complete ? "complete" : stage.ready ? "ready" : "waiting"}`}>
                    {stage.complete ? "Complete" : stage.ready ? "Ready" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {currentRun.payments && currentRun.payments.length > 0 && (
        <section className="template-detail-runs-section">
          <div className="template-detail-runs-head">
            <div>
              <h2>Payments</h2>
              <span>{currentRun.payments.length} uploaded row{currentRun.payments.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <PayrollPayments runId={runId} />
        </section>
      )}
    </div>
  );
}

export function FinanceDashboardPage() {
  const payrolls = usePayrollRuns();
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;
  const financeRuns = React.useMemo(
    () => sortPayrollRunsForList(
      (payrolls.data || []).filter((run) =>
        ["funding_ready", "pending_funding", "active", "finalized"].includes(run.status),
      ),
    ),
    [payrolls.data],
  );
  const totalPages = Math.max(1, Math.ceil(financeRuns.length / pageSize));
  const visibleFinanceRuns = financeRuns.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalReady = financeRuns.reduce((sum, run) => sum + BigInt(run.total_gross_amount || "0"), 0n);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign finance-dashboard-page">
      <div className="employer-task-dashboard">
        <section className="employer-task-hero">
          <div className="employer-task-hero-copy">
            <span className="employer-task-kicker">Finance</span>
            <h1>
              Funding <span>queue</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Approve USD₮0 and fund payroll runs after HR marks them ready.
            </p>
          </div>
          <div className="employer-task-hero-metrics" aria-label="Funding summary">
            <div className="employer-task-hero-metric">
              <span>Ready runs</span>
              <strong>{financeRuns.length}</strong>
            </div>
            <div className="employer-task-hero-metric">
              <span>Total required</span>
              <strong>{formatUsdc(totalReady, financeRuns[0]?.token_decimals || 6)} USD₮0</strong>
            </div>
          </div>
        </section>
        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board">
            <div className="employer-task-card-head">
              <div>
                <span>Funding operations</span>
                <h2>Ready Payroll</h2>
              </div>
              <span className="employer-task-count">{financeRuns.length} item{financeRuns.length === 1 ? "" : "s"}</span>
            </div>
            {payrolls.isLoading ? (
              <div className="employer-task-loading">Loading funding queue...</div>
            ) : (
              <>
                <PayrollTable runs={visibleFinanceRuns} emptyLabel="No runs ready for Finance." detailBasePath="/finance/payrolls" />
                {financeRuns.length > pageSize && (
                  <div className="employee-claims-pagination employer-payroll-pagination employer-task-pagination" aria-label="Funding queue pagination">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, financeRuns.length)} of {financeRuns.length}
                    </span>
                    <div className="employee-claims-pagination-controls employer-payroll-pagination-controls">
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous funding page">
                        <ChevronLeft size={15} strokeWidth={2} />
                      </button>
                      <span className="employee-claims-page-count employer-payroll-page-count">
                        {currentPage} / {totalPages}
                      </span>
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next funding page">
                        <ChevronRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function FinancePayrollDetailPage() {
  const { runId } = useParams();
  const run = usePayrollRun(runId);
  const prepare = usePreparePayrollTx(runId);
  const confirm = useConfirmPayrollTx(runId);
  const txSender = useTxSender();
  const toast = useToast();
  const [error, setError] = React.useState<string | null>(null);

  if (run.isLoading) return <LoadingState label="Loading payroll" />;
  if (run.error || !run.data) return <ErrorState message={errorMessage(run.error)} />;
  const fundingOpensAt = new Date(run.data.funding_starts_at);
  const fundingIsOpen = Number.isNaN(fundingOpensAt.getTime()) || fundingOpensAt.getTime() <= Date.now();
  const fundingProofConfirmed = ["active", "finalized"].includes(run.data.status);
  const fundingProofStatus = fundingProofConfirmed
    ? "Confirmed"
    : run.data.fund_tx_hash
      ? "Submitted"
      : "Not recorded";
  const fundingProofTone: "complete" | "pending" | "active" | "idle" = fundingProofConfirmed
    ? "complete"
    : run.data.fund_tx_hash
      ? "pending"
      : "idle";

  async function fund() {
    setError(null);
    try {
      const approval = await prepare.mutateAsync("approval");
      const approvalHash = await txSender.sendPrepared(approval, "Approve USD₮0");
      await confirm.mutateAsync({ step: "approval", tx_hash: approvalHash });

      let approvalConfirmed = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 4_000));
        const refreshed = await run.refetch();
        if (refreshed.data?.status === "failed") {
          throw new Error("The USD₮0 approval transaction failed on-chain.");
        }
        if (refreshed.data?.status === "funding_ready") {
          approvalConfirmed = true;
          break;
        }
      }
      if (!approvalConfirmed) {
        throw new Error("USD₮0 approval is still pending. The backend will keep syncing it.");
      }

      const funding = await prepare.mutateAsync("fund");
      const hash = await txSender.sendPrepared(funding, "Fund payroll");
      await confirm.mutateAsync({ step: "fund", tx_hash: hash });
      toast.complete({
        title: "Payroll funding submitted",
        message: "Balary is tracking the exact funding transaction and will open private withdrawals after confirmation.",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="stack dashboard-shell dashboard-shell-employer employer-dashboard-premium employer-dashboard-redesign run-detail-page">
      <Link className="template-detail-back-link run-detail-back-link" to="/finance">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </Link>

      <section className="employer-task-hero run-detail-hero">
        <div className="employer-task-hero-copy run-detail-hero-copy">
          <span className="employer-task-kicker run-detail-hero-kicker">Finance payroll</span>
          <h1>{run.data.title}</h1>
          <p className="employer-task-hero-subtitle">{run.data.period_label} funding</p>
        </div>
        <div className="employer-task-hero-metrics run-detail-hero-metrics" aria-label="Funding summary">
          <div className="employer-task-hero-metric">
            <span>Status</span>
            <strong>{titleCase(payrollDisplayStatus(run.data))}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Total required</span>
            <strong>{payrollAmount(run.data)}</strong>
          </div>
        </div>
      </section>

      <section className="run-detail-command-panel">
        <div className="run-detail-summary-grid">
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ListChecks size={15} /></span>
            <span>Payroll id</span>
            <strong>{run.data.onchain_payroll_id || "Missing"}</strong>
          </div>
          <div className="template-detail-summary-item template-detail-summary-item-accent">
            <span className="template-detail-summary-icon"><CircleDollarSign size={15} /></span>
            <span>Total required</span>
            <strong>{payrollAmount(run.data)}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Clock3 size={15} /></span>
            <span>Funding opens</span>
            <strong>{formatDate(run.data.funding_starts_at)}</strong>
          </div>
        </div>

        <div className="run-detail-action-strip">
          <div>
            <strong>Fund escrow</strong>
            <span>
              {fundingIsOpen
                ? "Your wallet first approves USD₮0 for the manager, then submits the funding transaction."
                : `Funding opens ${formatDate(run.data.funding_starts_at)}.`}
            </span>
          </div>
          <TransactionButton
            type="button"
            className="run-detail-primary-action"
            onClick={fund}
            isProcessing={txSender.busy || prepare.isPending || confirm.isPending}
            idleLabel={fundingIsOpen ? "Fund payroll" : "Waiting"}
            processingLabel={
              txSender.busy
                ? "Confirm in wallet..."
                : confirm.isPending
                  ? "Confirming transaction..."
                  : "Preparing funding..."
            }
            icon={Landmark}
            disabled={txSender.busy || prepare.isPending || confirm.isPending || run.data.status !== "funding_ready" || !fundingIsOpen}
          />
        </div>

        <TransactionProofActivity
          title="Funding"
          status={fundingProofStatus}
          txHash={run.data.fund_tx_hash}
          tone={fundingProofTone}
        />
        <FormError message={error || txSender.lastError} />
      </section>
    </div>
  );
}

export function ClaimsPage() {
  const claims = useAvailableClaims();
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 5;
  const claimList = claims.data || [];
  const openClaims = claimList.filter((claim) => employeeClaimStatus(claim) === "open");
  const claimedClaims = claimList.filter((claim) => employeeClaimStatus(claim) === "claimed");
  const totalPages = Math.max(1, Math.ceil(claimList.length / pageSize));
  const visibleClaims = claimList.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalClaimable = openClaims.reduce((sum, claim) => sum + BigInt(claim.gross || "0"), 0n);

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
              Claim <span>queue</span>
            </h1>
            <p className="employer-task-hero-subtitle">
              Claim active payroll payouts with the connected employee wallet.
            </p>
          </div>
          <div className="employer-task-hero-metrics" aria-label="Claims summary">
            <div className="employer-task-hero-metric">
              <span>Open claims</span>
              <strong>{openClaims.length}</strong>
            </div>
            <div className="employer-task-hero-metric">
              <span>Claimed</span>
              <strong>{claimedClaims.length}</strong>
            </div>
          </div>
        </section>

        <main className="employer-task-main">
          <section className="employer-task-card employer-payroll-board">
            <div className="employer-task-card-head">
              <div>
                <span>Claim operations</span>
                <h2>Available Claims</h2>
              </div>
              <span className="employer-task-count">{claimList.length} item{claimList.length === 1 ? "" : "s"}</span>
            </div>
            <div className="employee-claim-board-summary">
              <span>Open total</span>
              <strong>{formatUsdc(totalClaimable)} USD₮0</strong>
            </div>
            {claims.isLoading ? (
              <div className="employer-task-loading">Loading claims...</div>
            ) : claimList.length ? (
              <>
                <div className="employer-task-payroll-list">
                  {visibleClaims.map((claim) => {
                    const status = employeeClaimStatus(claim);
                    return (
                      <Link
                        key={claim.payment_id}
                        className="employer-task-payroll-row"
                        to={`/employee/claims/${claim.payment_id}`}
                        aria-label={`Open ${claim.institution.name} claim`}
                      >
                        <span className="employer-task-row-copy">
                          <strong>{claim.institution.name}</strong>
                          <span>{claim.period_label} - {formatUsdc(claim.gross)} USD₮0</span>
                        </span>
                        <StatusBadge value={status === "open" ? "claim" : status} />
                        <span className="employer-task-view-link">{status === "open" ? "Claim" : "Review"}</span>
                        <ArrowRight size={16} strokeWidth={2} />
                      </Link>
                    );
                  })}
                </div>
                {claimList.length > pageSize && (
                  <div className="employee-claims-pagination employer-payroll-pagination employer-task-pagination" aria-label="Claims pagination">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, claimList.length)} of {claimList.length}
                    </span>
                    <div className="employee-claims-pagination-controls employer-payroll-pagination-controls">
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous claims page">
                        <ChevronLeft size={15} strokeWidth={2} />
                      </button>
                      <span className="employee-claims-page-count employer-payroll-page-count">
                        {currentPage} / {totalPages}
                      </span>
                      <button type="button" className="employee-claims-page-btn employer-payroll-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next claims page">
                        <ChevronRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No claims yet" description="Active and claimed employee payouts for this wallet will appear here." />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export function ClaimDetailPage() {
  const { paymentId } = useParams();
  const claims = useAvailableClaims();
  const claim = claims.data?.find((item) => item.payment_id === paymentId);
  const currentClaimStatus = employeeClaimStatus(claim);
  const isClaimable = Boolean(claim) && currentClaimStatus === "open";
  const payload = useClaimPayload(paymentId, isClaimable);
  const confirm = useConfirmClaim(paymentId);
  const txSender = useTxSender();
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const claimProofStatus = currentClaimStatus === "claimed"
    ? "Confirmed"
    : claim?.claim_tx_hash
      ? "Submitted"
      : "Not recorded";
  const claimProofTone: "complete" | "pending" | "active" | "idle" = currentClaimStatus === "claimed"
    ? "complete"
    : claim?.claim_tx_hash
      ? "pending"
      : "idle";

  async function claimPayment() {
    setError(null);
    try {
      const payloadResult = payload.data ? { data: payload.data, error: null } : await payload.refetch();
      if (payloadResult.error) throw payloadResult.error;
      const prepared = payloadResult.data;
      if (!prepared) throw new Error("Claim payload is not ready yet. Refresh and try again.");
      const hash = await txSender.sendPrepared(prepared as PreparedTx, "Claim payment");
      await confirm.mutateAsync(hash);
      toast.complete({
        title: "Claim submitted",
        message: "Balary is tracking your claim transaction and will update the claim list after confirmation.",
      });
      navigate("/employee/claims");
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
          <span className="employer-task-kicker run-detail-hero-kicker">Employee claim</span>
          <h1>{claim?.institution.name || `Payment ${paymentId}`}</h1>
          <p className="employer-task-hero-subtitle">{claim?.period_label || "Backend-prepared claim payload"}</p>
        </div>
        <div className="employer-task-hero-metrics run-detail-hero-metrics" aria-label="Claim summary">
          <div className="employer-task-hero-metric">
            <span>Status</span>
            <strong>{titleCase(currentClaimStatus)}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Deadline</span>
            <strong>{claim ? payrollDate(claim.claim_deadline) : "-"}</strong>
          </div>
        </div>
      </section>

      <section className="run-detail-command-panel">
        <div className="run-detail-summary-grid">
          <div className="template-detail-summary-item template-detail-summary-item-accent">
            <span className="template-detail-summary-icon"><CircleDollarSign size={15} /></span>
            <span>Gross</span>
            <strong>{claim ? `${formatUsdc(claim.gross)} USD₮0` : "-"}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ReceiptText size={15} /></span>
            <span>Net</span>
            <strong>{claim ? `${formatUsdc(claim.net)} USD₮0` : "-"}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><ListChecks size={15} /></span>
            <span>Tax</span>
            <strong>{claim ? `${formatUsdc(claim.tax)} USD₮0` : "-"}</strong>
          </div>
          <div className="template-detail-summary-item">
            <span className="template-detail-summary-icon"><Clock3 size={15} /></span>
            <span>Deadline</span>
            <strong>{claim ? formatDate(claim.claim_deadline) : "-"}</strong>
          </div>
        </div>

        <div className="run-detail-action-strip">
          <div>
            <strong>Claim with wallet</strong>
            <span>
              {currentClaimStatus === "claimed"
                ? `Claimed${claim?.claimed_at ? ` on ${formatDate(claim.claimed_at)}` : ""}.`
                : currentClaimStatus === "pending"
                  ? "Claim transaction is already pending confirmation."
                  : claim
                    ? `${claim.period_label} payment from ${claim.institution.name}.`
                    : "Loading claim details."}
            </span>
          </div>
          <TransactionButton
            type="button"
            className="run-detail-primary-action"
            onClick={claimPayment}
            isProcessing={payload.isFetching || txSender.busy || confirm.isPending}
            idleLabel={currentClaimStatus === "claimed" ? "Claimed" : currentClaimStatus === "pending" ? "Pending" : "Claim payment"}
            processingLabel={
              txSender.busy
                ? "Confirm in wallet..."
                : confirm.isPending
                  ? "Confirming transaction..."
                  : "Preparing claim..."
            }
            icon={CircleDollarSign}
            disabled={!isClaimable || !paymentId || payload.isLoading || payload.isFetching || txSender.busy || confirm.isPending}
          />
        </div>
        <TransactionProofActivity
          title="Claim"
          status={claimProofStatus}
          txHash={claim?.claim_tx_hash}
          tone={claimProofTone}
        />
        <FormError message={error || txSender.lastError || (isClaimable && payload.error ? errorMessage(payload.error) : null)} />
      </section>
    </div>
  );
}

export function AccountPage() {
  const auth = useAuth();
  const wallet = useWallet();
  const institutions = useInstitutions();
  const navigate = useNavigate();
  const toast = useToast();
  const walletAddress = auth.account?.wallet_address || wallet.address;
  const institutionList = institutions.data || [];
  const walletMemberships = institutionList.flatMap((institution) =>
    institution.members
      .filter(
        (member) =>
          walletAddress &&
          member.wallet_address.toLowerCase() === walletAddress.toLowerCase() &&
          member.status === "active",
      )
      .map((member) => ({ institution, member })),
  );
  const primaryInstitution = walletMemberships[0]?.institution || institutionList[0] || null;
  const activeRoles = Array.from(new Set(walletMemberships.map(({ member }) => member.role)));
  const roleSummary = activeRoles.length ? activeRoles.map(titleCase).join(", ") : "Employee claims";
  const accountEmail = auth.account?.email?.trim();
  const displayName = auth.account?.display_name?.trim();
  const institutionStatus = primaryInstitution
    ? titleCase(primaryInstitution.registration_status)
    : "Not registered";

  async function handleCopyWallet() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.push({
        kind: "success",
        title: "Wallet copied",
        message: "The wallet address has been copied.",
      });
    } catch {
      toast.push({
        kind: "error",
        title: "Could not copy wallet",
        message: "Copy the wallet address manually.",
      });
    }
  }

  function handleLogout() {
    auth.logout();
    wallet.disconnect();
    navigate("/login", { replace: true });
  }

  return (
    <div className="account-premium-page dashboard-shell employer-dashboard-redesign account-dashboard-redesign">
      <button
        type="button"
        className="template-detail-back-link account-premium-back"
        onClick={() => navigate("/app")}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </button>

      <section className="employer-task-hero account-dashboard-hero">
        <div className="employer-task-hero-copy account-dashboard-hero-copy">
          <span className="employer-task-kicker">Account</span>
          <h1>Wallet profile</h1>
          <p className="employer-task-hero-subtitle">
            Review the connected wallet and workspace access used by Balary.
          </p>
        </div>

        <div className="employer-task-hero-metrics account-dashboard-hero-metrics" aria-label="Account summary">
          <div className="employer-task-hero-metric">
            <span>Wallet</span>
            <strong>{shortAddress(walletAddress)}</strong>
          </div>
          <div className="employer-task-hero-metric">
            <span>Institution</span>
            <strong>{primaryInstitution?.name || "Not set"}</strong>
          </div>
        </div>
      </section>

      <section className="employer-task-card account-dashboard-card account-profile-panel account-profile-panel-compact">
        <article className="account-profile-card account-profile-details-card">
          <table className="account-profile-details-table">
            <tbody>
              <tr>
                <th scope="row">
                  <span className="account-profile-icon account-profile-icon-accent">
                    <Wallet size={17} strokeWidth={1.8} />
                  </span>
                  <span>Wallet</span>
                </th>
                <td>
                  <span className="account-profile-wallet-full">{walletAddress || "Not connected"}</span>
                </td>
                <td className="account-profile-details-action">
                  <button
                    type="button"
                    className="account-profile-copy-btn"
                    aria-label="Copy wallet address"
                    onClick={() => void handleCopyWallet()}
                    disabled={!walletAddress}
                  >
                    <Copy size={15} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>

              {accountEmail && (
                <tr>
                  <th scope="row">
                    <span className="account-profile-icon">
                      <Mail size={17} strokeWidth={1.8} />
                    </span>
                    <span>Email</span>
                  </th>
                  <td colSpan={2}>
                    <strong>{accountEmail}</strong>
                  </td>
                </tr>
              )}

              {displayName && (
                <tr>
                  <th scope="row">
                    <span className="account-profile-icon">
                      <UsersRound size={17} strokeWidth={1.8} />
                    </span>
                    <span>Name</span>
                  </th>
                  <td colSpan={2}>
                    <strong>{displayName}</strong>
                  </td>
                </tr>
              )}

              <tr>
                <th scope="row">
                  <span className="account-profile-icon">
                    <ShieldCheck size={17} strokeWidth={1.8} />
                  </span>
                  <span>Access</span>
                </th>
                <td colSpan={2}>
                  <strong>{roleSummary}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="account-profile-card account-profile-workspace-card">
          <div className="account-profile-card-eyebrow">
            <Building2 size={15} strokeWidth={1.8} />
            <span>Workspace access</span>
          </div>

          <div className="account-profile-workspace-row">
            <span className="account-profile-workspace-icon account-profile-workspace-icon-employer">
              <Building2 size={18} strokeWidth={1.8} />
            </span>
            <div className="account-profile-workspace-info">
              <strong>{primaryInstitution?.name || "Institution"}</strong>
              <span>{primaryInstitution ? `${institutionStatus} / ${shortAddress(primaryInstitution.institution_address)}` : "Register institution"}</span>
            </div>
            <div className="account-profile-workspace-actions">
              <button
                type="button"
                className="account-profile-open-btn"
                aria-label="Open institution workspace"
                onClick={() => navigate(primaryInstitution ? "/institution" : "/institution/register")}
              >
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="account-profile-workspace-row">
            <span className="account-profile-workspace-icon">
              <CircleDollarSign size={18} strokeWidth={1.8} />
            </span>
            <div className="account-profile-workspace-info">
              <strong>Employee claims</strong>
              <span>Available to any connected employee wallet</span>
            </div>
            <div className="account-profile-workspace-actions">
              <button
                type="button"
                className="account-profile-open-btn"
                aria-label="Open employee claims"
                onClick={() => navigate("/employee/claims")}
              >
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </article>

        <div className="account-profile-footer">
          <button
            type="button"
            className="account-premium-action-btn account-premium-action-btn-danger"
            onClick={handleLogout}
          >
            <LogOut size={13} strokeWidth={2} />
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
