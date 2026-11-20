"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Friendly "the blog is waking up" state. Re-requests the page every few seconds (the free-tier API usually answers
// within a minute), then falls back to a manual retry button.
const MAX_AUTO_RETRIES = 6;
const RETRY_EVERY_MS = 9000;

export default function ApiRetry({ title = "Our articles are on their way", compact = false }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const giveUp = attempt >= MAX_AUTO_RETRIES;

  useEffect(() => {
    if (giveUp) return undefined;
    const t = setTimeout(() => { setAttempt((a) => a + 1); router.refresh(); }, RETRY_EVERY_MS);
    return () => clearTimeout(t);
  }, [attempt, giveUp, router]);

  return (
    <div role="status" aria-live="polite" className={`rounded-2xl border border-slate-200 bg-white text-center shadow-sm ${compact ? "p-6" : "p-10"}`}>
      <span aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-2xl">{giveUp ? "☕" : "⏳"}</span>
      <p className="text-lg font-bold text-slate-900">{giveUp ? "We couldn't load the articles just now" : title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {giveUp
          ? "Our blog service may be taking a short break. Please try again in a minute."
          : "The blog is waking up, which usually takes less than a minute. We'll keep trying automatically."}
      </p>
      <button
        type="button"
        onClick={() => { setAttempt(0); router.refresh(); }}
        className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Try again
      </button>
    </div>
  );
}
