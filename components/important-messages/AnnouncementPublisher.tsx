"use client";

import { useState } from "react";

type AnnouncementDraft = {
  title: string;
  summary: string;
  body: string;
  category: "whats_new" | "notice";
  audience: "all" | "industry" | "role" | "organisation";
  industry: string;
  roleTarget: "CLIENT_MANAGER" | "SALESPERSON" | "";
  clientId: string;
  href: string;
};

const emptyDraft: AnnouncementDraft = {
  title: "",
  summary: "",
  body: "",
  category: "whats_new",
  audience: "all",
  industry: "real_estate",
  roleTarget: "",
  clientId: "",
  href: "",
};

export function AnnouncementPublisher() {
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function save(action: "draft" | "publish" | "archive") {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/platform/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(savedId ? { id: savedId } : {}),
        ...draft,
        roleTarget: draft.roleTarget || null,
        industry: draft.industry || null,
        clientId: draft.clientId || null,
        href: draft.href || null,
        body: draft.body || null,
        action,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; status?: string; id?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setError(payload?.error ?? "Could not save the announcement.");
      return;
    }
    if (payload?.id) setSavedId(payload.id);
    setStatus(payload?.status ?? action);
  }

  return (
    <form
      className="mx-auto flex max-w-xl flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save("draft");
      }}
    >
      <label className="text-[13px] font-medium text-sales-text-primary">
        Title
        <input className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
      </label>
      <label className="text-[13px] font-medium text-sales-text-primary">
        Summary
        <textarea className="mt-1 min-h-20 w-full rounded-[8px] border border-sales-border-subtle px-3 py-2" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} required />
      </label>
      <label className="text-[13px] font-medium text-sales-text-primary">
        Details
        <textarea className="mt-1 min-h-24 w-full rounded-[8px] border border-sales-border-subtle px-3 py-2" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-medium text-sales-text-primary">
          Category
          <select className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as AnnouncementDraft["category"] })}>
            <option value="whats_new">What&apos;s New</option>
            <option value="notice">Important notice</option>
          </select>
        </label>
        <label className="text-[13px] font-medium text-sales-text-primary">
          Audience
          <select className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as AnnouncementDraft["audience"] })}>
            <option value="all">All eligible users</option>
            <option value="industry">One industry</option>
            <option value="role">One role</option>
            <option value="organisation">One organisation</option>
          </select>
        </label>
      </div>
      {draft.audience === "industry" ? (
        <label className="text-[13px] font-medium text-sales-text-primary">
          Industry
          <input className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value })} />
        </label>
      ) : null}
      {draft.audience === "role" ? (
        <label className="text-[13px] font-medium text-sales-text-primary">
          Role
          <select className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.roleTarget} onChange={(event) => setDraft({ ...draft, roleTarget: event.target.value as AnnouncementDraft["roleTarget"] })}>
            <option value="">Choose a role</option>
            <option value="CLIENT_MANAGER">Manager</option>
            <option value="SALESPERSON">Salesperson</option>
          </select>
        </label>
      ) : null}
      {draft.audience === "organisation" ? (
        <label className="text-[13px] font-medium text-sales-text-primary">
          Organisation id
          <input className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" value={draft.clientId} onChange={(event) => setDraft({ ...draft, clientId: event.target.value })} />
        </label>
      ) : null}
      <label className="text-[13px] font-medium text-sales-text-primary">
        SegmiQ destination
        <input className="mt-1 h-11 w-full rounded-[8px] border border-sales-border-subtle px-3" placeholder="/sales/listings" value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} />
      </label>
      {preview ? (
        <div className="rounded-[12px] border border-sales-border-subtle p-3">
          <p className="text-[14px] font-semibold text-sales-text-primary">{draft.title || "Untitled"}</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{draft.summary || "Summary preview"}</p>
          {draft.body ? <p className="mt-2 whitespace-pre-wrap text-[13px] text-sales-text-primary">{draft.body}</p> : null}
        </div>
      ) : null}
      {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
      {status ? <p className="text-[13px] text-sales-text-secondary">Saved as {status}.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="min-h-11 rounded-[8px] border border-sales-border-subtle px-3 text-[13px] font-medium">Save draft</button>
        <button type="button" className="min-h-11 rounded-[8px] border border-sales-border-subtle px-3 text-[13px] font-medium" onClick={() => setPreview((value) => !value)}>Preview</button>
        <button type="button" disabled={saving} className="min-h-11 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-medium text-sales-surface" onClick={() => void save("publish")}>Publish</button>
        <button type="button" disabled={saving || !savedId} className="min-h-11 rounded-[8px] px-3 text-[13px] font-medium text-sales-text-secondary" onClick={() => void save("archive")}>Archive</button>
      </div>
    </form>
  );
}
