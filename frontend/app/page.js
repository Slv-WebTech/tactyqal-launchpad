import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getPosts } from "@/lib/api";

const STORIES = [
  ["KrishiDrishti", "AI soil analysis and crop recommendations for Indian farmers.", "🌾"],
  ["Elenor Vegan Handbags", "Corporate gifting platform started by a 16-year-old.", "👜"],
  ["One Last Chapter", "A kids' book subscription service started at 13.", "📚"],
  ["Paws of Promise", "Virtual pet adoption connecting pet lovers with shelters.", "🐾"],
  ["AudioNova", "An AI music and video production company.", "🎧"],
  ["Converza", "Spanish learning app with an AI language buddy, Luna.", "🗣️"],
];
const STEPS = [
  ["Weeks 1–2", "Ideation & market research", "Find a problem worth solving and validate it with real people."],
  ["Weeks 3–4", "Design & prototyping", "Turn the idea into screens and a clickable prototype."],
  ["Weeks 5–6", "Full-stack development", "Build a working product using no-code and modern tools."],
  ["Weeks 7–8", "Launch & marketing", "Ship, pitch and launch on Product Hunt."],
];
const WHY = [
  ["1:1 personalised mentoring", "Dedicated expert guidance. No group classes."],
  ["Full-stack app, no code", "Build a real app with no-code tools."],
  ["Proven track record", "50+ students, real revenue and university offers."],
  ["Admissions edge", "Real projects and achievements to stand out."],
  ["Revenue skills", "Learn to build, launch and monetise."],
  ["Lifelong support", "From ideation to launch and beyond."],
];
const TOOLS = ["Startup Idea Generator", "Fundability Assessment", "Team Evaluation Tool", "Pitch Deck Analyzer", "Cofounder Compatibility Test", "Problem–Solution Fit", "Landing Page Assessment", "Top 10 Traits For Business Success"];
const TESTIMONIALS = [
  ["Isha Patel", "Now I feel independent and can build anything I want."],
  ["Rohan Verma", "It's the future."],
  ["Devansh Mehta", "I went from no idea to launching an app."],
  ["Priya Nair", "My impact app only existed in my head until I built it."],
];
const FAQ = [
  ["Does my teen need coding experience?", "No. The program is designed for beginners and uses no-code tools."],
  ["What kind of apps get built?", "AI tools, e-commerce, subscriptions and social-good projects."],
  ["How much time does it take?", "About 2–3 hours a week, including one hour of live 1:1 mentoring."],
  ["Can they earn real revenue?", "Yes — several students have, and some won grants and media coverage."],
  ["Is there support after the program?", "Yes: ongoing support, an alumni community and post-program guidance."],
];

const Section = ({ id, eyebrow, title, children, tint }) => (
  <section id={id} className={tint ? "bg-slate-50" : ""}>
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-extrabold text-ink md:text-4xl">{title}</h2>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

export default async function Home() {
  const { data: posts } = await getPosts({ limit: 3 });
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium">1:1 mentoring · Idea to full-stack app · No coding</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            Empower your teen to build an app that <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">impacts millions</span> — in 8 weeks.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">Personal mentoring that takes an idea from a notebook to a launched product, with a portfolio that stands out for admissions and grants.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#contact" className="rounded-full bg-accent px-7 py-3 font-semibold text-ink transition hover:brightness-110">Book free consultation</Link>
            <Link href="#success" className="rounded-full border border-white/30 px-7 py-3 font-semibold transition hover:bg-white/10">See success stories</Link>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6">
            {[["100+", "Students mentored"], ["8 wks", "Idea to launch"], ["1:1", "Live sessions"]].map(([n, l]) => (
              <div key={l}><dt className="text-3xl font-extrabold">{n}</dt><dd className="text-sm text-slate-400">{l}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <Section id="success" eyebrow="Success stories" title="Real students. Real apps. Real results.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STORIES.map(([name, desc, icon]) => (
            <article key={name} className="rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-2xl">{icon}</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{name}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="program" tint eyebrow="The program" title="From idea to full app in 8 weeks">
        <ol className="grid gap-5 md:grid-cols-4">
          {STEPS.map(([wk, title, desc], i) => (
            <li key={wk} className="relative rounded-2xl bg-white p-6 shadow-sm">
              <span className="text-5xl font-black text-brand/15">{i + 1}</span>
              <p className="mt-1 text-xs font-semibold uppercase text-emerald-600">{wk}</p>
              <h3 className="mt-1 font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{desc}</p>
            </li>
          ))}
        </ol>
        <blockquote className="mt-10 border-l-4 border-brand pl-5 text-lg italic text-slate-700">
          “Learn to sell. Learn to build. If you can do both, you will be unstoppable.” <span className="not-italic text-slate-500">— Naval Ravikant</span>
        </blockquote>
      </Section>

      <Section id="why" eyebrow="Why Tactyqal" title="Why parents choose Tactyqal Labs">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(([t, d]) => (
            <div key={t} className="flex gap-4 rounded-2xl border border-slate-200 p-5">
              <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-bold text-emerald-700">✓</span>
              <div><h3 className="font-bold text-slate-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tools" tint eyebrow="Free tools" title="Free tools to get started">
        <div className="flex flex-wrap gap-3">
          {TOOLS.map((t) => <span key={t} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm">{t}</span>)}
        </div>
      </Section>

      <Section eyebrow="Testimonials" title="What our students say">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map(([name, quote]) => (
            <figure key={name} className="rounded-2xl bg-slate-50 p-6">
              <blockquote className="text-slate-700">“{quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-900">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white">{name[0]}</span>{name}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="blog" tint eyebrow="Blog" title="Learn from industry experts">
        {posts.length ? (
          <div className="grid gap-5 md:grid-cols-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Start the blog API (see README) to load posts here.</p>
        )}
        <Link href="/blog" className="mt-8 inline-block font-semibold text-brand hover:underline">Read all articles →</Link>
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="Start your teen's entrepreneurial journey">
        <div className="max-w-md rounded-3xl border-2 border-brand p-8 shadow-xl">
          <p className="text-slate-500 line-through">₹25,000</p>
          <p className="text-5xl font-extrabold text-ink">₹16,000</p>
          <p className="mt-1 text-sm text-slate-500">Limited time · only 15 spots a month</p>
          <ul className="mt-6 space-y-2 text-sm">
            {["8 weeks of 1:1 mentoring", "Full-stack app development", "Product Hunt launch", "Pitch deck creation", "Marketing strategy", "Ongoing support"].map((i) => <li key={i}>✓ {i}</li>)}
          </ul>
          <Link href="#contact" className="mt-8 block rounded-full bg-brand py-3 text-center font-semibold text-white hover:bg-brand-dark">Enroll now</Link>
        </div>
      </Section>

      <Section id="faq" tint eyebrow="FAQ" title="Questions parents ask">
        <div className="max-w-3xl space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-xl bg-white p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}<span className="text-brand transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section id="contact" className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">Ready to start your teen's success story?</h2>
          <p className="mt-3 text-white/80">Email tactyqal.labs@gmail.com or call +91-98047-72106 (Mon–Sat, 9am–7pm). We reply within 24 hours.</p>
          <a href="mailto:tactyqal.labs@gmail.com?subject=Free%20consultation" className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-semibold text-brand hover:bg-slate-100">Book a free appointment</a>
        </div>
      </section>
    </>
  );
}
