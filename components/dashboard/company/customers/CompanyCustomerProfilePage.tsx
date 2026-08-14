"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Edit3,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { CompanyWorkspaceShell } from "../CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import {
  Avatar,
  Badge,
  Button,
  FieldLabel,
  Input,
  Select,
  useSalesToast,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { formatCustomerMoney } from "@/lib/sales/company-customers-metrics";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { UserRole } from "@/types";
import type {
  CompanyCustomerActivity,
  CompanyCustomerProfileData,
  CompanyCustomersOwnerOption,
} from "./types";

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
        {label}
      </p>
      <div className="mt-1 break-words text-[13px] text-sales-text-primary">{children}</div>
    </div>
  );
}

function ActivityIcon({ activity }: { activity: CompanyCustomerActivity }) {
  const cls =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-sales-text-secondary";
  if (activity.kind === "whatsapp")
    return <span className={cls}><SiWhatsapp size={16} color="#25D366" /></span>;
  if (activity.kind === "call") return <span className={cls}><Phone size={16} /></span>;
  if (activity.kind === "quote") return <span className={cls}><ReceiptText size={16} /></span>;
  if (activity.kind === "deal") return <span className={cls}><BriefcaseBusiness size={16} /></span>;
  return <span className={cls}><CalendarDays size={16} /></span>;
}

function EditCustomerSheet({
  data,
  owners,
  clientId,
  onClose,
}: {
  data: CompanyCustomerProfileData;
  owners: CompanyCustomersOwnerOption[];
  clientId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const customer = data.customer;
  const [customerType, setCustomerType] = useState(customer.customerType);
  const [ownerId, setOwnerId] = useState(customer.ownerId ?? "");
  const [primaryContactName, setPrimaryContactName] = useState(customer.primaryContactName ?? "");
  const [industry, setIndustry] = useState(customer.industry ?? "");
  const [location, setLocation] = useState(customer.location ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/client/customers/${customer.id}?clientId=${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerType,
            relationshipOwnerId: ownerId || null,
            primaryContactName: primaryContactName || null,
            industry: industry || null,
            location: location || null,
          }),
        }
      );
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Could not update Customer");
      toast({ title: "Customer updated", tone: "success" });
      onClose();
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not update Customer",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      eyebrow="Company / Customers"
      title="Edit Customer"
      description="Update the stable Customer relationship fields used by the directory and filters."
      onClose={onClose}
      maxWidthClass="max-w-[460px]"
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="profile-customer-type">Customer type</FieldLabel>
          <Select
            id="profile-customer-type"
            value={customerType}
            onChange={(event) => setCustomerType(event.target.value as typeof customerType)}
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="profile-owner">Relationship owner</FieldLabel>
          <Select id="profile-owner" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </Select>
        </div>
        {customerType === "company" ? (
          <div>
            <FieldLabel htmlFor="profile-primary-contact">Primary contact</FieldLabel>
            <Input id="profile-primary-contact" value={primaryContactName} onChange={(event) => setPrimaryContactName(event.target.value)} />
          </div>
        ) : null}
        <div>
          <FieldLabel htmlFor="profile-industry">Industry / category</FieldLabel>
          <Input id="profile-industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="profile-location">Location</FieldLabel>
          <Input id="profile-location" value={location} onChange={(event) => setLocation(event.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Customer"}</Button>
        </div>
      </div>
    </PremiumSheet>
  );
}

