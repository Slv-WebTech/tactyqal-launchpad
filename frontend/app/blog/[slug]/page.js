import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, fmtDate } from "@/lib/api";
import ApiRetry from "@/components/ApiRetry";
import { renderMarkdown } from "@/lib/markdown";

export async function generateMetadata({ params }) {
  const { post, offline } = await getPost((await params).slug);
  if (offline) return { title: "Loading article" };
  if (!post || post.status !== "published") return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt || undefined, publishedTime: post.published_at || undefined, authors: [post.author], tags: post.tags },
  };
}

export default async function PostPage({ params }) {
  const { post, offline } = await getPost((await params).slug);
  if (offline) {
    // API asleep or unreachable: show a retry state, never a misleading "not found"
    return (
      <div className="mx-auto max-w-3xl px-5 py-14">
        <Link href="/blog" className="text-sm font-semibold text-brand-dark">← All articles</Link>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">Loading your article</h1>
        <div className="mt-8"><ApiRetry title="Fetching the article" /></div>
      </div>
    );
  }
  if (!post || post.status !== "published") notFound();
  return (
    <article className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/blog" className="text-sm font-semibold text-brand-dark">← All articles</Link>
      <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink">{post.title}</h1>
      <p className="mt-3 text-sm text-slate-500">{post.author} · {fmtDate(post.published_at)} · {post.read_minutes} min read</p>
      <div className="mt-2 flex gap-2">{post.tags.map((t) => <span key={t} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand-dark">{t}</span>)}</div>
      <div className="prose-post mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
    </article>
  );
}
