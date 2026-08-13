import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { useFccInstruction, useProcessFccInstruction } from "../../hooks/useOperations";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusBadge, useToast } from "../../components/ui";
import { errorMessage } from "../../lib/api";
import { formatDate, shortAddress } from "../../lib/utils";

export function AgentJobDetailPage() {
  const { jobId } = useParams();
  const instruction = useFccInstruction(jobId);
  const process = useProcessFccInstruction(jobId);
  const toast = useToast();
  if (instruction.isLoading) return <LoadingState label="Loading FCC instruction" />;
  if (instruction.error || !instruction.data) return <ErrorState message={errorMessage(instruction.error)} />;
  const item = instruction.data;
  async function runProcess() {
    try {
      await process.mutateAsync();
      toast.push({ kind: "success", title: "FCC instruction processed", message: "Balary completed one safe polling and finalization iteration." });
    } catch (error) {
      toast.push({ kind: "error", title: "FCC processing failed", message: errorMessage(error) });
    }
  }
  return <div className="dashboard-shell agent-page">
    <Link className="template-detail-back-link" to="/agent"><ArrowLeft size={14} /><span>Back</span></Link>
    <PageHeader eyebrow="FCC instruction" title={`Payroll ${item.payroll_id}`} accentTitle={shortAddress(item.instruction_id)} description="Signed TEE result verification and confidential finalization status." actions={<Button onClick={runProcess} disabled={process.isPending}><RefreshCw size={15} />{process.isPending ? "Processing..." : "Process now"}</Button>} />
    <div className="stats-row"><div className="stat-card"><div className="stat-value"><StatusBadge value={item.status} /></div><div className="stat-label">Status</div></div><div className="stat-card"><div className="stat-value">{item.poll_attempts}</div><div className="stat-label">Poll attempts</div></div><div className="stat-card"><div className="stat-value"><StatusBadge value={item.signature_verified ? "verified" : "pending"} /></div><div className="stat-label">TEE signature</div></div></div>
    <Card title="Instruction proof" subtitle="Public commitments and signer binding only."><div className="key-grid"><span>Instruction</span><strong>{item.instruction_id}</strong><span>Ciphertext hash</span><strong>{item.ciphertext_hash}</strong><span>TEE identity</span><strong>{item.selected_tee_id}</strong><span>TEE signer</span><strong>{item.tee_signer}</strong><span>Signer epoch</span><strong>{item.tee_signer_epoch}</strong><span>Requested</span><strong>{formatDate(item.requested_at || item.created_at)}</strong><span>Finalization tx</span><strong>{item.finalization_tx_hash ? shortAddress(item.finalization_tx_hash) : "Pending"}</strong></div>{item.error_message && <div className="form-error">{item.error_message}</div>}<div className="agent-callout"><ShieldCheck size={18} /><div><strong>Private result protected</strong><p className="muted">Raw FCC result data and signatures are intentionally omitted from the API response.</p></div></div></Card>
  </div>;
}
