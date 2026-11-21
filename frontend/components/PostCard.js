import Link from "next/link";
import { Calendar, Clock, User } from "lucide-react";
import { fmtDate } from "@/lib/api";

// Meta line is icon-first: the icon says what the value is; the sr-only text keeps it readable by assistive tech.
export default function PostCard({ post, as: Heading = "h3" }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex flex-wrap gap-2">
        {post.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark">{t}</span>
        ))}
      </div>
      <Heading className="mt-3 text-lg font-bold text-slate-900 group-hover:text-brand">{post.title}</Heading>
      <p className="mt-2 flex-1 text-sm text-slate-600">{post.excerpt}</p>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><Calendar aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Published </span>{fmtDate(post.published_at)}</span>
        <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{post.read_minutes} min<span className="sr-only"> read</span></span>
        <span className="inline-flex items-center gap-1.5"><User aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">By </span>{post.author}</span>
      </p>
    </Link>
  );
}
