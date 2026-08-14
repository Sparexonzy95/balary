import { ArrowDownToLine, Copy, ExternalLink } from "lucide-react";
import { Footer } from "./components/balary/Footer";
import { Navbar } from "./components/balary/Navbar";
import { useToast } from "../../components/ui";

const LOGO_MARK =
  "https://res.cloudinary.com/dhjmedwbx/image/upload/v1777145846/BALARY_LOGO_SVG_3_half_cdjkqt.svg";
const LOGO_WORDMARK =
  "https://res.cloudinary.com/dhjmedwbx/image/upload/v1777145846/BALARY_LOGO_SVG_3_half_cdjkqt.svg";

const colors = [
  { name: "Signal Orange", hex: "#FE9E15", note: "Primary actions and key emphasis" },
  { name: "Ink Black", hex: "#050505", note: "Core backgrounds and high contrast" },
  { name: "Soft White", hex: "#F7F7F2", note: "Headlines on dark surfaces" },
  { name: "Ledger Gray", hex: "#8F8F86", note: "Supporting text and metadata" },
  { name: "Institutional Lime", hex: "#D9F99D", note: "Positive highlights and success cues" },
  { name: "Vault Line", hex: "#2A2925", note: "Borders, dividers, and quiet panels" },
];

const voice = [
  "Confident, not loud.",
  "Technical, but never cold.",
  "Verification-first without fear-based language.",
  "Clear verbs. Short sentences. Operational trust.",
];

const usageRules = [
  {
    label: "Background",
    title: "Use quiet surfaces",
    text: "Place the logo on solid black, white, or low-noise surfaces so the mark stays easy to read.",
    tone: "Do",
  },
  {
    label: "Spacing",
    title: "Give it room",
    text: "Leave generous clear space around the mark. Do not crowd it with headlines, body copy, or partner logos.",
    tone: "Do",
  },
  {
    label: "Integrity",
    title: "Keep the asset intact",
    text: "Do not stretch, recolor, rotate, crop, shadow, outline, or add visual effects to the logo.",
    tone: "Don't",
  },
  {
    label: "Color",
    title: "Use orange with intent",
    text: "Reserve Signal Orange for calls to action, status emphasis, and key moments rather than full-page decoration.",
    tone: "Do",
  },
];

function copyText(value: string, toast: ReturnType<typeof useToast>) {
  if (!navigator.clipboard) {
    toast.push({
      kind: "error",
      title: "Copy unavailable",
      message: "Your browser does not allow clipboard access here.",
    });
    return;
  }

  void navigator.clipboard.writeText(value).then(
    () => toast.push({ kind: "success", title: "Copied" }),
    () =>
      toast.push({
        kind: "error",
        title: "Could not copy",
        message: "Please copy it manually.",
      })
  );
}

function CopyButton({ value }: { value: string }) {
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={() => copyText(value, toast)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:text-white"
      aria-label={`Copy ${value}`}
    >
      <Copy size={15} />
    </button>
  );
}

export function BrandKitPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-36 md:px-10 lg:px-14">
        <section className="grid min-h-[calc(100svh-9rem)] items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-2xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-[#FE9E15]">
              Balary Brand Kit
            </p>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-normal text-white md:text-7xl">
              Institutional payroll,
              <span className="block text-white/55">presented clearly.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/62 md:text-lg">
              A compact identity system for using Balary consistently across
              product surfaces, partner pages, announcements, and community posts.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={LOGO_MARK}
                target="_blank"
                rel="noopener noreferrer"
                className="decrypt-hover-btn inline-flex items-center gap-2 rounded-full bg-[#FE9E15] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90"
              >
                <ArrowDownToLine size={16} />
                Logo Mark
              </a>
              <a
                href={LOGO_WORDMARK}
                target="_blank"
                rel="noopener noreferrer"
                className="decrypt-hover-btn inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <ExternalLink size={16} />
                Wordmark
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0D0D0B] p-6 shadow-2xl md:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(254,158,21,0.18),transparent_38%,rgba(217,249,157,0.08))]" />
            <div className="relative grid min-h-[420px] place-items-center rounded-[22px] border border-white/10 bg-black">
              <img
                src={LOGO_MARK}
                alt="Balary logo"
                className="w-[min(70%,360px)] object-contain"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FE9E15]">
                Color
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
                Quiet foundation. Bright signal.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/55">
              Use orange sparingly for action and orientation. Let black, white,
              and gray carry most interface weight.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colors.map((color) => (
              <article
                key={color.hex}
                className="rounded-[18px] border border-white/10 bg-white/[0.035] p-4"
              >
                <div
                  className="h-28 rounded-[14px] border border-white/10"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">{color.name}</h3>
                    <p className="mt-1 font-mono text-xs text-white/45">{color.hex}</p>
                    <p className="mt-3 text-sm leading-5 text-white/55">{color.note}</p>
                  </div>
                  <CopyButton value={color.hex} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/10 py-16 lg:grid-cols-3">
          <article className="rounded-[22px] border border-white/10 bg-white/[0.035] p-6 lg:col-span-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FE9E15]">
              Typography
            </p>
            <div className="mt-8 space-y-8">
              <div>
                <p className="text-sm text-white/45">Display and interface</p>
                <p className="mt-2 text-5xl font-semibold tracking-normal md:text-7xl">
                  Mona Sans
                </p>
              </div>
              <div>
                <p className="text-sm text-white/45">Technical labels</p>
                <p className="mt-2 font-mono text-2xl tracking-normal text-white/80">
                  Fira Mono / 0123456789
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[22px] border border-white/10 bg-[#FE9E15] p-6 text-black">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-black/55">
              Voice
            </p>
            <ul className="mt-8 space-y-4 text-lg font-semibold leading-6">
              {voice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FE9E15]">
              Usage
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Keep the mark calm and legible.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/55">
              Treat the logo as a trust signal. It should feel stable, precise,
              and uncluttered wherever it appears.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {usageRules.map((rule, index) => (
              <article
                key={rule.title}
                className="flex min-h-[260px] flex-col justify-between rounded-[22px] border border-white/10 bg-white/[0.035] p-5"
              >
                <div>
                  <div className="mb-8 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-white/35">
                      0{index + 1}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/38">
                      {rule.label}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-normal text-white">
                    {rule.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{rule.text}</p>
                </div>
                <span
                  className={`mt-6 w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    rule.tone === "Do"
                      ? "border border-white/12 bg-white/[0.04] text-white/62"
                      : "border border-white/12 bg-black text-white/70"
                  }`}
                >
                  {rule.tone}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">
              Need the product context too?
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              The docs explain how Balary works across employer funding,
              validated payroll flows, and employee claims.
            </p>
          </div>
          <a
            href="https://docs.balary.lol"
            target="_blank"
            rel="noopener noreferrer"
            className="decrypt-hover-btn inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            View Docs
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
