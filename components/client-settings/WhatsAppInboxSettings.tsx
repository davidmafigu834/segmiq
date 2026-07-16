"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

type Props = {
  clientId: string;
  clientName: string;
  initialPhoneNumberId: string;
  initialDisplayNumber: string;
  initialAccessToken: string;
  initialAssignmentMode: "direct" | "pool" | "round_robin";
  initialQualificationEnabled: boolean;
  initialInstantFormId: string | null;
  instantForms: { id: string; name: string; status: string }[];
  webhookBaseUrl: string;
  saving: boolean;
  onSave: (data: {
    meta_whatsapp_phone_number_id: string | null;
    meta_whatsapp_display_number: string | null;
    meta_whatsapp_access_token: string | null;
    assignment_mode: "direct" | "pool" | "round_robin";
    whatsapp_qualification_enabled: boolean;
    whatsapp_instant_form_id: string | null;
  }) => Promise<void>;
};

const ASSIGNMENT_OPTIONS: { value: "direct" | "pool" | "round_robin"; label: string; hint: string }[] = [
  {
    value: "pool",
    label: "Shared pool",
    hint: "New WhatsApp chats land unassigned — any rep can claim from Team Inbox.",
  },
  {
    value: "round_robin",
    label: "Round robin",
    hint: "Auto-assign each new WhatsApp chat to the next salesperson in rotation.",
  },
  {
    value: "direct",
    label: "Manual only",
    hint: "Chats stay unassigned until a manager assigns them.",
  },
];

const SETUP_STEPS = [
  {
    title: "Each company uses its own WhatsApp number",
    body: "Solar Co, Build Co, etc. each register their own business number in Meta. Segmiq routes messages by Phone number ID — one ID per client, never shared.",
  },
  {
    title: "Create a Meta Developer app (per company or via your agency)",
    body: "At developers.facebook.com, add the WhatsApp product and register this client's company phone number.",
    href: "https://developers.facebook.com/apps/",
  },
  {
    title: "Copy Phone number ID + access token",
    body: "From WhatsApp → API Setup: paste the numeric Phone number ID below. If this WABA uses its own token (not the platform default), paste it in Access token.",
  },
  {
    title: "Configure the webhook once on the Meta app",
    body: "Callback URL is shared across all clients on Segmiq. Meta includes which phone number was messaged — we match that to the right company.",
  },
  {
    title: "Approve message templates on this WABA",
    body: "Templates (portfolio, pricing, custom message) must be approved on each company's WhatsApp Business Account.",
  },
];

