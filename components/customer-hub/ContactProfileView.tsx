"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Mail,
  MessageCircle,
  Phone,
  UserPlus,
} from "lucide-react";
import { HubTabs } from "@/components/client-contacts/HubTabs";
import { ContactTimeline } from "@/components/customer-hub/ContactTimeline";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { formatCurrencyUsd, formatTimeAgo } from "@/lib/format";
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import {
  CONTACT_LIFECYCLE_DESCRIPTIONS,
  CONTACT_LIFECYCLE_LABELS,
  lifecycleBadgeClass,
  type ContactLifecycle,
} from "@/lib/customer-hub/lifecycle";
import { formatContactSourceLabel } from "@/lib/customer-hub/source-labels";
import { ContactCommunicationPrefs } from "@/components/marketing/ContactCommunicationPrefs";
import { ManagerReassignLeadButton } from "@/components/customer-hub/ManagerReassignLeadButton";
import { ScheduleViewingPanel } from "@/components/real-estate/ScheduleViewingPanel";
import { isRealEstate } from "@/lib/terminology";

export type ContactProfileLead = {
  id: string;
  status: string;
  source: string | null;
  deal_value: number | null;
  project_type: string | null;
  follow_up_date: string | null;
  created_at: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export type ContactProfileData = {
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
    notes: string | null;
    lifecycle: ContactLifecycle;
    leadOrigin: string;
    createdAt: string;
    interestedListingIds?: string[];
    buyerBudgetMin?: number | null;
    buyerBudgetMax?: number | null;
    buyerBedroomsWanted?: number | null;
    buyerAreaPreference?: string | null;
    buyerTimeline?: string | null;
  };
  stats: {
    totalDeals: number;
    activeDeals: number;
    wonValue: number;
    callCount: number;
    lastActivityAt: string | null;
    lastHandlerName: string | null;
  };
  activeLead: ContactProfileLead | null;
  leads: ContactProfileLead[];
  clientId: string;
  clientName: string;
  clientDialCode: string;
  assignmentMode: "direct" | "pool" | "round_robin";
  businessType?: "trades" | "real_estate";
};

function initials(name: string | null) {
  return name
    ? name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
}

