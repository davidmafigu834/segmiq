"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Brain, Loader2 } from "lucide-react";
import { Button, Switch, SegmentedControl, Select, Input } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { ProactiveSettingsSection } from "./ProactiveSettingsSection";
import { AgentSectionNav } from "@/components/dashboard/company/agent/AgentSectionNav";
import type { ProactiveSettings } from "@/lib/agent/proactive/types";
import type { LearningSettings } from "@/lib/agent/learning/types";

type AgentSettings = {
  enabled: boolean;
  autonomyMode: "ASSIST" | "COPILOT" | "AUTOPILOT";
  respondToEnquiries: boolean;
  qualifyLeads: boolean;
  createLeads: boolean;
  createDeals: boolean;
  createTasks: boolean;
  scheduleCallbacks: boolean;
  scheduleAppointments: boolean;
  rescheduleAppointments: boolean;
  prepareQuotations: boolean;
  sendQuotations: boolean;
  sendFollowUps: boolean;
  transferSupport: boolean;
  createSupportCases: boolean;
  negotiateDiscounts: boolean;
  quoteAutoSendLimit: number | null;
  businessHoursPolicy: "ALWAYS" | "BUSINESS_HOURS_ONLY" | "AFTER_HOURS_ACK";
  disclosureText: string | null;
  tone: "professional" | "friendly" | "concise";
  languagePreference: string | null;
  maxQuestionsPerMessage: number;
  conversationHourlyLimit: number;
  testMode: boolean;
  learningEnabled: boolean;
  suggestReplies: boolean;
};

const MODE_COPY: Record<AgentSettings["autonomyMode"], string> = {
  ASSIST:
    "The agent drafts replies and recommendations only. Nothing is sent or changed without a person approving it.",
  COPILOT:
    "The agent replies to customers and performs routine, low-risk work (qualification, follow-ups, scheduling, quote drafts). Sending quotations always needs a human.",
  AUTOPILOT:
    "The agent additionally sends quotations autonomously — only within the value limit below, and only when the Commercial Check passes and no approval is required.",
};

function llmProviderLabel(name: string): string {
  if (name === "gemini") return "Gemini";
  if (name === "groq") return "Groq";
  if (name === "anthropic") return "Claude";
  if (name === "vercel") return "Vercel AI Gateway";
  return name;
}

