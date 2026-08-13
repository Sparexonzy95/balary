import { BookOpenText, FileText, ShieldCheck } from "lucide-react";

export const blogPosts = [
  {
    slug: "institutional-salary-infrastructure-onchain",
    icon: ShieldCheck,
    category: "Verified Payroll",
    title: "Why institutional salary infrastructure belongs onchain",
    excerpt:
      "Payroll is one of the most sensitive workflows in a company. Balary combines verifiable execution with validated operational data, giving teams a path to automate payroll without exposing compensation patterns.",
    date: "May 2026",
    read: "6 min read",
    featured: true,
    sections: [
      {
        title: "Payroll needs more than payment rails",
        body: "Salary operations include approval, funding, employee identity, execution timing, and claim status. When these pieces are handled in public or fragmented systems, teams inherit unnecessary exposure. Institutional salary infrastructure treats payroll as an end-to-end workflow, not a single transfer event.",
      },
      {
        title: "Verification and verification should work together",
        body: "Companies need confidence that a run was funded and executed, while employees need a simple path to claim. The goal is not to hide operational truth. The goal is to reveal only what each participant needs to act.",
      },
      {
        title: "What Balary optimizes for",
        body: "Balary focuses on structured templates, clear funding requirements, verified salary logic, and employee claim flows. That combination gives finance teams a calmer way to coordinate recurring compensation without broadcasting sensitive payroll patterns.",
      },
    ],
  },
  {
    slug: "payroll-flows-reveal-less",
    icon: ShieldCheck,
    category: "Security",
    title: "Designing payroll flows that reveal less by default",
    excerpt:
      "A practical look at minimizing exposed balances, employee amounts, and repeated payout signals across modern finance teams.",
    date: "May 2026",
    read: "5 min read",
    sections: [
      {
        title: "Exposure often comes from workflow shape",
        body: "Payroll systems can leak context even when no single screen looks dangerous. Repeated amounts, timing patterns, approval trails, and wallet relationships can tell a story. A verification-first workflow reduces those signals at the structure level.",
      },
      {
        title: "Reduce what every participant can infer",
        body: "Employers need operational control. Employees need claim clarity. Observers should not learn compensation details from normal payroll activity. Designing around those boundaries keeps sensitive information from becoming ambient data.",
      },
      {
        title: "Default verification is the cleanest verification",
        body: "The strongest verification posture is the one teams do not have to remember to enable. Balary makes verifiedity part of the run and claim flow so operators can focus on execution.",
      },
    ],
  },
  {
    slug: "spreadsheet-approvals-to-salary-runs",
    icon: FileText,
    category: "Operations",
    title: "From spreadsheet approvals to structured salary runs",
    excerpt:
      "How payroll operators can move from manual coordination to reusable templates, controlled funding, and clear run states.",
    date: "Apr 2026",
    read: "4 min read",
    sections: [
      {
        title: "Manual payroll coordination does not scale cleanly",
        body: "Spreadsheets are useful for planning, but they become brittle when they carry execution responsibility. Operators need a system that separates setup, funding, run status, and employee action.",
      },
      {
        title: "Templates create repeatability",
        body: "A reusable payroll template gives teams a stable base for recurring compensation. It reduces duplicate setup work and keeps each run attached to a familiar operational structure.",
      },
      {
        title: "Status matters",
        body: "Clear run states help finance teams know what needs attention. Funding gaps, pending execution, completed runs, and claims should be visible without exposing institutional salary amounts.",
      },
    ],
  },
  {
    slug: "employers-verified-payroll-expectations",
    icon: BookOpenText,
    category: "Product",
    title: "What employers should expect from verified payroll",
    excerpt:
      "The core product principles behind Balary: predictable funding, institutional claim logic, transparent status, and employee self-service.",
    date: "Apr 2026",
    read: "7 min read",
    sections: [
      {
        title: "The employer experience should stay operational",
        body: "Verified payroll should not feel mysterious to the teams running it. Employers still need templates, balances, run history, and clear actions. The verification layer should reduce exposure without making the interface harder to operate.",
      },
      {
        title: "Employees need a direct claim path",
        body: "A good employee flow avoids unnecessary context and focuses on the claim. The employee should understand what is available, what action is required, and when the payout is complete.",
      },
      {
        title: "Verifiedity should improve trust",
        body: "Institutional payroll infrastructure gives companies a way to respect compensation sensitivity while keeping execution disciplined. The result should feel more controlled, not more complicated.",
      },
    ],
  },
];

export const featuredPost = blogPosts.find((post) => post.featured) ?? blogPosts[0];
export const latestPosts = blogPosts.filter((post) => !post.featured);
