import { Search, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import PostCard from "@/components/PostCard";
import ApiRetry from "@/components/ApiRetry";
import IconAction from "@/components/IconAction";
import Link from "next/link";
import { getPosts, getTags } from "@/lib/api";

export const metadata = {
  title: "Blog",
  description: "Practical advice for young founders: pitching, building a team, validating ideas and no-code app ideas.",
};

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
      <form className="mt-8 flex items-center gap-2" action="/blog" role="search">
        <div className="relative w-full max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input name="q" defaultValue={sp.q || ""} aria-label="Search articles" placeholder="Search articles…" className="w-full rounded-full border border-slate-400 py-2.5 pl-11 pr-5 outline-none focus:border-brand" />
        </div>
        {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
        <IconAction label="Search" type="submit" icon={<Search />} variant="solid" size="lg" />
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <IconAction label="All articles" href="/blog" icon={<LayoutGrid />} variant={!sp.tag ? "active" : "soft"} size="sm" />
        {tags.map((t) => (
          <Link key={t.name} href={link({ tag: t.name })} className={`rounded-full px-3 py-1 text-sm ${sp.tag === t.name ? "bg-brand text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
            {t.name} <span className="opacity-60">{t.count}</span>
          </Link>
        ))}
      </div>
      {offline && <div className="mt-8"><ApiRetry /></div>}
      {!offline && !data.length && <p className="mt-10 text-slate-500">No articles found.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.map((p) => <PostCard key={p.id} post={p} as="h2" />)}</div>
      {meta.pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <IconAction label="Newer articles" href={link({ page: page - 1 })} icon={<ChevronLeft />} variant="outline" side="top" />}
          <span className="text-slate-500">Page {page} of {meta.pages}</span>
          {page < meta.pages && <IconAction label="Older articles" href={link({ page: page + 1 })} icon={<ChevronRight />} variant="outline" side="top" />}
        </nav>
      )}
    </div>
  );
}
