// Server-side fetches use API_URL (internal); the browser uses NEXT_PUBLIC_API_URL.
export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function getPosts(params = {}) {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API}/posts?${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { data: [], meta: { page: 1, pages: 0, total: 0 }, offline: true };
  }
}

export async function getPost(slug) {
  try {
    const res = await fetch(`${API}/posts/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).data;
  } catch {
    return null;
  }
}

export async function getTags() {
  try {
    const res = await fetch(`${API}/tags`, { cache: "no-store" });
    return res.ok ? (await res.json()).data : [];
  } catch {
    return [];
  }
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "Draft";
