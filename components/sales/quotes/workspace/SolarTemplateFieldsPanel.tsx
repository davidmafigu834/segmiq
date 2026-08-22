"use client";

import type { ReactNode } from "react";
import { SOLAR_FIELD_SCHEMA } from "@/lib/quotations/layouts/registry";

const FIELD =
  "w-full rounded-sales-md border border-sales-border-strong bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand disabled:opacity-70";

export function SolarTemplateFieldsPanel({
  fields,
  readOnly,
  onChange,
}: {
  fields: Record<string, unknown>;
  readOnly: boolean;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const site = SOLAR_FIELD_SCHEMA.filter((f) => f.group === "site");
  const performance = SOLAR_FIELD_SCHEMA.filter((f) => f.group === "performance");
  const copy = SOLAR_FIELD_SCHEMA.filter((f) => f.group === "copy");

  function set(key: string, value: string) {
    onChange({ ...fields, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-sales-md border border-sales-border bg-sales-surface p-4">
      <div>
        <h2 className="text-[15px] font-semibold">Residential Solar Details</h2>
        <p className="mt-0.5 text-[12.5px] text-sales-text-secondary">
          Template presentation fields — they are not Deal columns and are not required to send unless your company says so.
        </p>
      </div>
      <FieldGroup title="Site / Property">
        {site.map((f) => (
          <Field
            key={f.key}
            def={f}
            value={String(fields[f.key] ?? "")}
            readOnly={readOnly}
            onChange={(v) => set(f.key, v)}
          />
        ))}
      </FieldGroup>
      <FieldGroup title="System Performance">
        {performance.map((f) => (
          <Field
            key={f.key}
            def={f}
            value={String(fields[f.key] ?? "")}
            readOnly={readOnly}
            onChange={(v) => set(f.key, v)}
          />
        ))}
      </FieldGroup>
      <FieldGroup title="Warranty (optional)">
        {copy.map((f) => (
          <Field
            key={f.key}
            def={f}
            value={String(fields[f.key] ?? "")}
            readOnly={readOnly}
            onChange={(v) => set(f.key, v)}
          />
        ))}
      </FieldGroup>
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-sales-text-muted">Project summary</span>
        <textarea
          className={FIELD}
          rows={3}
          disabled={readOnly}
          value={String(fields.project_summary ?? "")}
          onChange={(e) => set("project_summary", e.target.value)}
          placeholder="Short customer-facing summary (3–5 lines)"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-sales-text-muted">Hero image URL (optional)</span>
        <input
          className={FIELD}
          disabled={readOnly}
          value={String(fields.hero_image_url ?? "")}
          onChange={(e) => set("hero_image_url", e.target.value)}
          placeholder="Leave blank to use the template default"
        />
      </label>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold text-sales-text-secondary">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  def,
  value,
  readOnly,
  onChange,
}: {
  def: (typeof SOLAR_FIELD_SCHEMA)[number];
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-sales-text-muted">
        {def.label}
        {def.unit ? ` (${def.unit})` : ""}
      </span>
      {def.kind === "select" && def.options ? (
        <select className={FIELD} disabled={readOnly} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not set</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={FIELD}
          type={def.kind === "number" ? "number" : "text"}
          disabled={readOnly}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
