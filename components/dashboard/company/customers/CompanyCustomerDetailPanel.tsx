"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { BriefcaseBusiness, CalendarDays, ExternalLink, Mail, MapPin, MoreHorizontal, Phone, ReceiptText, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge, Button, IconButton, Skeleton } from "@/components/sales/ui";
import type { CompanyCustomerActivity, CompanyCustomerDetail, CompanyCustomerRow } from "./types";

function Section({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-sales-border-subtle px-4 py-3.5 sm:px-5", className)} {...props} />;
}

function ActionTile({ label, disabled, href, onClick, children }: { label: string; disabled?: boolean; href?: string | null; onClick?: () => void; children: ReactNode }) {
  const classes = cn("flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] border border-sales-border bg-[#151815]/[0.02] px-1 py-2 text-[11px] font-medium text-sales-text-secondary transition-colors dark:bg-[#151815]", disabled ? "cursor-not-allowed opacity-40" : "hover:border-sales-border-strong hover:bg-sales-surface-hover hover:text-sales-text-primary");
  return href && !disabled ? <a href={href} className={classes}>{children}{label}</a> : <button type="button" className={classes} disabled={disabled} onClick={onClick}>{children}{label}</button>;
}

function MoreMenu({ detail, onViewDetails, onViewDeals }: { detail: CompanyCustomerDetail | null; onViewDetails: () => void; onViewDeals: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return <div className="relative flex-1" ref={ref}><button type="button" aria-haspopup="menu" aria-expanded={open} className="flex min-h-[48px] w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-sales-border bg-[#151815]/[0.02] px-1 py-2 text-[11px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover dark:bg-[#151815]" onClick={() => setOpen((value) => !value)}><MoreHorizontal size={16} />More</button>{open ? <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"><button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover" onClick={() => { setOpen(false); onViewDetails(); }}><ExternalLink size={14} />View full details</button><button type="button" role="menuitem" disabled={!detail} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover disabled:opacity-40" onClick={() => { setOpen(false); onViewDeals(); }}><BriefcaseBusiness size={14} />View Deals ({detail?.totalDeals ?? 0})</button></div> : null}</div>;
}

function ActivityIcon({ activity }: { activity: CompanyCustomerActivity }) {
  const classes = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-sales-text-secondary";
  if (activity.kind === "whatsapp") return <span className={classes}><SiWhatsapp size={15} color="#25D366" /></span>;
  if (activity.kind === "call") return <span className={classes}><Phone size={15} /></span>;
  if (activity.kind === "quote") return <span className={classes}><ReceiptText size={15} /></span>;
  if (activity.kind === "deal") return <span className={classes}><BriefcaseBusiness size={15} /></span>;
  return <span className={classes}><CalendarDays size={15} /></span>;
}

function Value({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return <div className="min-w-0"><p className="text-[11px] text-sales-text-muted">{label}</p><div className={cn("mt-1 break-words text-[12px] text-sales-text-primary", strong && "font-semibold tabular-nums")}>{value}</div></div>;
}

export function CompanyCustomerDetailPanel({ row, detail, loading, error, onRetry, onClose, onCall, onWhatsApp, onViewDetails, onViewDeals, overlay, stacked }: { row: CompanyCustomerRow | null; detail: CompanyCustomerDetail | null; loading: boolean; error: string | null; onRetry: () => void; onClose: () => void; onCall: () => void; onWhatsApp: () => void; onViewDetails: () => void; onViewDeals: () => void; overlay?: boolean; stacked?: boolean }) {
  const data = detail;
  const name = data?.name ?? row?.name ?? "Customer";
  const type = data?.customerType ?? row?.customerType ?? "unclassified";
  const typeLabel = data?.customerTypeLabel ?? row?.customerTypeLabel ?? "Not set";
  const body = <aside className={cn("flex h-full min-h-[660px] flex-col overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card", overlay && "fixed inset-y-0 right-0 z-40 w-full max-w-[410px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r", stacked && overlay && "inset-0 max-w-none rounded-none")}>
    <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5"><div className="flex min-w-0 items-start gap-3"><Avatar name={name} size="xl" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary">{name}</h2><Badge tone={type === "company" ? "success" : type === "individual" ? "info" : "neutral"} appearance="soft" className="!px-2 !py-0.5 !text-[10px]">{typeLabel}</Badge></div>{data?.industry || row?.industry ? <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{data?.industry ?? row?.industry}</p> : null}{data?.location || row?.location ? <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-sales-text-muted"><MapPin size={12} />{data?.location ?? row?.location}</p> : null}</div></div><IconButton aria-label="Close Customer details" onClick={onClose}><X size={16} /></IconButton></div>
    {error && !loading ? <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center"><p className="text-[13px] text-sales-text-secondary">We couldn&apos;t load this Customer.</p><Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button></div> : loading && !data ? <div className="space-y-4 px-5 pb-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div> : <><div className="min-h-0 flex-1 overflow-y-auto"><div className="flex gap-2 px-4 pb-4 sm:px-5"><ActionTile label="Call" disabled={!data?.canCall} href={data?.telHref} onClick={onCall}><Phone size={16} /></ActionTile><ActionTile label="WhatsApp" disabled={!data?.canWhatsApp} onClick={onWhatsApp}><SiWhatsapp size={16} color="#25D366" /></ActionTile><ActionTile label="Email" disabled={!data?.canEmail} href={data?.mailtoHref}><Mail size={16} /></ActionTile><MoreMenu detail={data} onViewDetails={onViewDetails} onViewDeals={onViewDeals} /></div>
      <Section><h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Customer Overview</h3><div className="grid grid-cols-2 gap-x-4 gap-y-3"><Value label="Customer since" value={data?.customerSinceLabel ?? row?.customerSinceLabel ?? "—"} /><Value label="Customer type" value={typeLabel} /><Value label="Primary contact" value={data?.primaryContactName ?? row?.primaryContactName ?? (type === "individual" ? name : "Not assigned")} /><Value label="Email" value={data?.email ?? row?.email ?? "Not recorded"} /></div></Section>
      <Section><div className="grid grid-cols-2 gap-x-4 gap-y-3"><Value label="Total Deals" value={data?.totalDeals ?? row?.totalDeals ?? 0} strong /><Value label="Active Pipeline Value" value={(data?.activePipelineUnknownCount ?? row?.activePipelineUnknownCount ?? 0) > 0 && (data?.activePipelineKnown ?? row?.activePipelineKnown ?? 0) === 0 ? "Not estimated" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data?.activePipelineKnown ?? row?.activePipelineKnown ?? 0)} strong /><Value label="Won Deals" value={data?.wonDeals ?? row?.wonDeals ?? 0} strong /><Value label="Won Value" value={data?.customerValueLabel ?? row?.customerValueLabel ?? "—"} strong /></div>{(data?.activePipelineUnknownCount ?? row?.activePipelineUnknownCount ?? 0) > 0 ? <p className="mt-3 text-[11px] text-sales-text-muted">{data?.activePipelineUnknownCount ?? row?.activePipelineUnknownCount} active Deal{(data?.activePipelineUnknownCount ?? row?.activePipelineUnknownCount) === 1 ? "" : "s"} awaiting an estimate.</p> : null}</Section>
      <Section><h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Recent Activity</h3>{data?.recentActivity?.length ? <div className="space-y-3">{data.recentActivity.map((activity) => <div key={activity.id} className="flex gap-2.5"><ActivityIcon activity={activity} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-[12px] font-medium text-sales-text-primary">{activity.title}</p><span className="shrink-0 text-[10px] text-sales-text-muted">{activity.timeLabel}</span></div>{activity.detail ? <p className="mt-0.5 line-clamp-2 text-[11px] text-sales-text-secondary">{activity.detail}</p> : null}</div></div>)}</div> : <p className="text-[12px] text-sales-text-muted">No meaningful interactions recorded yet.</p>}<button type="button" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-sales-info-fg hover:underline" onClick={onViewDetails}>View all activities <span aria-hidden>→</span></button></Section>
    </div><div className="flex gap-2 border-t border-sales-border-subtle p-4"><Button variant="secondary" size="md" className="flex-1" onClick={onViewDetails}>View full details</Button><Button variant="primary" size="md" className="flex-1" onClick={onViewDeals}>View Deals ({data?.totalDeals ?? row?.totalDeals ?? 0})</Button></div></>}
  </aside>;
  return <>{overlay ? <button type="button" aria-label="Close Customer details" className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px]" onClick={onClose} /> : null}{body}</>;
}
