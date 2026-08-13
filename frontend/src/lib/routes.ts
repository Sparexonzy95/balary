export const routes = {
  health: {
    live: "/health/",
    ready: "/health/ready/",
  },
  auth: {
    nonce: "/auth/nonce/",
    refresh: "/auth/refresh/",
    verify: "/auth/verify/",
    me: "/auth/me/",
  },
  chains: {
    arc: "/chains/coston2/",
  },
  institutions: {
    list: "/institutions/",
    me: "/institutions/",
    detail: (institutionId: number | string) => `/institutions/${institutionId}/`,
    prepareRegistration: (institutionId: number | string) =>
      `/institutions/${institutionId}/registration/prepare/`,
    confirmRegistration: (institutionId: number | string) =>
      `/institutions/${institutionId}/registration/confirm/`,
    prepareHr: (institutionId: number | string) =>
      `/institutions/${institutionId}/roles/hr/prepare/`,
    prepareFinance: (institutionId: number | string) =>
      `/institutions/${institutionId}/roles/finance/prepare/`,
    confirmRole: (institutionId: number | string) =>
      `/institutions/${institutionId}/roles/confirm/`,
    prepareRoleRemoval: (institutionId: number | string, role: "hr" | "finance") =>
      `/institutions/${institutionId}/roles/${role}/prepare/`,
    confirmRoleRemoval: (institutionId: number | string) =>
      `/institutions/${institutionId}/roles/confirm/`,
  },
  employees: {
    list: "/employees/",
    status: (employeeId: number | string) => `/employees/${employeeId}/status/`,
  },
  payroll: {
    list: "/payrolls/",
    detail: (runId: number | string) => `/payrolls/${runId}/`,
    upload: (runId: number | string) => `/payrolls/${runId}/encrypt/`,
    validate: (runId: number | string) => `/payrolls/${runId}/validate/`,
    generateMerkle: (runId: number | string) => `/payrolls/${runId}/`,
    prepareCreateDraft: (runId: number | string) => `/payrolls/${runId}/draft/prepare/`,
    confirmCreateDraft: (runId: number | string) => `/payrolls/${runId}/draft/confirm/`,
    prepareUpload: (runId: number | string) => `/payrolls/${runId}/computation/prepare/`,
    confirmUpload: (runId: number | string) => `/payrolls/${runId}/computation/confirm/`,
    prepareActivate: (runId: number | string) => `/payrolls/${runId}/funding/open/prepare/`,
    confirmActivate: (runId: number | string) => `/payrolls/${runId}/funding/open/confirm/`,
    fundingContext: (runId: number | string) => `/payrolls/${runId}/funding/context/`,
    prepareApproval: (runId: number | string) => `/payrolls/${runId}/funding/approval/prepare/`,
    confirmApproval: (runId: number | string) => `/payrolls/${runId}/funding/approval/confirm/`,
    prepareFund: (runId: number | string) => `/payrolls/${runId}/funding/fund/prepare/`,
    confirmFund: (runId: number | string) => `/payrolls/${runId}/funding/fund/confirm/`,
    status: (runId: number | string) => `/payrolls/${runId}/`,
  },
  claims: {
    available: "/withdrawals/",
    eligible: "/withdrawals/available/",
    context: (payrollId: number | string) => `/withdrawals/context/${payrollId}/`,
    prepare: "/withdrawals/prepare/",
    payload: (withdrawalId: number | string) => `/withdrawals/${withdrawalId}/`,
    confirm: (withdrawalId: number | string) => `/withdrawals/${withdrawalId}/submit/`,
    process: (withdrawalId: number | string) => `/withdrawals/${withdrawalId}/process/`,
  },
  transactions: {
    list: "/transactions/",
    detail: (transactionId: number | string) => `/transactions/${transactionId}/`,
    sync: (transactionId: number | string) => `/transactions/${transactionId}/sync/`,
  },
  notifications: {
    list: "/notifications/",
    unreadCount: "/notifications/unread-count/",
    markRead: (notificationId: number | string) => `/notifications/${notificationId}/read/`,
    markAllRead: "/notifications/read-all/",
    preferences: "/notifications/preferences/",
    deliveries: "/notifications/email-deliveries/",
    retryDelivery: (deliveryId: number | string) =>
      `/notifications/email-deliveries/${deliveryId}/retry/`,
  },
  fcc: {
    configuration: "/fcc/configuration/",
    instructions: "/fcc/instructions/",
    instruction: (instructionId: number | string) => `/fcc/instructions/${instructionId}/`,
    process: (instructionId: number | string) => `/fcc/instructions/${instructionId}/process/`,
  },
  schedules: {
    list: "/schedules/",
    detail: (scheduleId: number | string) => `/schedules/${scheduleId}/`,
    runNow: (scheduleId: number | string) => `/schedules/${scheduleId}/run-now/`,
    pause: (scheduleId: number | string) => `/schedules/${scheduleId}/pause/`,
    resume: (scheduleId: number | string) => `/schedules/${scheduleId}/resume/`,
  },
  audit: {
    events: "/audit/events/",
    eventsCsv: "/audit/events.csv",
    payroll: (runId: number | string) => `/audit/payrolls/${runId}/`,
    payrollCsv: (runId: number | string) => `/audit/payrolls/${runId}.csv`,
  },
} as const;
