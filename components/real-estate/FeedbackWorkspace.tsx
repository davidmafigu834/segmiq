"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Star, Handshake } from "lucide-react";
import { Badge, Button, EmptyState, Input, Select, TextArea } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { WorkspaceUnderlineTabs } from "@/components/real-estate/workspace-chrome";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import {
  COMPLAINT_CATEGORY_LABEL,
  COMPLAINT_STATUS_LABEL,
  type ComplaintCategory,
  type ComplaintStatus,
} from "@/lib/real-estate/complaints";
import {
  AFTER_SALES_OUTCOME_LABEL,
  AFTER_SALES_OUTCOMES,
  AFTER_SALES_STATUS_LABEL,
  AFTER_SALES_STATUSES,
  type AfterSalesOutcome,
  type AfterSalesStatus,
} from "@/lib/real-estate/after-sales";
import { listingLabel } from "@/lib/real-estate/helpers";

type Tab = "feedback" | "complaints" | "testimonials" | "after_sales";

type ViewingFeedback = {
  id: string;
  scheduled_at: string;
  feedback_text: string | null;
  feedback_sentiment: string | null;
  contact_name: string | null;
  agent_name: string | null;
  listing_address: string | null;
  listing_suburb: string | null;
};

type ComplaintRow = {
  id: string;
  subject: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: string;
  resolution_notes: string | null;
  created_at: string;
  contact?: { name?: string | null } | null;
  agent?: { name?: string | null } | null;
  listing?: { address?: string | null; suburb?: string | null } | null;
};

type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
  is_featured: boolean;
};

type AfterSalesRow = {
  id: string;
  kind: string;
  kindLabel: string;
  status: AfterSalesStatus;
  statusLabel: string;
  contactName: string | null;
  propertyLabel: string | null;
  agentName: string | null;
  dueAt: string | null;
  outcome: AfterSalesOutcome | null;
  outcomeLabel: string | null;
  satisfactionScore: number | null;
  futureNeedsNotes: string | null;
  overdue: boolean;
};

