import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getPosts, getTags } from "@/lib/api";

export const metadata = { title: "Blog — Tactyqal Labs" };

export default async function BlogIndex({ searchParams }) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const params = { page, limit: 6, ...(sp.q && { q: sp.q }), ...(sp.tag && { tag: sp.tag }) };
  const [{ data, meta, offline }, tags] = await Promise.all([getPosts(params), getTags()]);
  const link = (extra) => "/blog?" + new URLSearchParams({ ...(sp.q && { q: sp.q }), ...(sp.tag && { tag: sp.tag }), ...extra });

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-4xl font-extrabold text-ink">The Tactyqal Blog</h1>
      <p className="mt-2 text-slate-600">Practical advice for young founders.</p>
      <form className="mt-8 flex gap-2" action="/blog">
        <input name="q" defaultValue={sp.q || ""} placeholder="Search articles…" className="w-full max-w-md rounded-full border border-slate-300 px-5 py-2.5 outline-none focus:border-brand" />
        {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
        <button className="rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-dark">Search</button>
      </form>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/blog" className={`rounded-full px-3 py-1 text-sm ${!sp.tag ? "bg-brand text-white" : "bg-slate-100"}`}>All</Link>
        {tags.map((t) => (
          <Link key={t.name} href={link({ tag: t.name })} className={`rounded-full px-3 py-1 text-sm ${sp.tag === t.name ? "bg-brand text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
            {t.name} <span className="opacity-60">{t.count}</span>
          </Link>
        ))}
      </div>
      {offline && <p className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Blog API unreachable. Start it with <code>npm start</code> in /backend.</p>}
      {!offline && !data.length && <p className="mt-10 text-slate-500">No articles found.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.map((p) => <PostCard key={p.id} post={p} />)}</div>
      {meta.pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link className="font-semibold text-brand" href={link({ page: page - 1 })}>← Newer</Link>}
          <span className="text-slate-500">Page {page} of {meta.pages}</span>
          {page < meta.pages && <Link className="font-semibold text-brand" href={link({ page: page + 1 })}>Older →</Link>}
        </div>
      )}
    </div>
  );
}
