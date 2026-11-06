import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, fmtDate } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";

export async function generateMetadata({ params }) {
  const post = await getPost((await params).slug);
  return { title: post ? `${post.title} — Tactyqal Labs` : "Post not found" };
}

export default async function PostPage({ params }) {
  const post = await getPost((await params).slug);
  if (!post || post.status !== "published") notFound();
  return (
    <article className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/blog" className="text-sm font-semibold text-brand">← All articles</Link>
      <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink">{post.title}</h1>
      <p className="mt-3 text-sm text-slate-500">{post.author} · {fmtDate(post.published_at)} · {post.read_minutes} min read</p>
      <div className="mt-2 flex gap-2">{post.tags.map((t) => <span key={t} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand">{t}</span>)}</div>
      <div className="prose-post mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
    </article>
  );
}