function humanStatus(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase().split(" ");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

function statusPillClass(status: string): string {
  if (status === "WON") return "bg-[rgba(61,214,140,0.12)] text-[var(--success)]";
  if (status === "LOST" || status === "NOT_QUALIFIED") return "bg-[rgba(255,68,68,0.12)] text-[var(--error)]";
  return "bg-[rgba(245,166,35,0.12)] text-[var(--warning)]";
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  action,
}: {
  icon: React.ElementType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  value: string;
  href?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{label}</p>
        {href ? (
          <a href={href} className="mt-0.5 block truncate text-[14px] text-[var(--text-primary)] hover:text-[var(--accent)]">
            {value}
          </a>
        ) : (
          <p className="mt-0.5 truncate text-[14px] text-[var(--text-primary)]">{value}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ContactProfileView({ data }: { data: ContactProfileData }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { contact, stats, activeLead, leads, clientId, clientName, clientDialCode, assignmentMode, businessType } = data;
  const stage = contact.lifecycle;
  const displayName = contact.name || "Unnamed contact";
  const waDigits = contact.phone ? normalizePhoneForWhatsApp(contact.phone, clientDialCode) : null;
  const whatsappUrl = waDigits ? buildWhatsAppUrl(waDigits, "") : null;
  const showRealEstate = isRealEstate(businessType);
  const addedDate = new Date(contact.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function copyPhone() {
    if (!contact.phone) return;
    try {
      await navigator.clipboard.writeText(contact.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <HubTabs />

      <Link
        href="/client/contacts"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        All contacts
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-tertiary)] text-lg font-semibold text-[var(--text-secondary)]">
            {initials(contact.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="truncate text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                {displayName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase ${lifecycleBadgeClass(stage)}`}
              >
                {CONTACT_LIFECYCLE_LABELS[stage]}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {CONTACT_LIFECYCLE_DESCRIPTIONS[stage]}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total deals", value: String(stats.totalDeals) },
          { label: "Active now", value: String(stats.activeDeals) },
          { label: "Calls logged", value: String(stats.callCount) },
          { label: "Won value", value: formatCurrencyUsd(stats.wonValue) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {stat.label}
            </p>
            <p
              className="mt-1 text-2xl text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Contact details</h2>
          <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">
            Company record — stays here even if staff change.
          </p>
          <div className="divide-y divide-[var(--border)]">
            <DetailRow
              icon={Phone}
              label="Phone"
              value={contact.phone || "No number on file"}
              href={contact.phone ? `tel:${contact.phone}` : undefined}
              action={
                contact.phone ? (
                  <button
                    type="button"
                    onClick={copyPhone}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                ) : undefined
              }
            />
            <DetailRow
              icon={Mail}
              label="Email"
              value={contact.email || "—"}
              href={contact.email ? `mailto:${contact.email}` : undefined}
            />
            <DetailRow
              icon={Briefcase}
              label="How they entered"
              value={formatContactSourceLabel(contact.source)}
            />
            <DetailRow icon={UserPlus} label="Added to hub" value={addedDate} />
            {stats.lastActivityAt ? (
              <DetailRow
                icon={MessageCircle}
                label="Last activity"
                value={`${formatTimeAgo(stats.lastActivityAt)}${
                  stats.lastHandlerName ? ` · ${stats.lastHandlerName}` : ""
                }`}
              />
            ) : null}
            {activeLead ? (
              <DetailRow
                icon={UserPlus}
                label="Active rep"
                value={activeLead.assigneeName || "Unassigned"}
                action={
                  <ManagerReassignLeadButton
                    variant="link"
                    clientId={clientId}
                    leadId={activeLead.id}
                    currentAssigneeId={activeLead.assigneeId}
                    currentAssigneeName={activeLead.assigneeName}
                    onReassigned={() => router.refresh()}
                  />
                }
              />
            ) : null}
          </div>
          {contact.notes ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-quaternary)] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--text-secondary)]">{contact.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Actions</h2>
          <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">What you can do with this contact.</p>
          <div className="flex flex-col gap-2">
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-[13px] font-semibold text-white transition hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
                Message on WhatsApp
              </a>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-[12px] text-[var(--text-tertiary)]">
                Add a phone number to message on WhatsApp.
              </p>
            )}
            {activeLead ? (
              <Link
                href={`/client/leads/pipeline?lead=${activeLead.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[rgba(212,255,79,0.08)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(212,255,79,0.14)]"
              >
                <Briefcase className="h-4 w-4" strokeWidth={1.5} />
                Open active deal
              </Link>
            ) : null}
            {activeLead ? (
              <ManagerReassignLeadButton
                clientId={clientId}
                leadId={activeLead.id}
                currentAssigneeId={activeLead.assigneeId}
                currentAssigneeName={activeLead.assigneeName}
                onReassigned={() => router.refresh()}
              />
            ) : null}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              {activeLead ? "Start another deal" : "Add to pipeline"}
            </button>
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
              >
                <Phone className="h-4 w-4" strokeWidth={1.5} />
                Call
              </a>
            ) : null}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            {clientName} / Customer Hub ·{" "}
            {contact.leadOrigin === "segmiq" ? "Segmiq-generated" : "Added by your team"}
          </p>
        </div>
        <ContactCommunicationPrefs clientId={clientId} contactId={contact.id} />
        </div>
      </div>

      {activeLead ? (
        <div className="mb-8 rounded-2xl border border-[var(--accent)] bg-[rgba(212,255,79,0.06)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Active deal
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {activeLead.project_type || "Pipeline deal"}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {humanStatus(activeLead.status)}
                {activeLead.assigneeName ? ` · ${activeLead.assigneeName}` : " · Unassigned"}
                {activeLead.follow_up_date
                  ? ` · Follow-up ${new Date(activeLead.follow_up_date).toLocaleDateString("en-GB")}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ManagerReassignLeadButton
                variant="row"
                clientId={clientId}
                leadId={activeLead.id}
                currentAssigneeId={activeLead.assigneeId}
                currentAssigneeName={activeLead.assigneeName}
                onReassigned={() => router.refresh()}
              />
              <Link
                href={`/client/leads/pipeline?lead=${activeLead.id}`}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)]"
              >
                Work this deal
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {showRealEstate ? (
        <div className="mb-8 space-y-4">
          {(contact.buyerBudgetMin != null ||
            contact.buyerBudgetMax != null ||
            contact.buyerBedroomsWanted != null ||
            contact.buyerAreaPreference) && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
              <h3 className="font-display text-xl">Buyer preferences</h3>
              <p className="mt-2 text-sm text-ink-secondary">
                Budget{" "}
                {contact.buyerBudgetMin != null || contact.buyerBudgetMax != null
                  ? `${contact.buyerBudgetMin ?? "—"}–${contact.buyerBudgetMax ?? "—"}`
                  : "—"}
                {contact.buyerBedroomsWanted != null
                  ? ` · ${contact.buyerBedroomsWanted}+ beds`
                  : ""}
                {contact.buyerAreaPreference ? ` · ${contact.buyerAreaPreference}` : ""}
                {contact.buyerTimeline ? ` · ${contact.buyerTimeline}` : ""}
              </p>
            </div>
          )}
          <ScheduleViewingPanel
            clientId={clientId}
            contactId={contact.id}
            interestedListingIds={contact.interestedListingIds ?? []}
          />
        </div>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Relationship timeline</h2>
      <ContactTimeline contactId={contact.id} />

      <h2 className="mb-3 mt-8 text-lg font-semibold text-[var(--text-primary)]">Deal history</h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]">
        {leads.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[var(--text-secondary)]">No deals yet.</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-3 text-[13px] font-medium text-[var(--accent)] hover:underline"
            >
              Add to pipeline
            </button>
          </div>
        ) : (
          leads.map((lead, i) => (
            <div
              key={lead.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-[var(--bg-tertiary)] ${
                i < leads.length - 1 ? "border-b border-[var(--border)]" : ""
              }`}
            >
              <Link href={`/client/leads/pipeline?lead=${lead.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {lead.project_type || "Deal"}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                  {formatContactSourceLabel(lead.source)} ·{" "}
                  {new Date(lead.created_at).toLocaleDateString("en-GB")}
                  {lead.assigneeName ? ` · ${lead.assigneeName}` : " · Unassigned"}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <ManagerReassignLeadButton
                  variant="row"
                  clientId={clientId}
                  leadId={lead.id}
                  currentAssigneeId={lead.assigneeId}
                  currentAssigneeName={lead.assigneeName}
                  onReassigned={() => router.refresh()}
                />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase ${statusPillClass(lead.status)}`}
                >
                  {humanStatus(lead.status)}
                </span>
                {lead.deal_value != null ? (
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatCurrencyUsd(Number(lead.deal_value))}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {addOpen && (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="manager"
          clientId={clientId}
          initialContact={{
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          }}
          defaultForceNew
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
