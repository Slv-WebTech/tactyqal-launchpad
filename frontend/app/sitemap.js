import { SITE_URL } from "./layout";
import { getPosts } from "@/lib/api";

export const dynamic = "force-dynamic"; // posts come from the live API

export default async function sitemap() {
  const { data } = await getPosts({ limit: 50 }); // API down => empty list: static pages still listed
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...data.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly", priority: 0.6 })),
  ];
}
