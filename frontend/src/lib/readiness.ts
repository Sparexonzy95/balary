export function canGenerateMerkle(run?: { onchain_payroll_id?: string | number | null }) {
  return Boolean(run?.onchain_payroll_id);
}

export function backendReportedPayrollStatus(run?: { status?: string | null }) {
  return run?.status || "unknown";
}

