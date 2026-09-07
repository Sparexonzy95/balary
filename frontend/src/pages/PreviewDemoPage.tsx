import { useState } from "react";
import { Link } from "react-router-dom";

const steps = [
  {
    label: "Deposit",
    title: "Lock 10 public USDM",
    copy: "The Balary Gateway receives 10 Preview USDM and locks it as 1:1 backing.",
    tx: "1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d",
    balances: { publicUsdm: 90, shieldedZusdm: 10, locked: 10, outstanding: 10 },
  },
  {
    label: "Fund",
    title: "Finance funds 5 zUSDM",
    copy: "HR has privately approved the exact salary intent. Finance funds only that approved 5 zUSDM allocation.",
    tx: "37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6",
    balances: { publicUsdm: 90, shieldedZusdm: 5, locked: 10, outstanding: 10 },
  },
  {
    label: "Claim",
    title: "Employee claims 5 zUSDM",
    copy: "The employee proves private entitlement to the salary coin. The PayrollVault reaches COMPLETED.",
    tx: "f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce",
    balances: { publicUsdm: 90, shieldedZusdm: 10, locked: 10, outstanding: 10 },
  },
  {
    label: "Redeem",
    title: "Burn 5 zUSDM, release 5 USDM",
    copy: "The Gateway burns 5 zUSDM and releases the same amount of public USDM. The 1:1 invariant remains intact.",
    tx: "4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33",
    balances: { publicUsdm: 95, shieldedZusdm: 5, locked: 5, outstanding: 5 },
  },
];

function short(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function PreviewDemoPage() {
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-6 md:px-10">
          <Link to="/" className="balary-landing-wordmark" aria-label="Back to Balary home">
            <span>B</span>alary
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Sparexonzy95/balary"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white/55 transition hover:text-white"
            >
              GitHub
            </a>
            <Link
              to="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Back home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-14 md:px-10 md:py-20">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.03em] md:text-6xl">
            Confidential payroll, step by step.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 md:text-lg">
            A read-only replay of a successful Preview execution.
          </p>
        </div>

        <section className="mt-12 overflow-hidden rounded-[24px] border border-white/10 bg-[#0C0C0E]">
          <div className="grid border-b border-white/10 md:grid-cols-4">
            {steps.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActive(index)}
                className={`border-b border-white/10 px-5 py-4 text-left transition md:border-b-0 md:border-r ${
                  index === active ? "bg-[#FE9E15] text-black" : "bg-white/[0.02] text-white/55 hover:bg-white/[0.055] hover:text-white"
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Step {String(index + 1).padStart(2, "0")}</span>
                <span className="mt-1 block text-sm font-semibold">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FE9E15]">{step.label}</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em]">{step.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">{step.copy}</p>

              <div className="mt-8 border-t border-white/10 pt-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Transaction</div>
                <div className="mt-3 font-mono text-sm text-white/75" title={step.tx}>{short(step.tx)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Public USDM", `${step.balances.publicUsdm} USDM`],
                ["Gateway locked", `${step.balances.locked} USDM`],
                ["Wallet zUSDM", `${step.balances.shieldedZusdm} zUSDM`],
                ["Outstanding", `${step.balances.outstanding} zUSDM`],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-white/10 py-2 pl-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">{label}</div>
                  <div className="mt-3 text-xl font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[#FE9E15]/30 bg-[#FE9E15]/[0.06] px-6 py-4 text-sm text-white/65 md:px-10">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FE9E15]">Invariant</span>
            <span className="ml-3">Locked USDM always equals redeemable zUSDM.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
