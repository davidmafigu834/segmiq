"use client";

import { useState } from "react";

export function AskSegmiq({ projectId, leadId, portal }: { projectId?: string; leadId?: string; portal?: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(portal ? "/api/portal/ask" : "/api/intelligence/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, projectId: projectId || null, leadId: leadId || null }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; answer?: string; citations?: string[]; pendingActionId?: string | null };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "SegmiQ could not answer just now.");
      return;
    }
    setAnswer(data.answer || "");
    setCitations(data.citations || []);
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

  const prompts = portal
    ? ["When is my installation?", "How much have I paid?", "Is my warranty active?"]
    : projectId
      ? ["Summarise this project", "What is blocking this project?", "Is it ready for installation?", "Prepare a customer update"]
      : ["What needs attention today?"];
  const shell = portal
    ? "border-t border-sales-border pt-6"
    : "rounded-sales-md border border-sales-border p-3";

  return (
    <section className={shell}>
      <h2 className={portal ? "text-lg font-semibold" : "text-[15px] font-semibold"}>{portal ? "Ask about my project" : leadId ? "Ask about this lead" : projectId ? "Ask about this project" : "Ask SegmiQ"}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="min-h-11 whitespace-nowrap rounded-full border border-sales-border px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-sales-text-primary">{prompt}</button>
        ))}
      </div>
      <form className="mt-3 space-y-2" onSubmit={ask}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} placeholder={portal ? "When is my installation?" : "Is this project ready for installation?"} className="w-full rounded-sales-md border border-sales-border bg-sales-surface px-3 py-2 text-[15px]" />
        <button type="submit" disabled={busy} className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary disabled:opacity-60">{busy ? "Checking records…" : "Ask"}</button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-sales-danger-fg">{error}</p> : null}
      {answer ? <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6">{answer}</p> : null}
      {citations.length ? <p className="mt-2 text-[12px] text-sales-text-secondary">Based on: {citations.join(" · ")}</p> : null}
      {pending && !portal ? (
        <div className="mt-4 border-t border-sales-border pt-3">
          <p className="text-[13px] font-medium text-sales-text-secondary">This will change the record only after you approve.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void decide("approve")} className="min-h-11 rounded-sales-md bg-segmiq-lime px-3 text-[14px] font-semibold text-sales-text-primary">Approve</button>
            <button type="button" onClick={() => void decide("cancel")} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[14px]">Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
