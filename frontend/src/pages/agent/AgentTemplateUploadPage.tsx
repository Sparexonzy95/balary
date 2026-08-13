import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useActiveInstitution } from "../../hooks/useInstitutions";
import { useCreateSchedule } from "../../hooks/useOperations";
import { Button, Card, EmptyState, Field, PageHeader, useToast } from "../../components/ui";
import { errorMessage } from "../../lib/api";

export function AgentTemplateUploadPage() {
  const { institution } = useActiveInstitution();
  const create = useCreateSchedule();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = React.useState({ name: "Monthly payroll", frequency: "monthly", timezone_name: "Africa/Lagos", next_run_at: "", funding_window_hours: "24" });
  const [error, setError] = React.useState<string | null>(null);
  const institutionId = institution?.id;
  if (!institutionId) return <EmptyState title="Institution required" description="Register an institution before creating schedules." />;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    try {
      const result = await create.mutateAsync({ institution: institutionId, name: form.name, title_template: "Payroll - {period}", period_label_template: "{month} {year}", frequency: form.frequency as any, timezone_name: form.timezone_name, next_run_at: new Date(form.next_run_at).toISOString(), funding_start_offset_minutes: 10, funding_window_hours: Number(form.funding_window_hours), minimum_withdrawal_window_seconds: 86400, settlement_grace_period_seconds: 3600, active: true } as any);
      toast.complete({ title: "Payroll schedule created", message: "Each occurrence will create a fresh private payroll shell." });
      navigate(`/agent/templates/${result.id}`);
    } catch (err) { setError(errorMessage(err)); }
  }
  return <div className="dashboard-shell agent-page"><Link className="template-detail-back-link" to="/agent"><ArrowLeft size={14} /><span>Back</span></Link><PageHeader eyebrow="Recurring payroll" title="Create" accentTitle="schedule" description="Create fresh payroll shells without copying prior salary rows or ciphertext." /><Card title="Schedule configuration" subtitle="The visual structure follows the sample frontend exactly."><form className="form-stack" onSubmit={submit}><div className="form-grid"><Field label="Schedule name"><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required /></Field><Field label="Frequency"><select value={form.frequency} onChange={(e)=>setForm({...form,frequency:e.target.value})}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></Field><Field label="Timezone"><input value={form.timezone_name} onChange={(e)=>setForm({...form,timezone_name:e.target.value})} required /></Field><Field label="Next run"><input type="datetime-local" value={form.next_run_at} onChange={(e)=>setForm({...form,next_run_at:e.target.value})} required /></Field><Field label="Funding window (hours)"><input type="number" min="1" value={form.funding_window_hours} onChange={(e)=>setForm({...form,funding_window_hours:e.target.value})} required /></Field></div>{error && <div className="form-error">{error}</div>}<Button type="submit" disabled={create.isPending}><CalendarClock size={16} />{create.isPending ? "Creating..." : "Create schedule"}</Button></form></Card></div>;
}
