"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MarketingHubTabs } from "./MarketingHubTabs";
import { CAMPAIGN_OBJECTIVES } from "@/lib/marketing/types";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  lead_count: number | null;
};

type Template = {
  name: string;
  language: string;
  category: string;
  components: { type: string; text?: string }[];
};

type AudiencePreview = {
  total: number;
  whatsappEligible: number;
  optedIn: number;
  optedOut: number;
  unknownConsent: number;
  suppressed: number;
  noPhone: number;
};

const STEPS = ["Objective", "Audience", "Message", "Review"];

export function CampaignWizard({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("generate_sales");
  const [segmentId, setSegmentId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [var1, setVar1] = useState("{{first_name}}");
  const [var2, setVar2] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/segments`)
      .then((r) => r.json())
      .then((data) => setSegments(data.segments ?? []));
    fetch(`/api/clients/${clientId}/marketing/templates`)
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates);
      });
  }, [clientId]);

  useEffect(() => {
    if (!segmentId) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    fetch(`/api/clients/${clientId}/marketing/audiences/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId }),
    })
      .then((r) => r.json())
      .then((data) => setPreview(data.preview ?? null))
      .finally(() => setLoadingPreview(false));
  }, [clientId, segmentId]);

  async function ensureDraft(): Promise<string> {
    if (draftId) return draftId;
    const createRes = await fetch(`/api/clients/${clientId}/marketing/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        objective,
        audience_segment_id: segmentId,
        template_name: templateName,
        template_language: "en",
        template_variables: {
          "1": var1,
          ...(var2 ? { "2": var2 } : {}),
        },
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error ?? "Failed to create campaign");
    const id = createData.campaign.id as string;
    setDraftId(id);
    return id;
  }

  async function handleTestSend() {
    setTesting(true);
    setError(null);
    try {
      const id = await ensureDraft();
      const res = await fetch(
        `/api/clients/${clientId}/marketing/campaigns/${id}/test-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: testPhone }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test send failed");
      setTestSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleLaunch() {
    setSubmitting(true);
    setError(null);
    try {
      const id = await ensureDraft();
      if (!testSent) throw new Error("Send a test message before launching");

      const launchRes = await fetch(
        `/api/clients/${clientId}/marketing/campaigns/${id}/launch`,
        { method: "POST" }
      );
      const launchData = await launchRes.json();
      if (!launchRes.ok) throw new Error(launchData.error ?? "Failed to launch campaign");

      router.push(`/client/marketing/campaigns/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    (step === 0 && name.trim() && objective) ||
    (step === 1 && segmentId) ||
    (step === 2 && templateName) ||
    step === 3;

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">New campaign</h2>
        <div className="mt-3 flex gap-2">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === step
                  ? "bg-[var(--accent)] text-black"
                  : i < step
                    ? "bg-[rgba(61,214,140,0.12)] text-[var(--success)]"
                    : "bg-[var(--surface-elevated)] text-[var(--text-tertiary)]"
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Campaign name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Winter Solar Promotion"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Objective
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPAIGN_OBJECTIVES.map((obj) => (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => setObjective(obj.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      objective === obj.id
                        ? "border-[var(--accent)] bg-[rgba(212,255,79,0.08)]"
                        : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    <p className="font-medium text-[var(--text-primary)]">{obj.label}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{obj.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Select audience segment
              </label>
              <div className="space-y-2">
                {segments.map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => setSegmentId(seg.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      segmentId === seg.id
                        ? "border-[var(--accent)] bg-[rgba(212,255,79,0.08)]"
                        : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{seg.name}</p>
                      {seg.description && (
                        <p className="text-xs text-[var(--text-tertiary)]">{seg.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {seg.lead_count ?? "—"} leads
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {loadingPreview ? (
              <div className="shimmer h-20 rounded-lg" />
            ) : preview ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm">
                <p className="font-medium text-[var(--text-primary)]">
                  {preview.total} contacts match this audience
                </p>
                <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
                  <li>{preview.optedIn} opted into WhatsApp marketing</li>
                  <li>{preview.whatsappEligible} eligible to receive</li>
                  <li>{preview.unknownConsent} consent unknown (will be skipped)</li>
                  <li>{preview.optedOut} opted out</li>
                  <li>{preview.suppressed} suppressed</li>
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                WhatsApp template
              </label>
              {templates.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">
                  No approved templates found. Configure WhatsApp in Company settings and approve
                  marketing templates in Meta Business Manager.
                </p>
              ) : (
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={`${t.name}-${t.language}`} value={t.name}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Variable {"{{1}}"}
              </label>
              <input
                value={var1}
                onChange={(e) => setVar1(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Variable {"{{2}}"} (optional)
              </label>
              <input
                value={var2}
                onChange={(e) => setVar2(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <ReviewRow label="Name" value={name} />
            <ReviewRow label="Objective" value={objective.replace(/_/g, " ")} />
            <ReviewRow
              label="Audience"
              value={segments.find((s) => s.id === segmentId)?.name ?? segmentId}
            />
            <ReviewRow label="Eligible recipients" value={String(preview?.whatsappEligible ?? 0)} />
            <ReviewRow label="Template" value={templateName} />
            <div className="border-t border-[var(--border)] pt-3">
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Test send (required before launch)
              </label>
              <div className="flex gap-2">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+263771234567"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={testing || !testPhone.trim()}
                  onClick={() => void handleTestSend()}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
                >
                  {testing ? "Sending…" : testSent ? "Sent ✓" : "Send test"}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-[rgba(255,68,68,0.12)] px-3 py-2 text-[var(--error)]">
                {error}
              </p>
            )}
            <p className="text-xs text-[var(--text-tertiary)]">
              Only contacts with WhatsApp marketing consent will receive this campaign. Large
              campaigns may require manager approval before sending.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || !canNext || !testSent}
            onClick={() => void handleLaunch()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit for launch"}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-2">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="font-medium capitalize text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
