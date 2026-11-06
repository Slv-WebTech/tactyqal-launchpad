import Link from "next/link";
import { fmtDate } from "@/lib/api";

export default function PostCard({ post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex flex-wrap gap-2">
        {post.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{t}</span>
        ))}
      </div>
      <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-brand">{post.title}</h3>
      <p className="mt-2 flex-1 text-sm text-slate-600">{post.excerpt}</p>
      <p className="mt-4 text-xs text-slate-500">{fmtDate(post.published_at)} · {post.read_minutes} min read · {post.author}</p>
    </Link>
  );
}
