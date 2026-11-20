// Server-side fetches. The hosted API can be asleep (free tier cold start ~50 s), so every call has a timeout shorter
// than the host's function limit and reports `offline` instead of throwing; pages then show a friendly retry state.
export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const TIMEOUT_MS = 8000;
const opts = () => ({ cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

export async function getPosts(params = {}) {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API}/posts?${qs}`, opts());
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { data: [], meta: { page: 1, pages: 0, total: 0 }, offline: true };
  }
}

// -> { post, offline }: `post` is null when the post does not exist (404); `offline` is true when the API could not be reached.
export async function getPost(slug) {
  try {
    const res = await fetch(`${API}/posts/${encodeURIComponent(slug)}`, opts());
    if (res.status === 404 || res.status === 400) return { post: null, offline: false };
    if (!res.ok) return { post: null, offline: true };
    return { post: (await res.json()).data, offline: false };
  } catch {
    return { post: null, offline: true };
  }
}

export async function getTags() {
  try {
    const res = await fetch(`${API}/tags`, opts());
    return res.ok ? (await res.json()).data : [];
  } catch {
    return [];
  }
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "Draft";
