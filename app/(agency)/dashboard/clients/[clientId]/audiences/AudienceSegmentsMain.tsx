"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Plus,
  Users,
  Trash2,
  X,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type SegmentFilter = {
  field: string;
  operator: string;
  value: unknown;
};

type Segment = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  segment_type: "predefined" | "custom";
  predefined_key: string | null;
  filters: SegmentFilter[];
  filter_logic: "and" | "or";
  export_fields: string[];
  min_score: number | null;
  date_range_days: number | null;
  is_active: boolean;
  last_exported_at: string | null;
  last_export_count: number | null;
  lead_count: number | null;
  created_at: string;
};

type PreviewLead = {
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  score: number;
};

// ============================================
// EXPORT MODAL
// ============================================

function ExportModal({
  segment,
  clientId,
  onClose,
}: {
  segment: Segment;
  clientId: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    setError(null);

    fetch(
      `/api/clients/${clientId}/segments/${segment.id}/export?limit=5`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error as string);
        } else {
          setPreview((data.preview as PreviewLead[]) ?? []);
          setTotalCount(data.totalCount as number);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load preview");
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, segment.id]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/segments/${segment.id}/export`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const segmentName = segment.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      a.href = url;
      a.download = `${segmentName}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface-modal)] p-6 shadow-lg mx-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="mb-5">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            Export audience
          </p>
          <h2 className="font-display text-xl text-[var(--text-primary)]">
            {segment.name}
          </h2>
          {segment.description && (
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {segment.description}
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Preview
            </p>
            {totalCount !== null && (
              <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                {totalCount.toLocaleString()} contacts
              </span>
            )}
          </div>

          {loadingPreview ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="shimmer h-8 rounded-md"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-md bg-[var(--error-muted)] p-3 text-[12px] text-[var(--error)]">
              <TriangleAlert size={14} />
              {error}
            </div>
          ) : preview.length === 0 ? (
            <p className="text-center text-[13px] text-[var(--text-tertiary)] py-3">
              No contacts match this segment.
            </p>
          ) : (
            <div className="space-y-1.5">
              {preview.map((lead, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="font-medium text-[var(--text-primary)] truncate">
                    {lead.name}
                  </span>
                  <span className="shrink-0 text-[var(--text-tertiary)]">
                    {lead.phone ?? lead.email ?? "—"}
                  </span>
                </div>
              ))}
              {(totalCount ?? 0) > 5 && (
                <p className="pt-1 text-center text-[11px] text-[var(--text-tertiary)]">
                  +{((totalCount ?? 0) - 5).toLocaleString()} more
                </p>
              )}
            </div>
          )}
        </div>

        {/* Export fields */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Fields included
          </p>
          <div className="flex flex-wrap gap-2">
            {(segment.export_fields ?? ["phone", "email", "name"]).map((f) => (
              <span
                key={f}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] capitalize"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || loadingPreview || (totalCount ?? 0) === 0}
            className="btn-primary flex-1"
          >
            <Download size={13} />
            {exporting ? "Exporting…" : "Download CSV"}
          </button>
          <button onClick={onClose} className="btn-secondary-dark">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CREATE SEGMENT MODAL
// ============================================

const FILTER_FIELDS = [
  { value: "status", label: "Status" },
  { value: "source", label: "Source" },
  { value: "score", label: "Lead score" },
  { value: "intent_score", label: "Intent score" },
  { value: "urgency_level", label: "Urgency" },
  { value: "intent_category", label: "Intent category" },
  { value: "budget_estimate_usd", label: "Budget (USD)" },
  { value: "property_type", label: "Property type" },
  { value: "is_stale", label: "Is stale" },
];

const OPERATOR_OPTIONS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "at least" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "at most" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
];

type DraftFilter = {
  field: string;
  operator: string;
  value: string;
};

function CreateSegmentModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filterLogic, setFilterLogic] = useState<"and" | "or">("and");
  const [filters, setFilters] = useState<DraftFilter[]>([
    { field: "status", operator: "eq", value: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFilter = () =>
    setFilters((prev) => [
      ...prev,
      { field: "status", operator: "eq", value: "" },
    ]);

  const removeFilter = (i: number) =>
    setFilters((prev) => prev.filter((_, idx) => idx !== i));

  const updateFilter = (i: number, key: keyof DraftFilter, val: string) =>
    setFilters((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f))
    );

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          filters: filters.map((f) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
          filter_logic: filterLogic,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create segment");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create segment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-[520px] rounded-xl border border-[var(--border)] bg-[var(--surface-modal)] p-6 shadow-lg mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="mb-5">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            New segment
          </p>
          <h2 className="font-display text-xl text-[var(--text-primary)]">
            Create audience segment
          </h2>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Name
            </label>
            <input
              className="input-base"
              placeholder="e.g. High-value leads last 30 days"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Description (optional)
            </label>
            <textarea
              className="input-base h-auto min-h-[56px] py-2 resize-none"
              placeholder="What is this segment for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Filters
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-tertiary)]">Logic:</span>
              <select
                className="input-base h-7 w-auto px-2 text-[11px]"
                value={filterLogic}
                onChange={(e) => setFilterLogic(e.target.value as "and" | "or")}
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="input-base flex-1"
                  value={f.field}
                  onChange={(e) => updateFilter(i, "field", e.target.value)}
                >
                  {FILTER_FIELDS.map((ff) => (
                    <option key={ff.value} value={ff.value}>
                      {ff.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input-base w-[110px]"
                  value={f.operator}
                  onChange={(e) => updateFilter(i, "operator", e.target.value)}
                >
                  {OPERATOR_OPTIONS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input
                  className="input-base flex-1"
                  placeholder="value"
                  value={f.value}
                  onChange={(e) => updateFilter(i, "value", e.target.value)}
                />
                {filters.length > 1 && (
                  <button
                    onClick={() => removeFilter(i)}
                    className="shrink-0 rounded p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addFilter}
            className="mt-2 btn-ghost text-[11px]"
          >
            <Plus size={12} />
            Add filter
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--error-muted)] p-3 text-[12px] text-[var(--error)]">
            <TriangleAlert size={14} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? "Saving…" : "Create segment"}
          </button>
          <button onClick={onClose} className="btn-secondary-dark">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SEGMENT CARD
// ============================================

function SegmentCard({
  segment,
  clientId,
  isAgencyAdmin,
  onExport,
  onDeleted,
}: {
  segment: Segment;
  clientId: string;
  isAgencyAdmin: boolean;
  onExport: (segment: Segment) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(`Delete segment "${segment.name}"? This cannot be undone.`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      await fetch(
        `/api/clients/${clientId}/segments/${segment.id}`,
        { method: "DELETE" }
      );
      onDeleted();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  const count = segment.lead_count;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 gap-4 ag-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
              {segment.name}
            </p>
            {segment.segment_type === "predefined" && (
              <span className="shrink-0 rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Built-in
              </span>
            )}
          </div>
          {segment.description && (
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              {segment.description}
            </p>
          )}
        </div>

        {/* Lead count */}
        <div className="shrink-0 text-right">
          {count === null ? (
            <span className="text-[var(--text-disabled)] text-[13px]">—</span>
          ) : (
            <div className="flex flex-col items-end">
              <span className="font-display text-[28px] font-semibold leading-none text-[var(--text-primary)]">
                {count.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                contacts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
        {segment.date_range_days && (
          <span>Last {segment.date_range_days}d</span>
        )}
        {segment.min_score != null && (
          <span>Score ≥ {segment.min_score}</span>
        )}
        {segment.last_exported_at && (
          <span>
            Last export{" "}
            {new Date(segment.last_exported_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
            {segment.last_export_count != null &&
              ` · ${segment.last_export_count.toLocaleString()} contacts`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
        <button
          onClick={() => onExport(segment)}
          className="btn-primary"
          disabled={count === 0}
        >
          <Download size={13} />
          Export CSV
        </button>

        {isAgencyAdmin && segment.segment_type === "custom" && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost text-[var(--error)]"
          >
            <Trash2 size={13} />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}

        <button
          onClick={() => onExport(segment)}
          className="btn-ghost ml-auto"
          title="Preview"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AudienceSegmentsMain({
  clientId,
  isAgencyAdmin,
}: {
  clientId: string;
  isAgencyAdmin: boolean;
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportTarget, setExportTarget] = useState<Segment | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/segments`);
      const data = (await res.json()) as { segments?: Segment[]; error?: string };
      if (data.segments) setSegments(data.segments);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const predefined = segments.filter((s) => s.segment_type === "predefined");
  const custom = segments.filter((s) => s.segment_type === "custom");

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            01 / RETARGETING
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-[var(--text-primary)]">
            Audience segments
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)] max-w-[520px]">
            Export contact lists for Facebook retargeting and lookalike audiences.
            Each segment resolves live against your lead database.
          </p>
        </div>
        {isAgencyAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary shrink-0"
          >
            <Plus size={13} />
            New segment
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 4].map((i) => (
            <div
              key={i}
              className="shimmer h-[168px] rounded-xl"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Predefined segments */}
          {predefined.length > 0 && (
            <section className="mb-10">
              <p className="mb-4 font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Built-in segments
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {predefined.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    clientId={clientId}
                    isAgencyAdmin={isAgencyAdmin}
                    onExport={setExportTarget}
                    onDeleted={fetchSegments}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Custom segments */}
          {custom.length > 0 && (
            <section className="mb-10">
              <p className="mb-4 font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Custom segments
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {custom.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    clientId={clientId}
                    isAgencyAdmin={isAgencyAdmin}
                    onExport={setExportTarget}
                    onDeleted={fetchSegments}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {segments.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
              <Users
                size={32}
                className="text-[var(--text-disabled)]"
                strokeWidth={1.25}
              />
              <p className="text-[14px] font-semibold text-[var(--text-secondary)]">
                No segments yet
              </p>
              <p className="text-[13px] text-[var(--text-tertiary)] max-w-[320px]">
                Predefined segments are created automatically. Check back
                after leads have been processed.
              </p>
            </div>
          )}
        </>
      )}

      {/* Export modal */}
      {exportTarget && (
        <ExportModal
          segment={exportTarget}
          clientId={clientId}
          onClose={() => setExportTarget(null)}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateSegmentModal
          clientId={clientId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchSegments();
          }}
        />
      )}
    </div>
  );
}