export function CompanyCustomerProfilePage({
  data,
  owners,
  clientId,
  clientName,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyCustomerProfileData;
  owners: CompanyCustomersOwnerOption[];
  clientId: string;
  clientName: string;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const customer = data.customer;
  const pipelineLabel =
    customer.activePipelineUnknownCount > 0 && customer.activePipelineKnown === 0
      ? "—"
      : formatCustomerMoney(customer.activePipelineKnown);
  const kpis = useMemo<SalesKpiItem[]>(
    () => [
      { id: "profile-total-deals", label: "Total Deals", value: String(customer.totalDeals), supporting: "All canonical Deals", icon: "deals" },
      { id: "profile-active-deals", label: "Active Deals", value: String(customer.activeDeals), supporting: "Open commercial opportunities", icon: "deals" },
      { id: "profile-pipeline", label: "Active Pipeline Value", value: pipelineLabel, supporting: customer.activePipelineUnknownCount ? `${customer.activePipelineUnknownCount} awaiting estimate` : "Known active Deal values", icon: "pipeline" },
      { id: "profile-won-value", label: "Won Value", value: customer.customerValueLabel, supporting: `${customer.wonDeals} Won Deal${customer.wonDeals === 1 ? "" : "s"}`, icon: "won" },
    ],
    [customer, pipelineLabel]
  );
  const digits = customer.phone?.replace(/[^\d]/g, "") ?? "";

  return (
    <CompanyWorkspaceShell companyName={clientName} companyLogoUrl={companyLogoUrl} userName={userName} avatarUrl={avatarUrl} unreadNotifications={unreadNotifications} notificationRole={notificationRole} whatsappBadge={whatsappBadge}>
      <CompanyDashboardHeader unreadNotifications={unreadNotifications} notificationRole={notificationRole} userName={userName} avatarUrl={avatarUrl} canAddLead={false} breadcrumb="Company / Customers / Profile" title={customer.name} description="Customer relationship, commercial history, and recent interactions." primaryAction={<Button variant="secondary" leftIcon={<ArrowLeft size={15} />} onClick={() => router.push(`/client/customers?customer=${customer.id}`)}>Back to Customers</Button>} />

      <section className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Avatar name={customer.name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-sales-text-primary">{customer.name}</h1>
                <Badge tone={customer.customerType === "company" ? "success" : "info"} appearance="soft">{customer.customerTypeLabel}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-sales-text-secondary">{customer.industry ?? (customer.customerType === "company" ? "Company Customer" : "Individual Customer")}</p>
              {customer.location ? <p className="mt-1 flex items-center gap-1 text-[12px] text-sales-text-muted"><MapPin size={13} />{customer.location}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {customer.telHref ? <a href={customer.telHref} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-sales-border px-3 text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"><Phone size={15} />Call</a> : null}
            {digits ? <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-sales-border px-3 text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"><SiWhatsapp size={15} color="#25D366" />WhatsApp</a> : null}
            {customer.mailtoHref ? <a href={customer.mailtoHref} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-sales-border px-3 text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"><Mail size={15} />Email</a> : null}
            <Button leftIcon={<Edit3 size={15} />} onClick={() => setEditOpen(true)}>Edit Customer</Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{kpis.map((item) => <KpiCard key={item.id} item={item} />)}</div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <section className="rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
            <div className="border-b border-sales-border-subtle px-4 py-3.5 sm:px-5"><h2 className="text-[14px] font-semibold text-sales-text-primary">Customer information</h2><p className="mt-0.5 text-[12px] text-sales-text-muted">Stable relationship details used throughout SegMiQ.</p></div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-5">
              <InfoItem label="Customer type"><span className="inline-flex items-center gap-1.5">{customer.customerType === "company" ? <Building2 size={14} /> : <UserRound size={14} />}{customer.customerTypeLabel}</span></InfoItem>
              <InfoItem label="Relationship owner">{customer.ownerName ?? "Unassigned"}</InfoItem>
              <InfoItem label="Primary contact">{customer.primaryContactName ?? (customer.customerType === "individual" ? customer.name : "Not assigned")}</InfoItem>
              <InfoItem label="Customer since">{customer.customerSinceLabel}</InfoItem>
              <InfoItem label="Phone">{customer.phone ?? "Not recorded"}</InfoItem>
              <InfoItem label="Email">{customer.email ?? "Not recorded"}</InfoItem>
              <InfoItem label="Location">{customer.location ?? "Not recorded"}</InfoItem>
              <InfoItem label="Source">{customer.source ?? "Not recorded"}</InfoItem>
            </div>
          </section>

          <section className="overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
            <div className="flex items-center justify-between border-b border-sales-border-subtle px-4 py-3.5 sm:px-5"><div><h2 className="text-[14px] font-semibold text-sales-text-primary">Deal history</h2><p className="mt-0.5 text-[12px] text-sales-text-muted">Every canonical Deal linked to this Customer.</p></div><Button variant="secondary" size="sm" onClick={() => router.push(customer.viewDealsHref)}>View Pipeline</Button></div>
            {data.deals.length === 0 ? <div className="px-5 py-10 text-center"><BriefcaseBusiness className="mx-auto text-sales-text-muted" size={24} /><p className="mt-2 text-[13px] font-medium text-sales-text-primary">No Deals yet</p><p className="mt-1 text-[12px] text-sales-text-muted">Deals linked to this Customer will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] uppercase tracking-[0.04em] text-sales-text-muted"><tr><th className="px-4 py-3 font-medium sm:px-5">Deal</th><th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">Value</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Last activity</th></tr></thead><tbody className="divide-y divide-sales-border-subtle">{data.deals.map((deal) => <tr key={deal.id} className="hover:bg-sales-surface-hover"><td className="px-4 py-3.5 sm:px-5"><Link href={deal.href} className="text-[13px] font-semibold text-sales-text-primary hover:underline">{deal.name}</Link></td><td className="px-4 py-3.5"><Badge tone={deal.stage === "WON" ? "success" : deal.stage === "LOST" ? "neutral" : "info"}>{deal.stageLabel}</Badge></td><td className="px-4 py-3.5 text-[13px] font-medium tabular-nums text-sales-text-primary">{deal.valueLabel}</td><td className="px-4 py-3.5 text-[12px] text-sales-text-secondary">{deal.ownerName ?? "Unassigned"}</td><td className="px-4 py-3.5 text-[12px] text-sales-text-secondary">{deal.lastActivityLabel}</td></tr>)}</tbody></table></div>}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card sm:p-5"><h2 className="text-[14px] font-semibold text-sales-text-primary">Commercial summary</h2><div className="mt-4 grid grid-cols-2 gap-4"><InfoItem label="Total Deals"><span className="font-semibold tabular-nums">{customer.totalDeals}</span></InfoItem><InfoItem label="Active Deals"><span className="font-semibold tabular-nums">{customer.activeDeals}</span></InfoItem><InfoItem label="Won Deals"><span className="font-semibold tabular-nums">{customer.wonDeals}</span></InfoItem><InfoItem label="Won Value"><span className="font-semibold tabular-nums">{customer.customerValueLabel}</span></InfoItem></div>{customer.activePipelineUnknownCount ? <p className="mt-4 rounded-[8px] bg-sales-warning-soft px-3 py-2 text-[11px] text-sales-warning-fg">{customer.activePipelineUnknownCount} active Deal{customer.activePipelineUnknownCount === 1 ? "" : "s"} awaiting an estimate.</p> : null}</section>

          <section className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card sm:p-5"><h2 className="text-[14px] font-semibold text-sales-text-primary">Recent activity</h2>{customer.recentActivity.length ? <div className="mt-4 space-y-4">{customer.recentActivity.map((activity) => <div key={activity.id} className="flex gap-2.5"><ActivityIcon activity={activity} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2"><p className="text-[12px] font-medium text-sales-text-primary">{activity.title}</p><span className="text-[10px] text-sales-text-muted">{activity.timeLabel}</span></div>{activity.detail ? <p className="mt-0.5 line-clamp-2 text-[11px] text-sales-text-secondary">{activity.detail}</p> : null}</div></div>)}</div> : <p className="mt-3 text-[12px] text-sales-text-muted">No meaningful interactions recorded yet.</p>}</section>

          <section className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card sm:p-5"><h2 className="text-[14px] font-semibold text-sales-text-primary">Notes</h2><p className={cn("mt-3 whitespace-pre-wrap text-[12px] leading-relaxed", data.notes ? "text-sales-text-secondary" : "text-sales-text-muted")}>{data.notes ?? "No Customer notes recorded."}</p></section>
        </div>
      </div>

      {editOpen ? <EditCustomerSheet data={data} owners={owners} clientId={clientId} onClose={() => setEditOpen(false)} /> : null}
    </CompanyWorkspaceShell>
  );
}
