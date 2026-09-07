import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useActiveInstitution } from "../../hooks/useInstitutions";
import { useAuditEvents } from "../../hooks/useOperations";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { errorMessage } from "../../lib/api";
import { formatDate, shortAddress, titleCase } from "../../lib/utils";

export function AgentAuditPage() {
  const { institution } = useActiveInstitution();
  const audit = useAuditEvents(institution?.id);
  return (
    <div className="dashboard-shell agent-page">
      <Link className="template-detail-back-link" to="/agent"><ArrowLeft size={14} /><span>Back</span></Link>
      <PageHeader eyebrow="Audit" title="Confidential payroll" accentTitle="activity" description="Append-only evidence for institution, employee, payroll, funding, withdrawal, and notification actions." />
      <Card title="Audit events" subtitle={institution?.name || "Accessible institutions"}>
        {audit.isLoading ? <LoadingState /> : audit.error ? <ErrorState message={errorMessage(audit.error)} /> : audit.data?.length ? (
          <div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Source</th><th>Created</th></tr></thead><tbody>
            {audit.data.map((event) => <tr key={event.id}><td>{titleCase(event.action)}</td><td>{shortAddress(event.actor_wallet_display || event.actor_wallet)}</td><td>{titleCase(event.target_type)} {event.target_id}</td><td>{titleCase(event.source)}</td><td>{formatDate(event.created_at)}</td></tr>)}
          </tbody></table></div>
        ) : <EmptyState title="No audit events" description="Verified actions will appear here." />}
      </Card>
    </div>
  );
}
