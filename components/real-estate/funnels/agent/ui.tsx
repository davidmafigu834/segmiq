"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export const btn = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover disabled:opacity-60";
export const lime = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text transition-opacity hover:opacity-90 disabled:opacity-60";
export const bigLime = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-opacity hover:opacity-90 disabled:opacity-60";
export const bigBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover";
export const card = "rounded-[12px] border border-sales-border bg-sales-surface";

export type FunnelStatusName = "building" | "review" | "live" | "paused" | null;

export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "A";
}

export function Avatar({ initials, you = false, size = "md" }: { initials: string; you?: boolean; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14 text-[18px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-[13px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${box} ${you ? "bg-sales-text-primary text-sales-brand" : "bg-sales-surface-active text-sales-text-secondary"}`} aria-hidden>
      {initials}
    </span>
  );
}

export function StatusChip({ status }: { status: FunnelStatusName }) {
  if (!status) return <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-sales-border px-2 text-[12px] font-medium text-sales-text-muted">Standard page</span>;
  const tone = status === "live" ? "bg-sales-success-soft text-sales-success-fg" : status === "paused" ? "bg-sales-warning-soft text-sales-warning-fg" : "bg-sales-info-soft text-sales-info-fg";
  const label = status === "live" ? "Live" : status === "paused" ? "Paused" : status === "review" ? "In review" : "Being built";
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] font-semibold ${tone}`}>{label}</span>;
}

export function PropertyThumb({ src, className = "" }: { src: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`shrink-0 object-cover ${className}`} />;
  }
  return <span className={`shrink-0 bg-sales-surface-active ${className}`} aria-hidden />;
}

export function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      window.prompt("Copy this", text);
    }
  }
  return { copied, copy };
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** Shows the handle segment highlighted inside a funnel URL. */
export function LinkText({ url, handle }: { url: string; handle: string }) {
  const shown = displayUrl(url);
  const marker = `/${handle}`;
  const at = shown.lastIndexOf(marker);
  if (at < 0) return <span className="font-mono">{shown}</span>;
  return (
    <span className="break-all font-mono">
      {shown.slice(0, at + 1)}
      <mark className="rounded-[3px] bg-sales-brand px-0.5 text-sales-brand-text">{handle}</mark>
      {shown.slice(at + marker.length)}
    </span>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end max-sm:items-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-full w-full max-w-[460px] flex-col bg-sales-surface text-sales-text-primary shadow-2xl max-sm:h-auto max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:rounded-t-[16px]">
        <header className="flex items-center justify-between gap-3 border-b border-sales-border-subtle px-5 py-4">
          <h2 id={titleId} className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sales-border bg-sales-surface transition-colors hover:bg-sales-surface-hover">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </section>
    </div>
  );
}

/** Creates the agent's main link on first share and returns the property's public slug. */
export async function ensureLink(listingId: string): Promise<{ slug: string } | { error: string }> {
  try {
    const response = await fetch(`/api/sales/funnels/${listingId}/link`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { slug?: string; error?: string };
    if (response.ok && body.slug) return { slug: body.slug };
    return { error: body.error ?? "This property cannot be shared right now." };
  } catch {
    return { error: "No connection. Try again." };
  }
}

export function funnelUrl(baseUrl: string, slug: string, handle: string, channel?: string | null): string {
  return `${baseUrl.replace(/\/$/, "")}/property/${slug}/${handle}${channel ? `/${channel}` : ""}`;
}
