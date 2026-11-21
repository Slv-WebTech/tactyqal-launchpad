import Link from "next/link";
import {
  Sprout, ShoppingBag, BookOpen, PawPrint, Headphones, Languages,
  Lightbulb, PenTool, Code, Rocket,
  Users, Blocks, Award, GraduationCap, TrendingUp, LifeBuoy,
  BadgeCheck, Handshake, Presentation, Puzzle, LayoutTemplate, ListChecks, Check,
  CalendarCheck, ArrowRight, Plus, Timer, MessageSquare, Trophy, Route, Heart, Wrench, IndianRupee, CircleHelp, Quote, Mail,
} from "lucide-react";
import PostCard from "@/components/PostCard";
import ApiRetry from "@/components/ApiRetry";
import { getPosts } from "@/lib/api";

const STORIES = [
  ["KrishiDrishti", "AI soil analysis and crop recommendations for Indian farmers.", Sprout],
  ["Elenor Vegan Handbags", "Corporate gifting platform started by a 16-year-old.", ShoppingBag],
  ["One Last Chapter", "A kids' book subscription service started at 13.", BookOpen],
  ["Paws of Promise", "Virtual pet adoption connecting pet lovers with shelters.", PawPrint],
  ["AudioNova", "An AI music and video production company.", Headphones],
  ["Converza", "Spanish learning app with an AI language buddy, Luna.", Languages],
];
const STEPS = [
  ["Weeks 1–2", "Ideation & market research", "Find a problem worth solving and validate it with real people.", Lightbulb],
  ["Weeks 3–4", "Design & prototyping", "Turn the idea into screens and a clickable prototype.", PenTool],
  ["Weeks 5–6", "Full-stack development", "Build a working product using no-code and modern tools.", Code],
  ["Weeks 7–8", "Launch & marketing", "Ship, pitch and launch on Product Hunt.", Rocket],
];
const WHY = [
  ["1:1 personalised mentoring", "Dedicated expert guidance. No group classes.", Users],
  ["Full-stack app, no code", "Build a real app with no-code tools.", Blocks],
  ["Proven track record", "50+ students, real revenue and university offers.", Award],
  ["Admissions edge", "Real projects and achievements to stand out.", GraduationCap],
  ["Revenue skills", "Learn to build, launch and monetise.", TrendingUp],
  ["Lifelong support", "From ideation to launch and beyond.", LifeBuoy],
];
const TOOLS = [
  ["Startup Idea Generator", Lightbulb], ["Fundability Assessment", BadgeCheck], ["Team Evaluation Tool", Users], ["Pitch Deck Analyzer", Presentation],
  ["Cofounder Compatibility Test", Handshake], ["Problem–Solution Fit", Puzzle], ["Landing Page Assessment", LayoutTemplate], ["Top 10 Traits For Business Success", ListChecks],
];
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

