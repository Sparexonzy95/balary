import {
  ArrowRight,
  Building2,
  FileCheck2,
  Globe2,
  Landmark,
  Network,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "./components/balary/Footer";
import { Navbar } from "./components/balary/Navbar";

const useCases = [
  {
    icon: Building2,
    label: "Startups",
    title: "Institutional payroll for distributed teams",
    text: "Run predictable USD₮0 payroll without making individual compensation patterns visible across public infrastructure.",
  },
  {
    icon: Network,
    label: "DAOs",
    title: "Contributor payments with cleaner coordination",
    text: "Move recurring contributor compensation from scattered approvals into reusable templates and visible run states.",
  },
  {
    icon: Landmark,
    label: "Funds",
    title: "Operational payouts for lean finance teams",
    text: "Separate funding, scheduling, and claims so operators can execute payment cycles with fewer manual checks.",
  },
  {
    icon: Globe2,
    label: "Global Teams",
    title: "Cross-border salary workflows",
    text: "Give employees a claim flow while employers keep payroll operations structured, verifiable, and verification-conscious.",
  },
];

const workflow = [
  {
    icon: FileCheck2,
    title: "Create template",
    text: "Define the payroll structure once, including employees and intended amounts.",
  },
  {
    icon: WalletCards,
    title: "Fund the run",
    text: "Deposit stablecoin value before execution so payroll has clear coverage.",
  },
  {
    icon: ShieldCheck,
    title: "Execute institutionally",
    text: "Run verified salary logic while keeping sensitive amounts protected.",
  },
  {
    icon: UsersRound,
    title: "Employees claim",
    text: "Employees complete their claim flow from a guided, self-service experience.",
  },
];

const outcomes = [
  ["Less exposure", "Reduce visible salary and payout patterns."],
  ["Cleaner control", "Keep funding, execution, and claims in one flow."],
  ["Better auditability", "Track operational status without revealing institutional amounts."],
  ["Employee clarity", "Give claimants a focused destination for salary access."],
];

export function UseCasesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-36 md:px-10 lg:px-14">
        <section className="grid min-h-[calc(100svh-9rem)] items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              Balary Use Cases
            </p>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-normal md:text-7xl">
              Payroll verification for teams
              <span className="block text-white/55">that move globally.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/62 md:text-lg">
              Balary is built for organizations that need structured payroll,
              predictable stablecoin funding, and institutional employee compensation
              workflows without sacrificing operational visibility.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app"
                className="decrypt-hover-btn inline-flex items-center gap-2 rounded-full bg-[#FE9E15] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90"
              >
                Launch App
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-section"
                target="_blank"
                rel="noopener noreferrer"
                className="decrypt-hover-btn inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Read Docs
                <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[#0D0D0B] p-5 shadow-2xl md:p-7">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_46%,rgba(254,158,21,0.06))]" />
            <div className="relative grid gap-3 rounded-[24px] border border-white/10 bg-black p-4 md:p-5">
              {outcomes.map(([title, text], index) => (
                <div
                  key={title}
                  className="grid gap-4 rounded-[18px] border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[auto_1fr]"
                >
                  <span className="font-mono text-sm text-white/35">
                    0{index + 1}
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold tracking-normal">
                      {title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="mb-8 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              Who It Serves
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Four teams. One institutional payroll layer.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {useCases.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="group rounded-[24px] border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/20 hover:bg-white/[0.055]"
                >
                  <div className="mb-12 flex items-center justify-between gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black text-white/70 transition group-hover:text-white">
                      <Icon size={22} />
                    </span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                      {item.label}
                    </span>
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight tracking-normal">
                    {item.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
                From template to claim.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/55">
              The strongest use case for Balary is not just verification. It is the
              combination of institutional data handling and repeatable payroll control.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {workflow.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black text-white/70">
                      <Icon size={20} />
                    </span>
                    <span className="font-mono text-xs text-white/38">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-normal">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 rounded-[30px] border border-white/10 bg-white/[0.04] p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              Ready
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Start with a payroll template.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Create a run, fund it, and let employees claim through a simpler
              verified workflow.
            </p>
          </div>
          <Link
            to="/app"
            className="decrypt-hover-btn inline-flex items-center justify-center gap-2 rounded-full bg-[#FE9E15] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90"
          >
            Open Balary
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
