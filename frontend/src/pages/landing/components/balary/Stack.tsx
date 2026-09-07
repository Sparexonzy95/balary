const STACK = [
  "Flare Coston2",
  "USD₮0",
  "Flare RPC",
  "React + Vite",
  "Django + Celery",
  "viem worker",
];

export function Stack() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-[1440px] px-6 md:px-8">
        <div className="rounded-[24px] glass grain p-8 md:p-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary">
                Stack
              </span>
              <h3 className="mt-3 font-display text-[26px] font-semibold leading-tight text-foreground md:text-[30px]">
                Production-grade primitives.
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="group inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 font-mono text-[11px] text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 group-hover:bg-primary" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
