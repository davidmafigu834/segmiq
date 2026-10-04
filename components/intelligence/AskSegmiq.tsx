"use client";

import { useState } from "react";

export function AskSegmiq({ projectId, portal }: { projectId?: string; portal?: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch(portal ? "/api/portal/ask" : "/api/intelligence/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, projectId: projectId || null }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; answer?: string; pendingActionId?: string | null };
    if (!res.ok) {
      setError(data.error || "SegmiQ could not answer just now.");
      return;
    }
    setAnswer(data.answer || "");
    setPending(data.pendingActionId || null);
  }

  async function decide(decision: "approve" | "cancel") {
    if (!pending) return;
    const res = await fetch("/api/intelligence/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: pending, decision }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setAnswer(res.ok ? data.message || "Done." : data.error || "That action did not complete.");
    setPending(null);
  }

  const shell = portal
    ? "rounded-3xl bg-white p-5"
    : "rounded-sales-md border border-sales-border p-3";

  return (
    <section className={shell}>
      <h2 className={portal ? "text-lg font-semibold" : "text-[13px] font-semibold"}>{portal ? "Ask about my project" : "Ask SegmiQ"}</h2>
      <form className="mt-3 space-y-2" onSubmit={ask}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} placeholder={portal ? "When is my installation?" : "Is this project ready for installation?"} className={portal ? "w-full rounded-2xl border border-[#e4ddd0] bg-[#fbf9f4] px-4 py-3 text-sm" : "w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]"} />
        <button type="submit" className={portal ? "min-h-11 rounded-full bg-[#0f6b4c] px-4 text-sm font-semibold text-white" : "min-h-11 rounded-sales-md bg-sales-text-primary px-3 text-[13px] font-medium text-white"}>Ask</button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-sales-danger-fg">{error}</p> : null}
      {answer ? <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6">{answer}</p> : null}
      {pending && !portal ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void decide("approve")} className="min-h-11 rounded-sales-md bg-sales-text-primary px-3 text-[13px] text-white">Approve</button>
          <button type="button" onClick={() => void decide("cancel")} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">Cancel</button>
        </div>
      ) : null}
    </section>
  );
}
