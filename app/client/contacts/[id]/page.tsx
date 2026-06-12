import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";

export const dynamic = "force-dynamic";

type LeadJob = {
  id: string;
  status: string;
  source: string | null;
  deal_value: number | null;
  project_type: string | null;
  created_at: string;
  assigned_to: { id: string; name: string } | { id: string; name: string }[] | null;
};

function unwrapAssignee(
  raw: LeadJob["assigned_to"]
): { id: string; name: string } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
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

function formatSource(source: string | null): string {
  if (!source) return "—";
  if (source === "FACEBOOK") return "Facebook";
  if (source === "LANDING_PAGE") return "Landing page";
  if (source === "REFERRAL") return "Referral";
  if (source === "MANUAL") return "Manual";
  return source;
}

export default async function ContactProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "AGENCY_ADMIN") redirect("/login");

  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id, name, phone, email, source, lifecycle, lead_origin, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!contact) notFound();
  if (session.role !== "AGENCY_ADMIN" && contact.client_id !== session.clientId) notFound();

  const { data: leadRows } = await supabase
    .from("leads")
    .select(
      "id, status, source, deal_value, project_type, created_at, updated_at, assigned_to:users!assigned_to_id ( id, name )"
    )
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false });

  const leadList = (leadRows ?? []) as LeadJob[];
  const latestLead = leadList[0] ?? null;
  const owner = latestLead ? unwrapAssignee(latestLead.assigned_to)?.name ?? null : null;
  const wonValue = leadList.reduce((sum, l) => {
    if (l.status !== "WON") return sum;
    return sum + (l.deal_value != null ? Number(l.deal_value) : 0);
  }, 0);

  const firstSeen = new Date(contact.created_at as string).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const isCustomer = contact.lifecycle === "customer";

  return (
    <ClientManagerLayout breadcrumbPage="CONTACT" pageTitle="Customer Hub" hideShellHeader>
      <div className="px-0">
        <Link
          href="/client/contacts"
          className="mb-6 inline-block text-[13px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
        >
          ← Back to Contacts
        </Link>

        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-[var(--text-primary)]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {contact.name || "Unnamed"}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                isCustomer
                  ? "bg-[rgba(212,255,79,0.12)] text-[var(--accent)]"
                  : "bg-white/[0.07] text-[var(--text-secondary)]"
              }`}
            >
              {isCustomer ? "Customer" : "Lead"}
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            {[contact.phone, contact.email, `Owned by ${owner ?? "Unassigned"}`].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            `Source · ${formatSource(contact.source as string | null)}`,
            `First seen · ${firstSeen}`,
            `Origin · ${contact.lead_origin === "segmiq" ? "Segmiq-generated" : "Client-added"}`,
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] bg-[var(--bg-quaternary)] px-3 py-1 text-[11.5px] text-[var(--text-secondary)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Jobs with you
            </p>
            <p className="mt-1 text-2xl text-[var(--text-primary)]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {leadList.length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Lifetime value
            </p>
            <p className="mt-1 text-2xl text-[var(--text-primary)]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              ${wonValue.toLocaleString()}
            </p>
          </div>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Jobs & deals</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]">
          {leadList.length === 0 ? (
            <p className="p-6 text-[13px] text-[var(--text-tertiary)]">No jobs recorded yet.</p>
          ) : (
            leadList.map((lead, i) => (
              <div
                key={lead.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  i < leadList.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {lead.project_type || "Job"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                    {formatSource(lead.source)} · {new Date(lead.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase ${statusPillClass(lead.status)}`}
                  >
                    {humanStatus(lead.status)}
                  </span>
                  {lead.deal_value != null ? (
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                      ${Number(lead.deal_value).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ClientManagerLayout>
  );
}
