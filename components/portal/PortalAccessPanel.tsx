"use client";

import Link from "next/link";
import { useState } from "react";

export function PortalAccessPanel({ projectId, contactId }: { projectId: string; contactId: string | null }) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "invite" | "revoke") {
    setBusy(true);
    setNote("");
    const res = await fetch(`/api/work-projects/${projectId}/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, contactId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; link?: string; sent?: boolean };
    setBusy(false);
    if (!res.ok) {
      setNote(data.error || "Portal access could not be updated.");
      return;
    }
    if (action === "invite") {
      setLink(data.link || "");
      setNote(data.sent ? "Access link sent on WhatsApp. The customer still verifies with a code." : "Access link ready. Send it to the customer. Opening it still requires a code.");
    } else {
      setLink("");
      setNote("Portal access revoked. Existing sessions are signed out.");
    }
  }

  return (
    <section className="rounded-sales-md border border-sales-border p-3">
      <h2 className="text-[13px] font-semibold">Customer portal</h2>
      <p className="mt-1 text-[12px] text-sales-text-secondary">Send a secure link. The customer verifies by phone before anything opens. <Link href="/client/settings/portal" className="underline">Portal settings</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void act("invite")} className="min-h-11 rounded-sales-md bg-sales-text-primary px-3 text-[13px] font-medium text-white">
          Send portal access
        </button>
        <button type="button" disabled={busy} onClick={() => void act("revoke")} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
          Revoke access
        </button>
      </div>
      {link ? <p className="mt-2 break-all text-[12px]">{link}</p> : null}
      {note ? <p className="mt-2 text-[12px] text-sales-text-secondary">{note}</p> : null}
    </section>
  );
}

export function ShareDocumentButton({ projectId, documentId }: { projectId: string; documentId: string }) {
  const [note, setNote] = useState("");
  return (
    <button
      type="button"
      className="text-[11px] font-medium text-sales-brand-fg"
      onClick={async () => {
        const res = await fetch(`/api/work-projects/${projectId}/portal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "share", documentId, visible: true }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(res.ok ? "Visible in the customer portal" : data.error || "Could not share");
      }}
    >
      {note || "Show to customer"}
    </button>
  );
}
