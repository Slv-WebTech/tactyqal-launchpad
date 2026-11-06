"use client";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const EMPTY = { title: "", excerpt: "", content: "", author: "Tactyqal", tags: "", status: "draft" };

export default function Admin() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(null);

  const headers = { "content-type": "application/json", ...(key && { "x-admin-key": key }) };
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/posts?status=all&limit=50`, { headers: key ? { "x-admin-key": key } : {} });
      const json = await r.json();
      setPosts(json.data || []);
    } catch {
      setMsg({ err: true, text: "Cannot reach the API. Is the backend running?" });
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    const body = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    const r = await fetch(`${API}/posts${editing ? `/${editing}` : ""}`, { method: editing ? "PUT" : "POST", headers, body: JSON.stringify(body) });
    const json = await r.json();
    if (!r.ok) return setMsg({ err: true, text: [json.error, ...(json.details || [])].join(": ") });
    setMsg({ text: editing ? "Post updated" : "Post created" });
    setForm(EMPTY); setEditing(null); load();
  }
  async function remove(p) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const r = await fetch(`${API}/posts/${p.id}`, { method: "DELETE", headers });
    setMsg(r.ok ? { text: "Post deleted" } : { err: true, text: "Delete failed (admin key?)" });
    load();
  }
  const edit = async (p) => {
    const r = await fetch(`${API}/posts/${p.id}`, { headers: key ? { "x-admin-key": key } : {} });
    if (!r.ok) return setMsg({ err: true, text: "Could not load post (admin key?)" });
    const { data } = await r.json();
    setEditing(p.id);
    setForm({ title: data.title, excerpt: data.excerpt, content: data.content, author: data.author, tags: data.tags.join(", "), status: data.status });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand";

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-extrabold text-ink">Blog admin</h1>
      <p className="mt-1 text-sm text-slate-500">Demo UI for the blog API. If the API sets ADMIN_KEY, enter it here.</p>
      <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="Admin key (optional)" className={`${field} mt-4 max-w-xs`} />
      {msg && <p className={`mt-4 rounded-lg p-3 text-sm ${msg.err ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.text}</p>}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <form onSubmit={save} className="min-w-0 space-y-3">
          <h2 className="text-xl font-bold">{editing ? "Edit post" : "New post"}</h2>
          <input required className={field} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={field} placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          <textarea rows={10} className={field} placeholder="Content (## headings, - lists, **bold**)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <input className={field} placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <input className={field} placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="flex gap-2">
            <button className="rounded-full bg-brand px-6 py-2 font-semibold text-white hover:bg-brand-dark">{editing ? "Save changes" : "Create post"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="rounded-full border px-6 py-2">Cancel</button>}
          </div>
        </form>

        <div className="min-w-0">
          <h2 className="text-xl font-bold">All posts ({posts.length})</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500"><span className={p.status === "published" ? "text-emerald-600" : "text-amber-600"}>{p.status}</span> · /{p.slug}</p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button onClick={() => edit(p)} className="text-brand hover:underline">Edit</button>
                  <button onClick={() => remove(p)} className="text-red-600 hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
