"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Save, X, Pencil, Trash2, LoaderCircle, CircleCheck, FilePen, KeyRound, Type, AlignLeft, FileText, User, Tags, Eye } from "lucide-react";
import IconAction, { Tip } from "@/components/IconAction";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const EMPTY = { title: "", excerpt: "", content: "", author: "Tactyqal", tags: "", status: "draft" };

// An input with a leading icon (icon-first). The aria-label on the control stays the accessible name; the placeholder is a hint.
function Field({ icon, top = false, children }) {
  return (
    <div className="relative [&>*:last-child]:pl-10">
      <span aria-hidden="true" className={`pointer-events-none absolute left-3 z-10 text-slate-500 ${top ? "top-3" : "top-1/2 -translate-y-1/2"} [&>svg]:h-5 [&>svg]:w-5`}>{icon}</span>
      {children}
    </div>
  );
}

export default function Admin() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(null);
  const [loadingId, setLoadingId] = useState(null); // post being fetched into the form: the form is locked meanwhile
  const [saving, setSaving] = useState(false);
  const loadToken = useRef(0); // identifies the latest load so a late/cancelled response can never overwrite the form
  const locked = loadingId !== null || saving;

  const headers = { "content-type": "application/json", ...(key && { "x-admin-key": key }) };
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/posts?status=all&limit=50`, { headers: key ? { "x-admin-key": key } : {} });
      const json = await r.json();
      setPosts(json.data || []);
    } catch {
      setMsg({ err: true, text: "We couldn't reach the blog service. It may be waking up: wait a minute and reload." });
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    if (locked) return; // ignore double submits while a load or save is in flight
    setSaving(true);
    try {
      const body = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      const r = await fetch(`${API}/posts${editing ? `/${editing}` : ""}`, { method: editing ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      const json = await r.json();
      if (!r.ok) return setMsg({ err: true, text: [json.error, ...(json.details || [])].join(": ") });
      setMsg({ text: editing ? "Post updated" : "Post created" });
      setForm(EMPTY); setEditing(null); load();
    } catch {
      setMsg({ err: true, text: "We couldn't reach the blog service. Your changes were not saved: please try again." });
    } finally {
      setSaving(false);
    }
  }
  async function remove(p) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const r = await fetch(`${API}/posts/${p.id}`, { method: "DELETE", headers });
    setMsg(r.ok ? { text: "Post deleted" } : { err: true, text: "Delete failed (admin key?)" });
    load();
  }
  const edit = async (p) => {
    const token = ++loadToken.current;
    setLoadingId(p.id);
    setEditing(p.id);
    setForm(EMPTY);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const r = await fetch(`${API}/posts/${p.id}`, { headers: key ? { "x-admin-key": key } : {} });
      if (token !== loadToken.current) return; // cancelled or superseded: discard the response
      if (!r.ok) { setEditing(null); return setMsg({ err: true, text: "Could not load post (admin key?)" }); }
      const { data } = await r.json();
      if (token !== loadToken.current) return;
      setForm({ title: data.title, excerpt: data.excerpt, content: data.content, author: data.author, tags: data.tags.join(", "), status: data.status });
    } catch {
      if (token === loadToken.current) { setEditing(null); setMsg({ err: true, text: "We couldn't reach the blog service. Please try again." }); }
    } finally {
      if (token === loadToken.current) setLoadingId(null);
    }
  };
  const cancelEdit = () => { loadToken.current++; setLoadingId(null); setEditing(null); setForm(EMPTY); };
  const field = "w-full rounded-lg border border-slate-400 px-3 py-2 outline-none focus:border-brand disabled:cursor-wait disabled:bg-slate-100 disabled:opacity-70";

  const submitLabel = loadingId !== null ? "Loading…" : saving ? "Saving…" : editing ? "Save changes" : "Create post";
  const submitIcon = locked ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : editing ? <Save /> : <Plus />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-extrabold text-ink">Blog admin</h1>
      <p className="mt-1 text-sm text-slate-500">Demo UI for the blog API. If the API sets ADMIN_KEY, enter it here.</p>
      <div className="mt-4 max-w-xs">
        <Field icon={<KeyRound />}>
          <input value={key} onChange={(e) => setKey(e.target.value)} type="password" aria-label="Admin key" placeholder="Admin key (optional)" className={field} />
        </Field>
      </div>
      {msg && <p className={`mt-4 rounded-lg p-3 text-sm ${msg.err ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.text}</p>}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <form onSubmit={save} className="min-w-0 space-y-3" aria-busy={locked}>
          <h2 className="text-xl font-bold">{editing ? "Edit post" : "New post"}</h2>
          {loadingId !== null && <p role="status" className="text-sm font-medium text-slate-600">Loading post…</p>}
          <fieldset disabled={locked} className="min-w-0 space-y-3 border-0 p-0">
            <Field icon={<Type />}>
              <input required className={field} aria-label="Title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field icon={<AlignLeft />}>
              <input className={field} aria-label="Excerpt" placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
            </Field>
            <Field icon={<FileText />} top>
              <textarea rows={10} className={field} aria-label="Content" placeholder="Content (## headings, - lists, **bold**)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <Field icon={<User />}>
                <input className={field} aria-label="Author" placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </Field>
              <Field icon={<Eye />}>
                <select aria-label="Status" className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </Field>
            </div>
            <Field icon={<Tags />}>
              <input className={field} aria-label="Tags, comma separated" placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>
          </fieldset>
          <div className="flex gap-2">
            <IconAction label={submitLabel} type="submit" icon={submitIcon} variant="solid" size="lg" disabled={locked} align="start" side="top" />
            {editing && <IconAction label="Cancel" onClick={cancelEdit} icon={<X />} variant="outline" size="lg" side="top" />}
          </div>
        </form>

        <div className="min-w-0">
          <h2 className="text-xl font-bold">All posts ({posts.length})</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Tip label={p.status === "published" ? "Published" : "Draft"} side="top" align="start">
                      <span className={p.status === "published" ? "text-brand-dark" : "text-amber-800"}>
                        {p.status === "published" ? <CircleCheck aria-hidden="true" className="h-4 w-4" /> : <FilePen aria-hidden="true" className="h-4 w-4" />}
                        <span className="sr-only">{p.status}</span>
                      </span>
                    </Tip>
                    <span className="truncate">/{p.slug}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconAction label="Edit" onClick={() => edit(p)} disabled={loadingId !== null} icon={<Pencil />} variant="ghost" size="sm" align="end" />
                  <IconAction label="Delete" onClick={() => remove(p)} icon={<Trash2 />} variant="danger" size="sm" align="end" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
