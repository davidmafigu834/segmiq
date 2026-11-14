"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Monitor, RefreshCw, Smartphone, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import { FunnelFrame } from "@/components/real-estate/funnels/FunnelFrame";
import { FUNNEL_STATUS } from "@/components/agency/funnels/FunnelAdminList";

type Status = "building" | "review" | "live" | "paused";

type Props = {
  funnel: {
    id: string;
    status: Status;
    html: string | null;
    htmlVersion: number;
    shareTitle: string | null;
    shareSummary: string | null;
    shareImageUrl: string | null;
    priceLabel: string | null;
    brief: string | null;
    publishedAt: string | null;
  };
  clientName: string;
  listing: { id: string; heading: string; suburb: string | null; slug: string | null; status: string | null; approved: boolean };
  handles: string[];
  publicBase: string;
};

const fieldClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40";

const PLACEHOLDERS: Array<[string, string]> = [
  ["{{agent.name}}", "Agent's full name, or the agency name"],
  ["{{agent.first}}", "First name, or \"our team\""],
  ["{{agent.initials}}", "Initials for an avatar"],
  ["{{agent.role}}", "Property Sales Negotiator"],
  ["{{agent.line}}", "The agent's personal line"],
  ["{{agent.photo_url}}", "Photo URL, may be empty"],
  ["{{contact.phone}}", "WhatsApp digits: agent, else agency"],
  ["{{contact.phone_display}}", "+263 77 123 4567"],
  ["{{agency.name}}", "Public agency name"],
  ["{{property.url}}", "Canonical property address"],
  ["{{property.price}}", "Display price set here"],
];

type Asset = { url: string; name: string };

