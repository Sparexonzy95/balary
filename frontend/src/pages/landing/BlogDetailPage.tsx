import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Footer } from "./components/balary/Footer";
import { Navbar } from "./components/balary/Navbar";
import { blogPosts } from "./blogData";

export function BlogDetailPage() {
  const { slug } = useParams();
  const post = blogPosts.find((item) => item.slug === slug);
  const related = blogPosts.filter((item) => item.slug !== slug).slice(0, 2);

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <main className="mx-auto max-w-3xl px-6 pb-24 pt-40 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
            Blog
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal">
            Article not found
          </h1>
          <Link
            to="/blog"
            className="decrypt-hover-btn mt-8 inline-flex items-center gap-2 rounded-full bg-[#FE9E15] px-5 py-3 text-sm font-semibold text-black"
          >
            <ArrowLeft size={16} />
            Back to Blog
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-36 md:px-10">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Blog
        </Link>

        <article className="mt-10">
          <header className="border-b border-white/10 pb-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
              {post.category}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight tracking-normal md:text-7xl">
              {post.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/62 md:text-lg">
              {post.excerpt}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/45">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 size={16} />
                {post.read}
              </span>
            </div>
          </header>

          <div className="grid gap-12 py-14 lg:grid-cols-[220px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-32 rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/38">
                  In this article
                </p>
                <div className="mt-5 space-y-3 text-sm text-white/55">
                  {post.sections.map((section, index) => (
                    <a
                      key={section.title}
                      href={`#section-${index + 1}`}
                      className="block transition hover:text-white"
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              </div>
            </aside>

            <div className="space-y-12">
              {post.sections.map((section, index) => (
                <section
                  id={`section-${index + 1}`}
                  key={section.title}
                  className="scroll-mt-32"
                >
                  <p className="font-mono text-sm text-white/35">
                    0{index + 1}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                    {section.title}
                  </h2>
                  <p className="mt-5 text-lg leading-9 text-white/66">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </article>

        <section className="border-t border-white/10 py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
                Continue Reading
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                Related articles
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                to={`/blog/${item.slug}`}
                className="group rounded-[22px] border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/20 hover:bg-white/[0.055]"
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/38">
                  {item.category}
                </p>
                <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-normal">
                  {item.title}
                </h3>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/55 transition group-hover:text-white">
                  Read article
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