export function FeedbackWorkspace({
  clientId,
  viewings,
}: {
  clientId: string;
  viewings: ViewingFeedback[];
}) {
  const [tab, setTab] = useState<Tab>("feedback");
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [afterSales, setAfterSales] = useState<AfterSalesRow[]>([]);
  const [showComplaint, setShowComplaint] = useState(false);
  const [showTestimonial, setShowTestimonial] = useState(false);
  const [editingAfterSales, setEditingAfterSales] = useState<AfterSalesRow | null>(null);
  const [afterSalesForm, setAfterSalesForm] = useState({
    status: "in_progress" as AfterSalesStatus,
    outcome: "" as "" | AfterSalesOutcome,
    satisfaction_score: "" as "" | "1" | "2" | "3" | "4" | "5",
    future_needs_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [complaintForm, setComplaintForm] = useState({
    subject: "",
    description: "",
    category: "service" as ComplaintCategory,
    priority: "medium",
  });
  const [testimonialForm, setTestimonialForm] = useState({
    author_name: "",
    author_role: "",
    content: "",
    rating: 5,
  });

  const feedbackRows = useMemo(
    () => viewings.filter((v) => v.feedback_text?.trim()),
    [viewings]
  );

  const load = useCallback(async () => {
    const [cRes, tRes, aRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/complaints`),
      fetch(`/api/clients/${clientId}/testimonials`),
      fetch(`/api/clients/${clientId}/after-sales?status=all`),
    ]);
    const cJson = (await cRes.json()) as { complaints?: ComplaintRow[] };
    const tJson = (await tRes.json()) as Testimonial[] | { testimonials?: Testimonial[] };
    const aJson = (await aRes.json()) as { rows?: AfterSalesRow[] };
    setComplaints(cJson.complaints ?? []);
    setTestimonials(Array.isArray(tJson) ? tJson : tJson.testimonials ?? []);
    setAfterSales(aJson.rows ?? []);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function saveComplaint() {
    if (!complaintForm.subject.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintForm),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Could not save complaint");
        return;
      }
      setShowComplaint(false);
      setComplaintForm({ subject: "", description: "", category: "service", priority: "medium" });
      setToast("Complaint logged");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateComplaint(id: string, status: ComplaintStatus) {
    await fetch(`/api/clients/${clientId}/complaints?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function saveTestimonial() {
    if (!testimonialForm.author_name.trim() || !testimonialForm.content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testimonialForm,
          author_role: testimonialForm.author_role || null,
        }),
      });
      if (!res.ok) {
        setToast("Could not save testimonial");
        return;
      }
      setShowTestimonial(false);
      setTestimonialForm({ author_name: "", author_role: "", content: "", rating: 5 });
      setToast("Testimonial saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function openAfterSales(row: AfterSalesRow) {
    setEditingAfterSales(row);
    setAfterSalesForm({
      status: row.status,
      outcome: row.outcome ?? "",
      satisfaction_score:
        row.satisfactionScore != null
          ? (String(row.satisfactionScore) as "1" | "2" | "3" | "4" | "5")
          : "",
      future_needs_notes: row.futureNeedsNotes ?? "",
    });
  }

  async function saveAfterSales() {
    if (!editingAfterSales) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/after-sales/${editingAfterSales.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: afterSalesForm.status,
          outcome: afterSalesForm.outcome || null,
          satisfaction_score: afterSalesForm.satisfaction_score
            ? Number(afterSalesForm.satisfaction_score)
            : null,
          future_needs_notes: afterSalesForm.future_needs_notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setToast(j.error ?? "Could not update after-sales case");
        return;
      }
      setEditingAfterSales(null);
      setToast("After-sales updated");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const afterSalesDue = afterSales.filter(
    (r) =>
      r.overdue ||
      r.status === "check_in_due" ||
      r.status === "not_started" ||
      r.status === "in_progress"
  ).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {toast ? (
        <p className="rounded-[10px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px]">
          {toast}
        </p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        <CompanyKpiCard
          item={{
            id: "feedback",
            label: "Viewing notes",
            value: String(feedbackRows.length),
            supporting: "With comments",
            icon: "followups",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "complaints",
            label: "Open complaints",
            value: String(complaints.filter((c) => c.status === "open").length),
            supporting: `${complaints.length} logged`,
            icon: "deals",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "testimonials",
            label: "Testimonials",
            value: String(testimonials.length),
            supporting: "Captured quotes",
            icon: "won",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "after_sales",
            label: "After-sales due",
            value: String(afterSalesDue),
            supporting: `${afterSales.length} cases`,
            icon: "pipeline",
          }}
        />
      </div>

      <div className="workspace-card overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface">
        <WorkspaceUnderlineTabs
          items={[
            { id: "feedback", label: "Viewing feedback", count: feedbackRows.length },
            {
              id: "complaints",
              label: "Complaints",
              count: complaints.filter((c) => c.status === "open").length,
            },
            { id: "testimonials", label: "Testimonials", count: testimonials.length },
            { id: "after_sales", label: "After-sales", count: afterSalesDue },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "feedback" ? (
          feedbackRows.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-4 w-4" />}
              title="No viewing feedback yet"
              description="Completed viewings with comments appear here."
              size="compact"
            />
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {feedbackRows.map((row) => (
                <li key={row.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-sales-text-primary">
                      {row.contact_name || "Customer"}
                    </p>
                    {row.feedback_sentiment ? (
                      <Badge
                        tone={
                          row.feedback_sentiment === "positive"
                            ? "success"
                            : row.feedback_sentiment === "negative"
                              ? "danger"
                              : "neutral"
                        }
                        appearance="soft"
                      >
                        {row.feedback_sentiment}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">{row.feedback_text}</p>
                  <p className="mt-1 text-[11px] text-sales-text-muted">
                    {listingLabel({ address: row.listing_address, suburb: row.listing_suburb })}
                    {row.agent_name ? ` · ${row.agent_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "complaints" ? (
          <div>
            <div className="flex justify-end px-5 py-3">
              <Button
                type="button"
                size="sm"
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowComplaint(true)}
              >
                Log complaint
              </Button>
            </div>
            {complaints.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-4 w-4" />}
                title="No complaints logged"
                description="Record service, listing or agent complaints so the owner can review them."
                size="compact"
              />
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {complaints.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-sales-text-primary">{row.subject}</p>
                        <p className="mt-0.5 text-[11px] text-sales-text-muted">
                          {COMPLAINT_CATEGORY_LABEL[row.category]}
                          {row.contact?.name ? ` · ${row.contact.name}` : ""}
                          {row.agent?.name ? ` · ${row.agent.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            row.status === "open"
                              ? "warning"
                              : row.status === "resolved"
                                ? "success"
                                : "neutral"
                          }
                          appearance="soft"
                        >
                          {COMPLAINT_STATUS_LABEL[row.status]}
                        </Badge>
                        {row.status === "open" || row.status === "investigating" ? (
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
                            onClick={() => void updateComplaint(row.id, "resolved")}
                          >
                            Resolve
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {row.description ? (
                      <p className="mt-1 text-[13px] text-sales-text-secondary">{row.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "testimonials" ? (
          <div>
            <div className="flex justify-end px-5 py-3">
              <Button
                type="button"
                size="sm"
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowTestimonial(true)}
              >
                Add testimonial
              </Button>
            </div>
            {testimonials.length === 0 ? (
              <EmptyState
                icon={<Star className="h-4 w-4" />}
                title="No testimonials yet"
                description="Capture customer quotes the team can send on WhatsApp."
                size="compact"
              />
            ) : (
              <ul className="divide-y divide-sales-border-subtle">
                {testimonials.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-sales-text-primary">{row.author_name}</p>
                    {row.author_role ? (
                      <p className="text-[11px] text-sales-text-muted">{row.author_role}</p>
                    ) : null}
                    <p className="mt-1 text-[13px] text-sales-text-secondary">“{row.content}”</p>
                    {row.rating ? (
                      <p className="mt-1 text-[11px] text-sales-text-muted">{"★".repeat(row.rating)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "after_sales" ? (
          afterSales.length === 0 ? (
            <EmptyState
              icon={<Handshake className="h-4 w-4" />}
              title="No after-sales cases yet"
              description="Check-ins are created when a transaction completes."
              size="compact"
            />
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {afterSales.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-sales-text-primary">
                        {row.contactName || "Client"}
                      </p>
                      <Badge tone={row.overdue ? "danger" : "neutral"} appearance="soft">
                        {row.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                      {row.kindLabel}
                      {row.propertyLabel ? ` · ${row.propertyLabel}` : ""}
                    </p>
                    {row.outcomeLabel || row.satisfactionScore != null || row.futureNeedsNotes ? (
                      <p className="mt-1 text-[11px] text-sales-text-muted">
                        {[
                          row.outcomeLabel,
                          row.satisfactionScore != null ? `${row.satisfactionScore}/5` : null,
                          row.futureNeedsNotes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openAfterSales(row)}>
                    Update
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {showComplaint ? (
        <PremiumSheet
          title="Log complaint"
          description="Owner review register — not a public website form."
          onClose={() => setShowComplaint(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowComplaint(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void saveComplaint()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Subject</span>
              <Input
                value={complaintForm.subject}
                onChange={(e) => setComplaintForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Category</span>
              <Select
                value={complaintForm.category}
                onChange={(e) =>
                  setComplaintForm((f) => ({ ...f, category: e.target.value as ComplaintCategory }))
                }
              >
                {Object.entries(COMPLAINT_CATEGORY_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Details</span>
              <TextArea
                rows={4}
                value={complaintForm.description}
                onChange={(e) => setComplaintForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          </div>
        </PremiumSheet>
      ) : null}

      {showTestimonial ? (
        <PremiumSheet
          title="Add testimonial"
          onClose={() => setShowTestimonial(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowTestimonial(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void saveTestimonial()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">
                Customer name
              </span>
              <Input
                value={testimonialForm.author_name}
                onChange={(e) => setTestimonialForm((f) => ({ ...f, author_name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Role / area</span>
              <Input
                value={testimonialForm.author_role}
                onChange={(e) => setTestimonialForm((f) => ({ ...f, author_role: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Quote</span>
              <TextArea
                rows={4}
                value={testimonialForm.content}
                onChange={(e) => setTestimonialForm((f) => ({ ...f, content: e.target.value }))}
              />
            </label>
          </div>
        </PremiumSheet>
      ) : null}

      {editingAfterSales ? (
        <PremiumSheet
          title="Update after-sales"
          description={editingAfterSales.kindLabel}
          onClose={() => setEditingAfterSales(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingAfterSales(null)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void saveAfterSales()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Status</span>
              <Select
                value={afterSalesForm.status}
                onChange={(e) =>
                  setAfterSalesForm((f) => ({ ...f, status: e.target.value as AfterSalesStatus }))
                }
              >
                {AFTER_SALES_STATUSES.map((id) => (
                  <option key={id} value={id}>
                    {AFTER_SALES_STATUS_LABEL[id]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">Outcome</span>
              <Select
                value={afterSalesForm.outcome}
                onChange={(e) =>
                  setAfterSalesForm((f) => ({
                    ...f,
                    outcome: e.target.value as "" | AfterSalesOutcome,
                  }))
                }
              >
                <option value="">Not set</option>
                {AFTER_SALES_OUTCOMES.map((id) => (
                  <option key={id} value={id}>
                    {AFTER_SALES_OUTCOME_LABEL[id]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">
                Satisfaction (1–5)
              </span>
              <Select
                value={afterSalesForm.satisfaction_score}
                onChange={(e) =>
                  setAfterSalesForm((f) => ({
                    ...f,
                    satisfaction_score: e.target.value as "" | "1" | "2" | "3" | "4" | "5",
                  }))
                }
              >
                <option value="">Not set</option>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">
                Future needs
              </span>
              <TextArea
                rows={3}
                value={afterSalesForm.future_needs_notes}
                onChange={(e) =>
                  setAfterSalesForm((f) => ({ ...f, future_needs_notes: e.target.value }))
                }
              />
            </label>
          </div>
        </PremiumSheet>
      ) : null}
    </div>
  );
}
