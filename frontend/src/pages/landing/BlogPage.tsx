import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "./components/balary/Footer";
import { Navbar } from "./components/balary/Navbar";
import { featuredPost, latestPosts } from "./blogData";

const briefs = [
  "Payroll verification is part of workflow architecture, not a feature toggle.",
  "The best finance systems reduce exposure while improving execution confidence.",
  "Verified tools should feel simple at the surface and precise underneath.",
];

function Meta({ date, read }: { date: string; read: string }) {
  return (
    <div className="flex items-center gap-4 text-xs text-white/45">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={14} />
        {date}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock3 size={14} />
        {read}
      </span>
    </div>
  );
}

export function BlogPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-36 md:px-10 lg:px-14">
        <section className="grid min-h-[calc(100svh-9rem)] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-2xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              Balary Journal
            </p>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-normal md:text-7xl">
              Notes on institutional payroll,
              <span className="block text-white/55">finance, and trust.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/62 md:text-lg">
              Thoughtful writing for teams building better payment operations:
              less exposure, cleaner workflows, and more confidence in every run.
            </p>
          </div>

          <article className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[#0D0D0B] p-6 shadow-2xl md:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_48%,rgba(254,158,21,0.05))]" />
            <div className="relative flex min-h-[520px] flex-col justify-between rounded-[24px] border border-white/10 bg-black p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/65">
                  Featured
                </span>
                <Meta date={featuredPost.date} read={featuredPost.read} />
              </div>

              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/38">
                  {featuredPost.category}
                </p>
                <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
                  {featuredPost.title}
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/58 md:text-base">
                  {featuredPost.excerpt}
                </p>
              </div>

              <Link
                to={`/blog/${featuredPost.slug}`}
                className="decrypt-hover-btn inline-flex w-fit items-center gap-2 rounded-full bg-[#FE9E15] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90"
              >
                Read Article
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
                Latest Thinking
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
                Practical essays for payroll teams.
              </h2>
            </div>
            <a
              href="https://docs.balary.lol"
              target="_blank"
              rel="noopener noreferrer"
              className="decrypt-hover-btn inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              View Docs
              <ArrowRight size={16} />
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {latestPosts.map((post) => {
              const Icon = post.icon;

              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group rounded-[24px] border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/20 hover:bg-white/[0.055]"
                >
                  <div className="mb-10 flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black text-white/65 transition group-hover:text-white">
                      <Icon size={20} />
                    </span>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                      {post.category}
                    </span>
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight tracking-normal">
                    {post.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-white/55">
                    {post.excerpt}
                  </p>
                  <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/42">
                    <span>{post.date}</span>
                    <span>{post.read}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 py-16">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              Editorial Position
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Clear, measured, and useful.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {briefs.map((brief, index) => (
              <div
                key={brief}
                className="min-h-[170px] rounded-[22px] border border-white/10 bg-white/[0.035] p-5"
              >
                <span className="font-mono text-sm text-white/35">
                  0{index + 1}
                </span>
                <p className="mt-8 text-lg leading-7 text-white/70">{brief}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