export function FunnelEditor({ funnel, clientName, listing, handles, publicBase }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const assetInput = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(funnel.html ?? "");
  const [shareTitle, setShareTitle] = useState(funnel.shareTitle ?? "");
  const [shareSummary, setShareSummary] = useState(funnel.shareSummary ?? "");
  const [shareImageUrl, setShareImageUrl] = useState(funnel.shareImageUrl ?? "");
  const [priceLabel, setPriceLabel] = useState(funnel.priceLabel ?? "");
  const [brief, setBrief] = useState(funnel.brief ?? "");
  const [status, setStatus] = useState<Status>(funnel.status);
  const [version, setVersion] = useState(funnel.htmlVersion);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [asHandle, setAsHandle] = useState(handles[0] ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const dirty =
    html !== (funnel.html ?? "") ||
    shareTitle !== (funnel.shareTitle ?? "") ||
    shareSummary !== (funnel.shareSummary ?? "") ||
    shareImageUrl !== (funnel.shareImageUrl ?? "") ||
    priceLabel !== (funnel.priceLabel ?? "") ||
    brief !== (funnel.brief ?? "");

  async function save(nextStatus?: Status) {
    setSaving(nextStatus ?? "save");
    setMessage(null);
    const response = await fetch(`/api/admin/funnels/${funnel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, shareTitle, shareSummary, shareImageUrl, priceLabel, brief, ...(nextStatus ? { status: nextStatus } : {}) }),
    });
    const body = (await response.json().catch(() => ({}))) as { funnel?: { status: Status; htmlVersion: number }; error?: string };
    setSaving(null);
    if (!response.ok || !body.funnel) {
      setMessage({ tone: "error", text: body.error ?? "Could not save." });
      return;
    }
    setStatus(body.funnel.status);
    setVersion(body.funnel.htmlVersion);
    setRefresh((n) => n + 1);
    setMessage({ tone: "ok", text: nextStatus === "live" ? "Published. Agents can share it now." : nextStatus ? `Status set to ${FUNNEL_STATUS[nextStatus].label.toLowerCase()}.` : "Saved." });
    router.refresh();
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setHtml(await file.text());
    setMessage({ tone: "ok", text: `Loaded ${file.name}. Save to update the preview.` });
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/admin/funnels/${funnel.id}/assets`, { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { url?: string; name?: string; error?: string };
      if (!response.ok || !body.url) {
        setMessage({ tone: "error", text: `${file.name}: ${body.error ?? "upload failed"}` });
        continue;
      }
      setAssets((list) => [{ url: body.url!, name: body.name ?? file.name }, ...list]);
    }
    setUploading(false);
  }

  const previewParams = new URLSearchParams({ slug: listing.slug ?? "", preview: funnel.id, v: `${version}.${refresh}` });
  if (asHandle) previewParams.set("as", asHandle);
  const publicUrl = listing.slug ? `${publicBase}/property/${listing.slug}` : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/funnels" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
          <ArrowLeft size={14} aria-hidden />
          Funnels
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-[var(--text-tertiary)]">{clientName}</p>
          <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold text-[var(--text-primary)]">
            {listing.heading}
            <PlatformStatusBadge kind={FUNNEL_STATUS[status].kind} label={FUNNEL_STATUS[status].label} />
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!dirty || saving != null} onClick={() => void save()}>{saving === "save" ? "Saving…" : "Save"}</Button>
          {status !== "review" && status !== "live" ? <Button variant="secondary" disabled={saving != null || !html.trim()} onClick={() => void save("review")}>Send for review</Button> : null}
          {status === "live" ? (
            <Button variant="secondary" disabled={saving != null} onClick={() => void save("paused")}>Pause</Button>
          ) : (
            <Button disabled={saving != null || !html.trim() || !listing.approved} onClick={() => void save("live")}>{saving === "live" ? "Publishing…" : "Publish"}</Button>
          )}
        </div>
      </div>

      {!listing.approved || (listing.status && listing.status !== "available") ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] text-[var(--text-primary)]">
          {!listing.approved ? "This listing is not approved in the client's CRM, so it cannot be published." : `The listing is marked ${listing.status?.replace(/_/g, " ")}. The page shows, but new enquiries are refused.`}
        </p>
      ) : null}
      {message ? <p className={`text-[13px] ${message.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]"}`} role="status">{message.text}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Page HTML</h3>
              <div className="flex gap-2">
                <input ref={fileInput} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(event) => void loadFile(event)} />
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload size={14} aria-hidden />
                  Load .html file
                </Button>
              </div>
            </div>
            <textarea
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              spellCheck={false}
              rows={18}
              placeholder="<!doctype html>…"
              className={`${fieldClass} mt-3 py-2 font-mono text-[12px] leading-5`}
            />
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              {(new Blob([html]).size / 1024).toFixed(0)} KB of 2 MB · version {version}. Use absolute image URLs (upload below). The page runs sandboxed: no cookies, no direct API calls.
            </p>
          </section>

          <section className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Images and files</h3>
              <input ref={assetInput} type="file" multiple accept="image/*,video/mp4,application/pdf" className="hidden" onChange={(event) => void uploadAsset(event)} />
              <Button variant="secondary" size="sm" disabled={uploading} onClick={() => assetInput.current?.click()}>
                <Upload size={14} aria-hidden />
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {assets.length ? (
              <ul className="mt-3 space-y-2">
                {assets.map((asset) => (
                  <li key={asset.url} className="flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{asset.name}</span>
                    <button type="button" className="shrink-0 font-medium text-[var(--accent)] hover:underline" onClick={() => void navigator.clipboard.writeText(asset.url)}>Copy URL</button>
                    <button type="button" className="shrink-0 font-medium text-[var(--accent)] hover:underline" onClick={() => setShareImageUrl(asset.url)}>Use as share image</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Uploads go to public storage. Copy the URL into the HTML.</p>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Link preview and agent screens</h3>
            <label className="block text-[12px] text-[var(--text-tertiary)]">
              Share title
              <input className={`${fieldClass} mt-1.5 h-10`} value={shareTitle} maxLength={120} onChange={(event) => setShareTitle(event.target.value)} placeholder="Charter House | US$2,600,000 | Bulawayo CBD" />
            </label>
            <label className="block text-[12px] text-[var(--text-tertiary)]">
              Share summary
              <textarea className={`${fieldClass} mt-1.5 py-2`} rows={2} value={shareSummary} maxLength={300} onChange={(event) => setShareSummary(event.target.value)} placeholder="One sentence WhatsApp shows under the title." />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="block text-[12px] text-[var(--text-tertiary)]">
                Share image URL
                <input className={`${fieldClass} mt-1.5 h-10`} value={shareImageUrl} onChange={(event) => setShareImageUrl(event.target.value)} placeholder="https://…/photo.jpg" />
              </label>
              <label className="block text-[12px] text-[var(--text-tertiary)]">
                Display price
                <input className={`${fieldClass} mt-1.5 h-10`} value={priceLabel} maxLength={40} onChange={(event) => setPriceLabel(event.target.value)} placeholder="US$2,600,000" />
              </label>
            </div>
            <label className="block text-[12px] text-[var(--text-tertiary)]">
              Internal brief and notes
              <textarea className={`${fieldClass} mt-1.5 py-2`} rows={3} value={brief} maxLength={4000} onChange={(event) => setBrief(event.target.value)} placeholder="Client brief, facts to confirm, approvals." />
            </label>
          </section>

          <details className="rounded-lg border border-[var(--border)] p-4">
            <summary className="cursor-pointer text-[14px] font-semibold text-[var(--text-primary)]">How a page talks to SegmiQ</summary>
            <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              <p>Placeholders in the markup are filled per agent before the page loads. Values are HTML-escaped.</p>
              <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1">
                {PLACEHOLDERS.map(([key, hint]) => (
                  <div key={key} className="contents">
                    <dt className="font-mono text-[var(--text-primary)]">{key}</dt>
                    <dd>{hint}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Scripts read the same data from <code className="font-mono text-[var(--text-primary)]">window.SegmiQ</code>: <code className="font-mono">agent</code>, <code className="font-mono">contact</code>, <code className="font-mono">agency</code>, <code className="font-mono">property</code>, <code className="font-mono">whatsappLink(text)</code>.
              </p>
              <p>
                Enquiries use the same API as the standard property page: <code className="font-mono text-[var(--text-primary)]">await SegmiQ.submit({"{"} name, phone, message, contactMethod {"}"})</code>. Optional <code className="font-mono">contactMethod</code> is <code className="font-mono">phone</code>, <code className="font-mono">whatsapp</code> or <code className="font-mono">either</code>. The spam trap is a hidden <code className="font-mono">companyWebsiteConfirm</code> field (or <code className="font-mono">website</code>).
              </p>
              <p>
                Viewings use the same journey form as the standard page: <code className="font-mono text-[var(--text-primary)]">await SegmiQ.openViewing()</code>. Needs an assigned listing agent or an agent link. Returns <code className="font-mono">{"{"} ok, error {"}"}</code>; on success the parent navigates to <code className="font-mono">/journey/…</code>.
              </p>
              <p>WhatsApp taps on wa.me links and engaged reading are recorded automatically.</p>
            </div>
          </details>
        </div>

        <section className="min-w-0 rounded-lg border border-[var(--border)] xl:sticky xl:top-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">Preview</span>
            <select className={`${fieldClass} h-8 w-auto`} value={asHandle} onChange={(event) => setAsHandle(event.target.value)} aria-label="Preview as agent">
              <option value="">As the agency (no agent)</option>
              {handles.map((handle) => (
                <option key={handle} value={handle}>As {handle}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" aria-label="Desktop" onClick={() => setDevice("desktop")}><Monitor size={14} /></Button>
              <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" aria-label="Mobile" onClick={() => setDevice("mobile")}><Smartphone size={14} /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Reload preview" onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={14} /></Button>
              {publicUrl && status === "live" ? (
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--bg-tertiary)]" aria-label="Open public page"><ExternalLink size={14} /></a>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center bg-[var(--bg-tertiary)] p-3">
            <div className={`overflow-hidden rounded-md border border-[var(--border)] bg-white ${device === "mobile" ? "h-[760px] w-[390px]" : "h-[760px] w-full"}`}>
              {listing.slug && funnel.html ? (
                <FunnelFrame key={previewParams.toString()} slug={listing.slug} token={null} title="Funnel preview" src={`/api/public/funnels/document?${previewParams.toString()}`} preview />
              ) : (
                <p className="p-6 text-[13px] text-[var(--text-secondary)]">Save the page HTML to see a preview.</p>
              )}
            </div>
          </div>
          <p className="px-3 py-2 text-[12px] text-[var(--text-tertiary)]">Shows the last saved version. Forms in the preview do not create leads.</p>
        </section>
      </div>
    </div>
  );
}