export function WhatsAppInboxSettings({
  clientId,
  clientName,
  initialPhoneNumberId,
  initialDisplayNumber,
  initialAccessToken,
  initialAssignmentMode,
  initialQualificationEnabled,
  initialInstantFormId,
  instantForms,
  webhookBaseUrl,
  saving,
  onSave,
}: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [displayNumber, setDisplayNumber] = useState(initialDisplayNumber);
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [assignmentMode, setAssignmentMode] = useState(initialAssignmentMode);
  const [qualificationEnabled, setQualificationEnabled] = useState(initialQualificationEnabled);
  const [instantFormId, setInstantFormId] = useState(initialInstantFormId ?? "");
  const publishedForms = instantForms.filter((f) => f.status === "published");
  const selectedInstantFormId =
    instantFormId && publishedForms.some((f) => f.id === instantFormId) ? instantFormId : "";
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `${webhookBaseUrl}/api/facebook/webhook`;

  const dirty = useMemo(
    () =>
      phoneNumberId.trim() !== initialPhoneNumberId.trim() ||
      displayNumber.trim() !== initialDisplayNumber.trim() ||
      accessToken.trim() !== initialAccessToken.trim() ||
      assignmentMode !== initialAssignmentMode ||
      qualificationEnabled !== initialQualificationEnabled ||
      (resolvedInstantFormId || null) !== (initialInstantFormId || null),
    [
      phoneNumberId,
      initialPhoneNumberId,
      displayNumber,
      initialDisplayNumber,
      accessToken,
      initialAccessToken,
      assignmentMode,
      initialAssignmentMode,
      qualificationEnabled,
      initialQualificationEnabled,
      resolvedInstantFormId,
      initialInstantFormId,
    ]
  );

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-2xl">WhatsApp Team Inbox</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          <strong className="text-ink-primary">{clientName}</strong> gets its own company WhatsApp number.
          All reps on this account share that one inbox — customers always message the business number, not
          individual reps.
        </p>
      </div>

      <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm text-ink-secondary">
        <p>
          <strong className="text-ink-primary">Multi-client setup:</strong> Client A&apos;s ads and inbox use
          Client A&apos;s number. Client B uses a different number and Phone number ID. Segmiq never mixes
          conversations between companies.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface-card p-5">
        <h3 className="text-sm font-semibold text-ink-primary">Onboarding checklist</h3>
        <ol className="mt-4 space-y-4">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-card-alt font-mono text-[11px] text-ink-secondary">
                {i + 1}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink-primary">{step.title}</p>
                  {step.href ? (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      Open Meta
                      <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface-card p-5">
        <h3 className="text-sm font-semibold text-ink-primary">Webhook (one URL for the whole platform)</h3>
        <div>
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">Callback URL</span>
          <div className="mt-1 flex gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 rounded-md border border-border bg-surface-card-alt px-3 py-2 font-mono text-xs text-ink-secondary"
            />
            <button
              type="button"
              className="btn-ghost flex h-10 items-center gap-1 px-3 text-xs"
              onClick={() => void copy(webhookUrl, "webhook")}
            >
              {copied === "webhook" ? <Check size={14} /> : <Copy size={14} />}
              Copy
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-secondary">
          Subscribe to <strong>messages</strong>. Verify token ={" "}
          <code className="font-mono">META_WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> in Vercel.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-ink-primary">This company&apos;s WhatsApp number</h3>

        <label className="block">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">Business phone (display)</span>
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
            value={displayNumber}
            onChange={(e) => setDisplayNumber(e.target.value)}
            placeholder="e.g. +263 77 123 4567"
          />
          <p className="mt-1 text-xs text-ink-secondary">
            The number customers see and message — for your reference in settings and inbox.
          </p>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">Phone number ID (required)</span>
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 123456789012345"
            inputMode="numeric"
          />
          <p className="mt-1 text-xs text-ink-secondary">
            From Meta → WhatsApp → API Setup. Unique per company — routes inbound and outbound for{" "}
            <span className="font-mono text-[11px]">{clientId.slice(0, 8)}…</span>.
          </p>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">
            Access token (optional)
          </span>
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Leave blank to use platform token from Vercel"
          />
          <p className="mt-1 text-xs text-ink-secondary">
            Only needed if this company&apos;s WhatsApp Business Account uses its own System User token. Otherwise
            set <code className="font-mono">META_WHATSAPP_ACCESS_TOKEN</code> once in Vercel for all clients on
            your Meta app.
          </p>
        </label>

        <fieldset className="space-y-3">
          <legend className="font-mono text-[10px] uppercase text-ink-tertiary">
            New chat assignment
          </legend>
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                assignmentMode === opt.value
                  ? "border-accent bg-accent/5"
                  : "border-border bg-surface-card hover:bg-surface-card-alt"
              }`}
            >
              <input
                type="radio"
                name="wa-assignment"
                className="mt-1"
                checked={assignmentMode === opt.value}
                onChange={() => setAssignmentMode(opt.value)}
              />
              <div>
                <p className="text-sm font-medium text-ink-primary">{opt.label}</p>
                <p className="text-xs text-ink-secondary">{opt.hint}</p>
              </div>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border bg-surface-card-alt/50 p-4">
          <legend className="px-1 text-sm font-semibold text-ink-primary">Auto-qualify new WhatsApp chats</legend>
          <p className="text-xs leading-relaxed text-ink-secondary">
            Uses your published <strong className="text-ink-primary">Instant Form</strong> questions — the same
            qualifying flow as Facebook Instant Forms. Name, phone, and email are skipped because Meta already
            provides them when the customer messages on WhatsApp.
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={qualificationEnabled}
              onChange={(e) => setQualificationEnabled(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-ink-primary">Send Instant Form questions on first message</p>
              <p className="text-xs text-ink-secondary">
                Conditional logic from your Instant Form is respected. Answers are saved to the lead like a form
                submission.
              </p>
            </div>
          </label>
          {qualificationEnabled ? (
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Instant Form</span>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                value={resolvedInstantFormId}
                onChange={(e) => setInstantFormId(e.target.value)}
              >
                <option value="">Latest published form</option>
                {publishedForms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {publishedForms.length === 0 ? (
                <p className="mt-1 text-xs text-ink-secondary">
                  No published Instant Forms — WhatsApp auto-qualification is paused until you publish a form.
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-secondary">
                  Pick a form or leave as latest published. Unpublishing a form stops it on WhatsApp immediately.
                </p>
              )}
            </label>
          ) : null}
        </fieldset>

        <button
          type="button"
          className="btn-primary"
          disabled={saving || !dirty}
          onClick={() =>
            void onSave({
              meta_whatsapp_phone_number_id: phoneNumberId.trim() || null,
              meta_whatsapp_display_number: displayNumber.trim() || null,
              meta_whatsapp_access_token: accessToken.trim() || null,
              assignment_mode: assignmentMode,
              whatsapp_qualification_enabled: qualificationEnabled,
              whatsapp_instant_form_id: resolvedInstantFormId || null,
            })
          }
        >
          Save WhatsApp settings
        </button>
      </section>
    </div>
  );
}
