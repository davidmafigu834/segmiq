"use client";

import { useCallback, useEffect, useState } from "react";
import type { FbFormQuestion } from "@/lib/facebook/form-questions";
import { isContactFormQuestion } from "@/lib/facebook/form-questions";
import type {
  FbQualFieldRule,
  FbQualOptionRule,
  FbQualificationRules,
} from "@/lib/facebook/qualification";
import {
  DEFAULT_FB_QUAL_THRESHOLDS,
  defaultRulesFromQuestions,
  mergeRulesWithQuestions,
} from "@/lib/facebook/qualification";

type IntentPreset = "ignore" | "hot" | "warm" | "cold";

const PRESET_POINTS: Record<Exclude<IntentPreset, "ignore">, number> = {
  hot: 35,
  warm: 20,
  cold: 0,
};

function presetFromOption(o: FbQualOptionRule): IntentPreset {
  if (o.force_tier === "cold") return "cold";
  if (o.force_tier === "hot" || o.points >= 30) return "hot";
  if (o.force_tier === "warm" || o.points >= 15) return "warm";
  if (o.points > 0) return "warm";
  return "ignore";
}

function optionFromPreset(value: string, preset: IntentPreset): FbQualOptionRule {
  if (preset === "ignore") {
    return { value, points: 0, force_tier: null };
  }
  if (preset === "cold") {
    return { value, points: 0, force_tier: "cold" };
  }
  return {
    value,
    points: PRESET_POINTS[preset],
    force_tier: preset === "hot" ? "hot" : null,
  };
}

function ensureRules(
  rules: FbQualificationRules | null,
  questions: FbFormQuestion[]
): FbQualificationRules {
  if (!rules) return defaultRulesFromQuestions(questions);
  return mergeRulesWithQuestions(rules, questions);
}