// `eyebrow` is a plain label for screen readers and the SEO outline; sighted users get the icon first.
const Section = ({ id, eyebrow, icon: Icon, title, children, tint }) => (
  <section id={id} className={tint ? "bg-slate-50" : ""}>
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-dark">
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-brand/10"><Icon className="h-4 w-4" /></span>
        {eyebrow}
      </p>
      <h2 className="mt-2 max-w-2xl text-3xl font-extrabold text-ink md:text-4xl">{title}</h2>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

export default async function Home() {
  const { data: posts, offline } = await getPosts({ limit: 3 });
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-brand/60 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium">1:1 mentoring · Idea to full-stack app · No coding</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            Empower your teen to build an app that <span className="bg-gradient-to-r from-accent to-white bg-clip-text text-transparent">impacts millions</span> — in 8 weeks.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">Personal mentoring that takes an idea from a notebook to a launched product, with a portfolio that stands out for admissions and grants.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#contact" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-semibold text-ink transition hover:bg-accent">
              <CalendarCheck aria-hidden="true" className="h-5 w-5" />Book free consultation
            </Link>
            <Link href="#success" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3 font-semibold transition hover:bg-white/10">
              <Trophy aria-hidden="true" className="h-5 w-5" />See success stories
            </Link>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6">
            {[[Users, "100+", "Students mentored"], [Timer, "8 wks", "Idea to launch"], [MessageSquare, "1:1", "Live sessions"]].map(([Icon, n, l]) => (
              <div key={l}>
                <Icon aria-hidden="true" className="mb-2 h-5 w-5 text-accent" />
                <dt className="text-3xl font-extrabold">{n}</dt>
                <dd className="text-sm text-white/90">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section id="success" eyebrow="Success stories" icon={Trophy} title="Real students. Real apps. Real results.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STORIES.map(([name, desc, Icon]) => (
            <article key={name} className="rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand-dark"><Icon className="h-6 w-6" /></div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{name}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="program" tint eyebrow="The program" icon={Route} title="From idea to full app in 8 weeks">
        <ol className="grid gap-5 md:grid-cols-4">
          {STEPS.map(([wk, title, desc, Icon], i) => (
            <li key={wk} className="relative rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-5xl font-black text-brand/15">{i + 1}</span>
                <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-brand-dark"><Icon className="h-5 w-5" /></span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase text-emerald-600">{wk}</p>
              <h3 className="mt-1 font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{desc}</p>
            </li>
          ))}
        </ol>
        <blockquote className="mt-10 flex gap-3 border-l-4 border-brand pl-5 text-lg italic text-slate-700">
          <Quote aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-brand-dark" />
          <span>“Learn to sell. Learn to build. If you can do both, you will be unstoppable.” <span className="not-italic text-slate-500">— Naval Ravikant</span></span>
        </blockquote>
      </Section>

      <Section id="why" eyebrow="Why Tactyqal" icon={Heart} title="Why parents choose Tactyqal Labs">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(([t, d, Icon]) => (
            <div key={t} className="flex gap-4 rounded-2xl border border-slate-200 p-5">
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 text-emerald-700"><Icon className="h-5 w-5" /></span>
              <div><h3 className="font-bold text-slate-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tools" tint eyebrow="Free tools" icon={Wrench} title="Free tools to get started">
        <div className="flex flex-wrap gap-3">
          {TOOLS.map(([t, Icon]) => (
            <span key={t} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm">
              <Icon aria-hidden="true" className="h-4 w-4 text-brand-dark" />{t}
            </span>
          ))}
        </div>
      </Section>

      <Section eyebrow="Testimonials" icon={Quote} title="What our students say">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map(([name, quote]) => (
            <figure key={name} className="rounded-2xl bg-slate-50 p-6">
              <blockquote className="text-slate-700">“{quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-900">
                <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white">{name[0]}</span>{name}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="blog" tint eyebrow="Blog" icon={BookOpen} title="Learn from industry experts">
        {posts.length ? (
          <div className="grid gap-5 md:grid-cols-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        ) : (
          offline ? <ApiRetry compact /> : <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">New articles are coming soon.</p>
        )}
        <Link href="/blog" className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-dark hover:underline">
          Read all articles<ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </Section>

      <Section id="pricing" eyebrow="Pricing" icon={IndianRupee} title="Start your teen's entrepreneurial journey">
        <div className="max-w-md rounded-3xl border-2 border-brand p-8 shadow-xl">
          <p className="text-slate-500 line-through">₹25,000</p>
          <p className="text-5xl font-extrabold text-ink">₹16,000</p>
          <p className="mt-1 text-sm text-slate-500">Limited time · only 15 spots a month</p>
          <ul className="mt-6 space-y-2 text-sm">
            {["8 weeks of 1:1 mentoring", "Full-stack app development", "Product Hunt launch", "Pitch deck creation", "Marketing strategy", "Ongoing support"].map((i) => (
              <li key={i} className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700" />{i}</li>
            ))}
          </ul>
          <Link href="#contact" className="mt-8 flex items-center justify-center gap-2 rounded-full bg-brand py-3 text-center font-semibold text-white hover:bg-brand-dark">
            Enroll now<ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
      </Section>

      <Section id="faq" tint eyebrow="FAQ" icon={CircleHelp} title="Questions parents ask">
        <div className="max-w-3xl space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-xl bg-white p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}<Plus aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-dark transition group-open:rotate-45 motion-reduce:transition-none" />
              </summary>
              <p className="mt-3 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section id="contact" className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">Ready to start your teen's success story?</h2>
          <p className="mt-3 text-white/90">Email tactyqal.labs@gmail.com or call +91-98047-72106 (Mon–Sat, 9am–7pm). We reply within 24 hours.</p>
          <a href="mailto:tactyqal.labs@gmail.com?subject=Free%20consultation" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold text-brand-dark hover:bg-slate-100">
            <Mail aria-hidden="true" className="h-5 w-5" />Book a free appointment
          </a>
        </div>
      </section>
    </>
  );
}
