"use client";

import { useMemo, useState } from "react";
import type { FormField, FormSchemaRow } from "@/types";

function getValue(map: Record<string, string>, field: FormField): string {
  return map[field.id] ?? "";
}

function evalShow(field: FormField, map: Record<string, string>, fields: FormField[]): boolean {
  const logic = field.conditionalLogic;
  if (!logic) return true;
  if (logic.action === "block") return true;
  if (logic.action !== "show") return true;
  const other = fields.find((f) => f.id === logic.fieldId);
  if (!other) return true;
  const v = getValue(map, other);
  if (logic.operator === "equals") return v === logic.value;
  return v !== logic.value;
}

function evalBlock(field: FormField, map: Record<string, string>, fields: FormField[]): string | null {
  const logic = field.conditionalLogic;
  if (!logic || logic.action !== "block") return null;
  const other = fields.find((f) => f.id === logic.fieldId);
  if (!other) return null;
  const v = getValue(map, other);
  const blocked = logic.operator === "equals" ? v === logic.value : v !== logic.value;
  if (blocked) return logic.blockMessage || "Submission blocked.";
  return null;
}

export function FormRenderer({
  schema,
  onSubmit,
  primaryColor = "#D4FF4F",
  variant = "standard",
}: {
  schema: Pick<FormSchemaRow, "fields" | "form_title" | "submit_button_text" | "thank_you_message">;
  onSubmit: (answers: Record<string, string>) => Promise<void> | void;
  primaryColor?: string;
  variant?: "standard" | "northfield";
}) {
  const fields = useMemo(() => (schema.fields ?? []) as FormField[], [schema.fields]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const visible = useMemo(() => {
    return fields.filter((f) => evalShow(f, values, fields));
  }, [fields, values]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const f of visible) {
      if (f.required && !getValue(values, f).trim()) {
        setError(`${f.label} is required.`);
        return;
      }
      const block = evalBlock(f, values, fields);
      if (block) {
        setError(block);
        return;
      }
    }
    setLoading(true);
    try {
      await onSubmit(values);
      setDone(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isNorthfield = variant === "northfield";

  if (done) {
    return (
      <div
        className={
          isNorthfield
            ? "rounded-lg border border-white/15 bg-white/5 p-6 text-center text-white"
            : "rounded-lg border border-border bg-surface-card p-6 text-center text-ink-primary shadow-sm"
        }
      >
        <p className="text-lg font-medium">{schema.thank_you_message || "Thank you!"}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isNorthfield
          ? "space-y-4 rounded-lg border border-white/10 bg-transparent p-0 shadow-none"
          : "space-y-4 rounded-lg border border-border bg-surface-card p-6 shadow-sm"
      }
    >
      {schema.form_title ? (
        <h3 className={isNorthfield ? "font-display text-xl text-white" : "font-display text-xl text-ink-primary"}>
          {schema.form_title}
        </h3>
      ) : null}
      {visible.map((f) => (
        <div key={f.id}>
          <label className={isNorthfield ? "text-sm text-white/70" : "text-sm text-ink-secondary"}>
            {f.label}
            {f.required ? <span className="text-[var(--danger)]"> *</span> : null}
          </label>
          <FieldInput
            field={f}
            value={values[f.id] ?? ""}
            onChange={(v) => setValues((m) => ({ ...m, [f.id]: v }))}
            accent={primaryColor}
            variant={variant}
          />
        </div>
      ))}
      {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className={
          isNorthfield
            ? "w-full rounded-sm py-3 text-sm font-semibold text-[#1A1815]"
            : "w-full rounded-sm py-3 text-sm font-semibold text-[var(--accent-ink)]"
        }
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? "Sending…" : schema.submit_button_text || "Submit"}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  accent,
  variant = "standard",
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  variant?: "standard" | "northfield";
}) {
  const base =
    variant === "northfield"
      ? "mt-1 w-full border-0 border-b border-white/25 bg-transparent px-0 py-2 text-sm text-white outline-none focus:border-white/60 focus:ring-0"
      : "mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none focus:ring-2";
  switch (field.type) {
    case "long_text":
      return (
        <textarea
          className={base}
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      );
    case "dropdown":
      return (
        <select
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="mt-1 space-y-2">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="radio" name={field.id} checked={value === o} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      );
    case "checkboxes":
      return (
        <div className="mt-1 space-y-2">
          {(field.options ?? []).map((o) => {
            const selected = value.split(",").filter(Boolean);
            const on = selected.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? selected.filter((x) => x !== o) : [...selected, o];
                    onChange(next.join(","));
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "file":
      return (
        <input
          type="file"
          className="mt-1 text-sm"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
        />
      );
    default:
      return (
        <input
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
          className={base}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