function StatusCell({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">{label}</p>
      <p className={`mt-0.5 text-[13px] font-semibold ${on ? "text-sales-text-primary" : "text-sales-text-secondary"}`}>
        {value}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-primary">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-sales-text-secondary">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function AgentSettingsSection({
  clientId,
  toast,
}: {
  clientId: string;
  toast: (opts: { tone?: "success" | "info" | "warning" | "error"; title: string; description?: string }) => void;
}) {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [proactive, setProactive] = useState<ProactiveSettings | null>(null);
  const [learning, setLearning] = useState<LearningSettings | null>(null);
  const [globallyEnabled, setGloballyEnabled] = useState(true);
  const [llm, setLlm] = useState<{ provider: string; fallback: string | null; model: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent/settings?clientId=${encodeURIComponent(clientId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSettings(data.settings);
          if (data.proactive) setProactive(data.proactive);
          if (data.learning) setLearning(data.learning);
          setGloballyEnabled(Boolean(data.globallyEnabled));
          if (data.llm && typeof data.llm.provider === "string") {
            setLlm({
              provider: data.llm.provider,
              fallback: typeof data.llm.fallback === "string" ? data.llm.fallback : null,
              model: typeof data.llm.model === "string" ? data.llm.model : "",
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const patch = useCallback((next: Partial<AgentSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/settings?clientId=${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ...(proactive ? { proactive } : {}),
          ...(learning
            ? {
                learning: {
                  enabled: learning.enabled,
                  suggestReplies: learning.suggestReplies,
                  config: learning.config,
                },
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      if (data.proactive) setProactive(data.proactive);
      if (data.learning) setLearning(data.learning);
      setDirty(false);
      toast({ title: "SegmiQ Agent settings saved", tone: "success" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Could not save agent settings",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [clientId, settings, proactive, learning, toast]);

  const modeOptions = useMemo(
    () => [
      { value: "ASSIST" as const, label: "Assist" },
      { value: "COPILOT" as const, label: "Copilot" },
      { value: "AUTOPILOT" as const, label: "Autopilot" },
    ],
    []
  );

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[12px] border border-sales-border bg-sales-surface">
        <Loader2 size={18} className="animate-spin text-sales-text-muted" />
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="rounded-[12px] border border-sales-border bg-sales-surface p-5 text-[13px] text-sales-text-secondary">
        Could not load agent settings. Refresh to try again.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AgentSectionNav />
      {!globallyEnabled ? (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-amber-300/50 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          SegmiQ Agent is not configured on this server (missing AI credentials or globally disabled).
          Settings can be prepared but the agent will not run.
        </div>
      ) : null}

      <SettingsSectionCard
        title="Company Brain"
        description="Teach SegmiQ how this business sells, serves customers and makes decisions. Autonomy settings below only work as well as the operating context you provide."
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-sales-brand-soft text-sales-brand">
              <Brain size={17} />
            </span>
            <p className="text-[13px] text-sales-text-secondary">
              Business profile, qualification playbooks, service areas, FAQs, agent rules and knowledge.
            </p>
          </div>
          <Link href="/client/settings/automation/company-brain">
            <Button variant="secondary" size="sm">
              Open Company Brain
            </Button>
          </Link>
        </div>
      </SettingsSectionCard>

      <div className="grid gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3 sm:grid-cols-3">
        <StatusCell
          label="Customer Agent"
          value={settings.enabled ? "Responding" : "Not responding"}
          on={settings.enabled}
        />
        <StatusCell
          label="Proactive Agent"
          value={proactive?.enabled ? "Active" : "Paused"}
          on={Boolean(proactive?.enabled)}
        />
        <StatusCell
          label="Learning"
          value={learning?.enabled || settings.learningEnabled ? "Active" : "Off"}
          on={Boolean(learning?.enabled || settings.learningEnabled)}
        />
      </div>

      <SettingsSectionCard
        title="Presets"
        description="Optional starting points. Autonomy never changes unless you save."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              patch({ enabled: false, suggestReplies: false, learningEnabled: true });
              setLearning((prev) =>
                prev ? { ...prev, enabled: true, suggestReplies: false } : prev
              );
              setProactive((prev) => (prev ? { ...prev, enabled: false } : prev));
              setDirty(true);
            }}
          >
            Learn First
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              patch({ enabled: false, suggestReplies: true, learningEnabled: true, autonomyMode: "ASSIST" });
              setLearning((prev) =>
                prev ? { ...prev, enabled: true, suggestReplies: true } : prev
              );
              setProactive((prev) => (prev ? { ...prev, enabled: false } : prev));
              setDirty(true);
            }}
          >
            Assist
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-sales-text-secondary">
          Learn First: your team keeps handling customers while SegmiQ observes eligible conversations. Assist: suggest
          replies without sending, and learn from edits.
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="SegmiQ Agent"
        description="An AI teammate that handles WhatsApp conversations: understands customers, qualifies, schedules, prepares quotations and hands over to your team when judgement is needed."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-sales-brand-soft text-sales-brand">
              <Bot size={17} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-sales-text-primary">
                {settings.enabled ? "Agent is on" : "Agent is off"}
              </p>
              <p className="text-[12px] text-sales-text-secondary">
                {settings.enabled
                  ? "Inbound WhatsApp conversations are handled by the agent under the rules below."
                  : learning?.enabled || settings.learningEnabled
                    ? "SegmiQ is not responding to customers. Salespeople handle WhatsApp while Learning observes eligible conversations."
                    : "Conversations use your existing scripted qualification flow."}
              </p>
              {llm ? (
                <p className="mt-1 text-[11px] text-sales-text-muted">
                  Model: {llmProviderLabel(llm.provider)} ({llm.model || "default"})
                  {llm.fallback
                    ? ` · falls back to ${llmProviderLabel(llm.fallback)} if the primary hits its rate limit`
                    : null}
                </p>
              ) : null}
            </div>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
        </div>

        <div className="mt-4 border-t border-sales-border-subtle pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
            Autonomy mode
          </p>
          <SegmentedControl
            options={modeOptions}
            value={settings.autonomyMode}
            onChange={(mode) => patch({ autonomyMode: mode })}
          />
          <p className="mt-2 text-[12px] leading-relaxed text-sales-text-secondary">
            {MODE_COPY[settings.autonomyMode]}
          </p>
        </div>

        <div className="mt-4 border-t border-sales-border-subtle pt-2">
          <ToggleRow
            label="Test mode"
            hint="The agent reasons and records what it would do, but sends nothing to customers and changes nothing."
            checked={settings.testMode}
            onChange={(v) => patch({ testMode: v })}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="What the agent may do"
        description="Each capability is enforced on the server. Anything switched off is blocked even if the AI attempts it."
      >
        <div className="divide-y divide-sales-border-subtle">
          <ToggleRow
            label="Respond to customer messages"
            hint="Natural conversation on WhatsApp, always disclosed as an automated assistant."
            checked={settings.respondToEnquiries}
            onChange={(v) => patch({ respondToEnquiries: v })}
          />
          <ToggleRow
            label="Qualify leads"
            hint="Asks your qualification questions progressively and records answers on the Lead."
            checked={settings.qualifyLeads}
            onChange={(v) => patch({ qualifyLeads: v })}
          />
          <ToggleRow
            label="Create Deals"
            hint="Converts qualified Leads into Deals with a recorded justification."
            checked={settings.createDeals}
            onChange={(v) => patch({ createDeals: v })}
          />
          <ToggleRow
            label="Create follow-up tasks"
            hint="'Contact me next Friday' becomes a follow-up in the Daily Plan and calendar."
            checked={settings.createTasks}
            onChange={(v) => patch({ createTasks: v, sendFollowUps: v })}
          />
          <ToggleRow
            label="Schedule callbacks & appointments"
            hint="Books timed callbacks after checking the salesperson's calendar."
            checked={settings.scheduleCallbacks}
            onChange={(v) =>
              patch({ scheduleCallbacks: v, scheduleAppointments: v, rescheduleAppointments: v })
            }
          />
          <ToggleRow
            label="Prepare quotation drafts"
            hint="Builds drafts from your approved packages and templates, then runs the Commercial Check. Drafts are never sent by this capability."
            checked={settings.prepareQuotations}
            onChange={(v) => patch({ prepareQuotations: v })}
          />
          <ToggleRow
            label="Send quotations autonomously"
            hint="Requires Autopilot mode, a passing Commercial Check, no pending approvals, and the value limit below."
            checked={settings.sendQuotations}
            onChange={(v) => patch({ sendQuotations: v })}
          />
          {settings.sendQuotations ? (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-sales-text-primary">
                  Maximum autonomous quotation value
                </p>
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                  Quotes above this total always wait for a human. Empty = never auto-send.
                </p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-32"
                value={settings.quoteAutoSendLimit ?? ""}
                onChange={(e) =>
                  patch({
                    quoteAutoSendLimit: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          ) : null}
          <ToggleRow
            label="Transfer support conversations"
            hint="Routes post-sale issues to the Support queue with a handover summary and support case."
            checked={settings.transferSupport}
            onChange={(v) => patch({ transferSupport: v, createSupportCases: v })}
          />
        </div>
        <p className="mt-3 text-[12px] text-sales-text-muted">
          Discount negotiation is never autonomous: the agent acknowledges the request and brings in
          your team.
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Voice & guardrails"
        description="How the agent speaks and when it works."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Tone
            <Select
              value={settings.tone}
              onChange={(e) => patch({ tone: e.target.value as AgentSettings["tone"] })}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Outside business hours
            <Select
              value={settings.businessHoursPolicy}
              onChange={(e) =>
                patch({
                  businessHoursPolicy: e.target.value as AgentSettings["businessHoursPolicy"],
                })
              }
            >
              <option value="ALWAYS">Respond any time</option>
              <option value="AFTER_HOURS_ACK">Acknowledge, continue in business hours</option>
              <option value="BUSINESS_HOURS_ONLY">Stay silent until business hours</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Questions per message (max)
            <Select
              value={String(settings.maxQuestionsPerMessage)}
              onChange={(e) => patch({ maxQuestionsPerMessage: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Preferred language (optional)
            <Input
              placeholder="e.g. English"
              value={settings.languagePreference ?? ""}
              onChange={(e) => patch({ languagePreference: e.target.value || null })}
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
          AI disclosure line (optional)
          <Input
            placeholder='e.g. "You are chatting with our automated assistant — a person is always available."'
            value={settings.disclosureText ?? ""}
            onChange={(e) => patch({ disclosureText: e.target.value || null })}
          />
        </label>
      </SettingsSectionCard>

      {learning ? (
        <SettingsSectionCard
          title="Learning"
          description="SegmiQ observes eligible salesperson conversations to identify qualification patterns, common customer questions, response styles and sales practices that can improve future Agent behaviour. Learning does not retrain the underlying model."
        >
          <ToggleRow
            label="Learn from team conversations"
            hint="Independent of Customer Agent. Observation creates evidence. Managers approve what becomes company truth."
            checked={learning.enabled}
            onChange={(v) => {
              setLearning({ ...learning, enabled: v });
              patch({ learningEnabled: v });
            }}
          />
          <ToggleRow
            label="Sales conversations"
            checked={learning.config.sales}
            onChange={(v) => {
              setLearning({ ...learning, config: { ...learning.config, sales: v } });
              setDirty(true);
            }}
          />
          <ToggleRow
            label="Support conversations"
            checked={learning.config.support}
            onChange={(v) => {
              setLearning({ ...learning, config: { ...learning.config, support: v } });
              setDirty(true);
            }}
          />
          <ToggleRow
            label="Human edits to Agent drafts"
            checked={learning.config.copilotEdits}
            onChange={(v) => {
              setLearning({ ...learning, config: { ...learning.config, copilotEdits: v } });
              setDirty(true);
            }}
          />
          <ToggleRow
            label="Teach SegmiQ submissions"
            checked={learning.config.teach}
            onChange={(v) => {
              setLearning({ ...learning, config: { ...learning.config, teach: v } });
              setDirty(true);
            }}
          />
          <ToggleRow
            label="Internal notes"
            hint="Off by default. Internal notes are not used as customer-facing evidence."
            checked={learning.config.internalNotes}
            onChange={(v) => {
              setLearning({ ...learning, config: { ...learning.config, internalNotes: v } });
              setDirty(true);
            }}
          />
          <ToggleRow
            label="Suggest replies (Copilot)"
            hint="May stay on while Customer Agent is off. Drafts are never sent automatically."
            checked={settings.suggestReplies || learning.suggestReplies}
            onChange={(v) => {
              patch({ suggestReplies: v });
              setLearning({ ...learning, suggestReplies: v });
            }}
          />
        </SettingsSectionCard>
      ) : null}

      {proactive ? (
        <ProactiveSettingsSection
          value={proactive}
          onChange={(next) => {
            setProactive(next);
            setDirty(true);
          }}
        />
      ) : null}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving} loading={saving}>
          Save agent settings
        </Button>
      </div>
    </div>
  );
}