export function FacebookQualificationPanel({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [questions, setQuestions] = useState<FbFormQuestion[]>([]);
  const [rules, setRules] = useState<FbQualificationRules>({
    thresholds: { ...DEFAULT_FB_QUAL_THRESHOLDS },
    rules: [],
  });
  const [formName, setFormName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/facebook/qualification-rules?clientId=${encodeURIComponent(clientId)}`
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        enabled?: boolean;
        questions?: FbFormQuestion[];
        rules?: FbQualificationRules | null;
        formName?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load qualification settings");
        return;
      }
      const qs = data.questions ?? [];
      setQuestions(qs);
      setEnabled(Boolean(data.enabled));
      setFormName(data.formName ?? null);
      setRules(ensureRules(data.rules ?? null, qs));
    } catch {
      setError("Network error loading qualification settings");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSyncQuestions() {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/facebook/forms/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        questions?: FbFormQuestion[];
        rules?: FbQualificationRules;
        enabled?: boolean;
        formName?: string | null;
        tokenExpired?: boolean;
      };
      if (!res.ok) {
        setError(
          data.tokenExpired
            ? `${data.error ?? "Could not sync questions"} Reconnect Facebook.`
            : (data.error ?? "Could not sync questions")
        );
        return;
      }
      const qs = data.questions ?? [];
      setQuestions(qs);
      setRules(ensureRules(data.rules ?? null, qs));
      if (typeof data.enabled === "boolean") setEnabled(data.enabled);
      if (data.formName) setFormName(data.formName);
      setStatus(`Synced ${qs.length} form question${qs.length === 1 ? "" : "s"} from Facebook.`);
    } catch {
      setError("Network error syncing questions");
    } finally {
      setSyncing(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/facebook/qualification-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, enabled, rules }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save rules");
        return;
      }
      setStatus("Qualification rules saved. New Facebook leads will be scored automatically.");
    } catch {
      setError("Network error saving rules");
    } finally {
      setSaving(false);
    }
  }

  function updateField(fieldKey: string, patch: Partial<FbQualFieldRule>) {
    setRules((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.field_key === fieldKey ? { ...r, ...patch } : r)),
    }));
  }

  function updateOption(fieldKey: string, optionValue: string, preset: IntentPreset) {
    setRules((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => {
        if (r.field_key !== fieldKey) return r;
        return {
          ...r,
          options: r.options.map((o) =>
            o.value === optionValue ? optionFromPreset(optionValue, preset) : o
          ),
        };
      }),
    }));
  }

  function addCustomOption(fieldKey: string) {
    const value = window.prompt("Answer text to match (case-insensitive)");
    if (!value?.trim()) return;
    setRules((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => {
        if (r.field_key !== fieldKey) return r;
        if (r.options.some((o) => o.value.toLowerCase() === value.trim().toLowerCase())) {
          return r;
        }
        return {
          ...r,
          enabled: true,
          options: [...r.options, optionFromPreset(value.trim(), "ignore")],
        };
      }),
    }));
  }

  const visibleRules = rules.rules.filter((r) => {
    const q = questions.find((x) => x.key === r.field_key);
    if (q && isContactFormQuestion(q)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="border border-border bg-surface-card p-6 text-sm text-ink-secondary">
        Loading form qualification…
      </div>
    );
  }

  return (
    <div className="border border-border bg-surface-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-xl text-ink-primary">Form intent rules</h3>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
            Pull questions from the connected Facebook Instant Form, then mark which answers mean
            high intent (call first) vs low intent (later). Rules beat generic AI for this client&apos;s
            definition of qualified.
          </p>
          {formName ? (
            <p className="mt-2 font-mono text-[11px] uppercase text-ink-tertiary">
              Form · {formName}
            </p>
          ) : null}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink-primary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Enable scoring
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block font-mono text-[11px] uppercase text-ink-tertiary">
            Hot at / above
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={rules.thresholds.hot}
            onChange={(e) =>
              setRules((prev) => ({
                ...prev,
                thresholds: {
                  ...prev.thresholds,
                  hot: Number(e.target.value) || 0,
                },
              }))
            }
            className="mt-1 w-24 rounded-md border border-border bg-content px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block font-mono text-[11px] uppercase text-ink-tertiary">
            Warm at / above
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={rules.thresholds.warm}
            onChange={(e) =>
              setRules((prev) => ({
                ...prev,
                thresholds: {
                  ...prev.thresholds,
                  warm: Number(e.target.value) || 0,
                },
              }))
            }
            className="mt-1 w-24 rounded-md border border-border bg-content px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void onSyncQuestions()}
          disabled={syncing}
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-ink-secondary hover:border-border-strong hover:text-ink-primary disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Refresh questions from Facebook"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[var(--danger-fg)]" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-4 text-sm text-[var(--success)]" role="status">
          {status}
        </p>
      ) : null}

      {questions.length === 0 && visibleRules.length === 0 ? (
        <div className="mt-6 border border-dashed border-border px-4 py-8 text-center text-sm text-ink-secondary">
          No form questions cached yet. Click{" "}
          <span className="text-ink-primary">Refresh questions from Facebook</span> after the lead
          form is connected.
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {visibleRules.map((rule) => {
            const q = questions.find((x) => x.key === rule.field_key);
            const label = rule.label || q?.label || rule.field_key;
            return (
              <li key={rule.field_key} className="border border-border bg-content/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-primary">{label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-tertiary">{rule.field_key}</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateField(rule.field_key, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Use in scoring
                  </label>
                </div>

                {rule.options.length === 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-ink-secondary">
                      Open-ended field — add answer matches to score.
                    </p>
                    <button
                      type="button"
                      onClick={() => addCustomOption(rule.field_key)}
                      className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Add answer match
                    </button>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {rule.options.map((opt) => {
                      const preset = presetFromOption(opt);
                      return (
                        <li
                          key={`${rule.field_key}:${opt.value}`}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0 text-sm text-ink-secondary">{opt.value}</span>
                          <select
                            value={preset}
                            disabled={!rule.enabled}
                            onChange={(e) =>
                              updateOption(
                                rule.field_key,
                                opt.value,
                                e.target.value as IntentPreset
                              )
                            }
                            className="w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-ink-primary disabled:opacity-50 sm:w-48"
                          >
                            <option value="ignore">Ignore</option>
                            <option value="hot">High intent (Hot)</option>
                            <option value="warm">Medium (Warm)</option>
                            <option value="cold">Low / Later (Cold)</option>
                          </select>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        type="button"
                        onClick={() => addCustomOption(rule.field_key)}
                        className="text-xs text-ink-tertiary underline-offset-2 hover:text-ink-secondary hover:underline"
                      >
                        + Match another answer text
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save intent rules"}
        </button>
        <p className="text-xs text-ink-tertiary">
          Hot ≥ {rules.thresholds.hot} · Warm ≥ {rules.thresholds.warm} · Cold answers skip Call now
        </p>
      </div>
    </div>
  );
}
