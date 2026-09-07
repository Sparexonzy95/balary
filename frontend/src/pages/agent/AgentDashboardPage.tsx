import { Link } from "react-router-dom";
import { Bot, CalendarClock, FileCheck2, ListChecks, ShieldCheck } from "lucide-react";
import { useActiveInstitution } from "../../hooks/useInstitutions";
import {
  useAuditEvents,
  useFccConfiguration,
  useFccInstructions,
  useSchedules,
} from "../../hooks/useOperations";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { errorMessage } from "../../lib/api";
import { formatDate, shortAddress, titleCase } from "../../lib/utils";

export function AgentDashboardPage() {
  const { institution, isLoading } = useActiveInstitution();
  const configuration = useFccConfiguration();
  const instructions = useFccInstructions();
  const schedules = useSchedules();
  const audit = useAuditEvents(institution?.id);

  if (isLoading) return <LoadingState label="Loading institution" />;
  if (!institution) {
    return <EmptyState title="No institution workspace" description="Register or join an institution before using confidential compute." />;
  }

  const instructionRows = instructions.data || [];
  const pending = instructionRows.filter((item) => !["closed", "finalized", "failed"].includes(item.status)).length;
  const verified = instructionRows.filter((item) => item.signature_verified).length;
  const scheduleRows = schedules.data || [];
  const recentAudit = (audit.data || []).slice(0, 5);

  return (
    <div className="dashboard-shell agent-page">
      <PageHeader
        eyebrow="Flare Confidential Compute"
        title="Private payroll operations"
        accentTitle={institution.name}
        description="Track encrypted payroll instructions, signed TEE results, recurring schedules, and the append-only audit trail."
        actions={<Link className="btn btn-secondary" to="/agent/audit">Audit log</Link>}
      />

      <div className="stats-row agent-status-row">
        <StatCard value={<StatusBadge value={configuration.data?.relayer_configured ? "active" : "config_blocked"} />} label="Relayer" />
        <StatCard value={instructionRows.length} label="Instructions" />
        <StatCard value={pending} label="In progress" />
        <StatCard value={verified} label="Verified results" />
        <StatCard value={scheduleRows.filter((item) => item.active).length} label="Active schedules" />
      </div>

      {(instructions.error || schedules.error) && (
        <ErrorState message={errorMessage(instructions.error || schedules.error)} />
      )}

      <div className="agent-grid">
        <Card
          title="Confidential Compute"
          subtitle="TEE-bound payroll requests and signed result verification."
          actions={<ShieldCheck size={18} />}
        >
          {instructionRows.length ? (
            <div className="agent-step-list">
              {instructionRows.slice(0, 6).map((item) => (
                <Link key={item.id} className="agent-step" to={`/agent/jobs/${item.id}`}>
                  <Bot size={17} />
                  <span>Payroll {item.payroll_id}</span>
                  <StatusBadge value={item.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No FCC instructions" description="A confidential computation request will appear after HR submits an encrypted payroll." />
          )}
        </Card>

        <Card
          title="Recurring Payroll"
          subtitle="Fresh payroll shells created on the configured cadence."
          actions={<Link className="btn btn-secondary btn-small" to="/agent/templates/new">New schedule</Link>}
        >
          {scheduleRows.length ? (
            <div className="agent-step-list">
              {scheduleRows.slice(0, 6).map((item) => (
                <Link key={item.id} className="agent-step" to={`/agent/templates/${item.id}`}>
                  <CalendarClock size={17} />
                  <span>{item.name}</span>
                  <StatusBadge value={item.active ? "active" : "paused"} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No payroll schedules" description="Create a weekly, biweekly, monthly, or quarterly schedule." />
          )}
        </Card>

        <Card title="TEE Configuration" subtitle="Public runtime configuration only. Secrets are never returned.">
          <div className="key-grid">
            <span>TEE identity</span><strong>{configuration.data?.tee_id ? shortAddress(configuration.data.tee_id) : "-"}</strong>
            <span>Signer epoch</span><strong>{configuration.data?.tee_signer_epoch ?? "-"}</strong>
            <span>Encryptor</span><strong><StatusBadge value={configuration.data?.encryptor_configured ? "active" : "not_configured"} /></strong>
            <span>Relayer</span><strong><StatusBadge value={configuration.data?.relayer_configured ? "active" : "not_configured"} /></strong>
            <span>Request fee</span><strong>{configuration.data?.request_fee_wei || "0"} wei</strong>
          </div>
        </Card>

        <Card title="Recent Audit" subtitle="Append-only operational evidence.">
          {recentAudit.length ? (
            <div className="agent-step-list">
              {recentAudit.map((event) => (
                <div key={event.id} className="agent-step">
                  <FileCheck2 size={17} />
                  <span>{titleCase(event.action)}</span>
                  <small>{formatDate(event.created_at)}</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No audit events" description="Verified product actions will appear here." />
          )}
        </Card>
      </div>

      <Card title="Privacy boundary" subtitle="What this dashboard proves without exposing private salary data.">
        <div className="agent-callout">
          <ListChecks size={18} />
          <div>
            <strong>Encrypted input, signed output</strong>
            <p className="muted">The API exposes commitments, roots, statuses, and transaction proofs. It never exposes plaintext payroll rows or the private ledger.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
