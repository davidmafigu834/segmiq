"use client";

import { formatFormData } from "@/lib/format-form-data";

const STRUCTURED_FIELD_LABELS = new Set([
  "name",
  "full name",
  "full_name",
  "phone",
  "phone number",
  "phone_number",
  "mobile",
  "contact number",
  "email",
  "email address",
]);

type LeadLite = {
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
};

type Props = {
  formData: Record<string, unknown> | null;
  lead: LeadLite;
  className?: string;
  /** Nicer on narrow lead panel: one column until md, wide rows span on md+ */
  compactMobile?: boolean;
  title?: string;
};

export function FormAnswersSection({
  formData,
  lead,
  className,
  compactMobile,
  title = "Form answers",
}: Props) {
  const entries = formatFormData(formData as Record<string, unknown>).filter(entry => {
    const normalizedKey = entry.label.toLowerCase().trim();
    return !STRUCTURED_FIELD_LABELS.has(normalizedKey);
  });

  if (lead.budget && !entries.some((e) => e.label.toLowerCase().includes("budget"))) {
    entries.unshift({ label: "Budget", value: lead.budget });
  }
  if (lead.project_type && !entries.some((e) => e.label.toLowerCase().includes("project"))) {
    entries.unshift({ label: "Project type", value: lead.project_type });
  }
  if (lead.timeline && !entries.some((e) => e.label.toLowerCase().includes("timeline"))) {
    entries.unshift({ label: "Timeline", value: lead.timeline });
  }

  if (entries.length === 0) return null;

  return (
    <div
      className={[
        "min-w-0 border-b border-[var(--border)] bg-[var(--surface-card-alt)] px-5 py-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {title}
      </div>
      <FormAnswersGrid compactMobile={compactMobile} entries={entries} />
    </div>
  );
}

function entryValueLong(v: { value: string }) {
  return v.value.length > 60;
}

function FormAnswersGrid({
  entries,
  compactMobile,
}: {
  entries: Array<{ label: string; value: string }>;
  compactMobile?: boolean;
}) {
  const gridClass = compactMobile
    ? "grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2"
    : "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2";

  return (
    <dl className={gridClass}>
      {entries.map((entry, i) => {
        const wide = entryValueLong(entry);
        const spanClass = compactMobile ? (wide ? "md:col-span-2" : "") : wide ? "col-span-2" : "";
        return (
          <div key={`${entry.label}-${i}`} className={spanClass}>
            <dt className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              {entry.label}
            </dt>
            <dd className="min-w-0 break-words text-sm leading-relaxed text-[var(--text-primary)]">
              {entry.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
