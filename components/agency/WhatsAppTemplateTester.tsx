"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader2,
  Send,
  X,
} from "lucide-react";
import type { MetaMessageTemplate } from "@/lib/messaging/meta-whatsapp-templates";
import {
  sendWhatsAppTemplateTest,
  type DialCodeOption,
} from "@/app/(agency)/dashboard/whatsapp-templates/actions";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]";

const DIAL_CODES: { value: DialCodeOption; label: string }[] = [
  { value: "263", label: "Zimbabwe (+263)" },
  { value: "260", label: "Zambia (+260)" },
  { value: "27", label: "South Africa (+27)" },
  { value: "254", label: "Kenya (+254)" },
];

function statusStyle(status: string): { color: string; Icon: typeof CheckCircle } {
  const s = status.toUpperCase();
  if (s === "APPROVED") return { color: "var(--success)", Icon: CheckCircle };
  if (s === "REJECTED") return { color: "var(--error)", Icon: AlertCircle };
  return { color: "var(--warning)", Icon: Clock };
}

function placeholderIndices(text: string): number[] {
  const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g));
  const set = new Set<number>();
  for (const m of matches) {
    set.add(parseInt(m[1]!, 10));
  }
  return Array.from(set).sort((a, b) => a - b);
}

function highlightPlaceholders(text: string): ReactNode[] {
  const parts = text.split(/(\{\{\d+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{\d+\}\}$/.test(part) ? (
      <span
        key={i}
        className="rounded px-1 font-mono text-[12px]"
        style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function getBodyComponent(template: MetaMessageTemplate) {
  return template.components.find((c) => c.type === "BODY");
}

function getHeaderComponent(template: MetaMessageTemplate) {
  return template.components.find((c) => c.type === "HEADER");
}

function getUrlButton(template: MetaMessageTemplate) {
  for (const c of template.components) {
    if (c.type !== "BUTTONS" || !c.buttons) continue;
    const btn = c.buttons.find((b) => b.type === "URL" && b.url?.includes("{{"));
    if (btn) return btn;
  }
  return null;
}

type Props = {
  templates: MetaMessageTemplate[];
  listError: string | null;
  sampleOgImageUrl: string;
};

export function WhatsAppTemplateTester({ templates, listError, sampleOgImageUrl }: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dialCode, setDialCode] = useState<DialCodeOption>("263");
  const [phone, setPhone] = useState("");
  const [bodyValues, setBodyValues] = useState<Record<number, string>>({});
  const [headerUrl, setHeaderUrl] = useState("");
  const [buttonSuffix, setButtonSuffix] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<
    { type: "success"; messageId: string } | { type: "error"; message: string } | null
  >(null);

  const selected = useMemo(
    () => templates.find((t) => t.name === selectedName) ?? null,
    [templates, selectedName]
  );

  const bodyComponent = selected ? getBodyComponent(selected) : null;
  const headerComponent = selected ? getHeaderComponent(selected) : null;
  const urlButton = selected ? getUrlButton(selected) : null;
  const bodyIndices = bodyComponent?.text ? placeholderIndices(bodyComponent.text) : [];
  const headerFormat = headerComponent?.format?.toUpperCase();

  function openTemplate(t: MetaMessageTemplate) {
    setSelectedName(t.name);
    setSendResult(null);
    const body = getBodyComponent(t);
    const indices = body?.text ? placeholderIndices(body.text) : [];
    const initial: Record<number, string> = {};
    for (const n of indices) {
      initial[n] = `Sample ${n}`;
    }
    setBodyValues(initial);
    const hdr = getHeaderComponent(t);
    if (hdr?.format?.toUpperCase() === "IMAGE") {
      setHeaderUrl(sampleOgImageUrl);
    } else if (hdr?.format?.toUpperCase() === "DOCUMENT") {
      setHeaderUrl("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    } else {
      setHeaderUrl("");
    }
    setButtonSuffix("");
  }

  function closePanel() {
    setSelectedName(null);
    setSendResult(null);
  }

  async function handleSend() {
    if (!selected) return;
    setSending(true);
    setSendResult(null);
    try {
      const bodyParams = bodyIndices.map((n) => bodyValues[n] ?? "");
      const result = await sendWhatsAppTemplateTest({
        to: phone,
        dialCode,
        templateName: selected.name,
        language: selected.language,
        status: selected.status,
        bodyParams,
        headerImageUrl: headerFormat === "IMAGE" ? headerUrl : undefined,
        headerDocumentUrl: headerFormat === "DOCUMENT" ? headerUrl : undefined,
        buttonUrlSuffix: urlButton ? buttonSuffix : undefined,
      });
      if (result.ok) {
        setSendResult({ type: "success", messageId: result.messageId });
      } else {
        setSendResult({ type: "error", message: result.error });
      }
    } catch (err) {
      setSendResult({
        type: "error",
        message: err instanceof Error ? err.message : "Send failed",
      });
    } finally {
      setSending(false);
    }
  }

  const canSend = selected?.status === "APPROVED" && phone.trim().length > 0 && !sending;

  return (
    <div className="ag-fade-in flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-3">
        {listError ? (
          <div
            className="rounded-xl border p-4 text-[13px]"
            style={{
              borderColor: "color-mix(in srgb, var(--error) 40%, var(--border))",
              background: "color-mix(in srgb, var(--error) 8%, transparent)",
              color: "var(--error)",
            }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{listError}</span>
            </div>
          </div>
        ) : null}

        {!listError && templates.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center text-[13px] text-[var(--text-secondary)]">
            No templates returned from Meta. Check WABA ID and access token scopes.
          </div>
        ) : null}

        {templates.map((t) => {
          const { color, Icon } = statusStyle(t.status);
          const isActive = selectedName === t.name;
          return (
            <button
              key={`${t.name}-${t.language}`}
              type="button"
              onClick={() => openTemplate(t)}
              className={`flex w-full items-center gap-3 rounded-xl border bg-[var(--surface-card)] p-4 text-left transition-colors hover:border-[var(--accent)] ${
                isActive ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px] font-medium text-[var(--text-primary)]">{t.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                  <span>{t.language}</span>
                  <span>·</span>
                  <span>{t.category}</span>
                </div>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  color,
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                }}
              >
                <Icon className="h-3 w-3" />
                {t.status}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="w-full shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 lg:sticky lg:top-6 lg:w-[420px]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">{selected.name}</h2>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {selected.language} · {selected.category}
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {bodyComponent?.text ? (
            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              <p className="mb-2 font-mono text-[10px] uppercase text-[var(--text-tertiary)]">Body preview</p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">
                {highlightPlaceholders(bodyComponent.text)}
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            {bodyIndices.map((n) => (
              <label key={n} className="block">
                <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                  Body variable {`{{${n}}}`}
                </span>
                <input
                  type="text"
                  className={`${inputCls} mt-1`}
                  value={bodyValues[n] ?? ""}
                  onChange={(e) => setBodyValues((v) => ({ ...v, [n]: e.target.value }))}
                />
              </label>
            ))}

            {headerFormat === "IMAGE" || headerFormat === "DOCUMENT" ? (
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                  Header {headerFormat === "IMAGE" ? "image" : "document"} URL
                </span>
                <input
                  type="url"
                  className={`${inputCls} mt-1`}
                  value={headerUrl}
                  onChange={(e) => setHeaderUrl(e.target.value)}
                  placeholder={headerFormat === "IMAGE" ? sampleOgImageUrl : "https://…"}
                />
              </label>
            ) : null}

            {urlButton ? (
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                  URL button suffix
                </span>
                <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                  Base: {urlButton.url?.replace(/\{\{\d+\}\}/, "…")}
                </p>
                <input
                  type="text"
                  className={`${inputCls} mt-1`}
                  value={buttonSuffix}
                  onChange={(e) => setButtonSuffix(e.target.value)}
                  placeholder="e.g. test-token or zuva-solar"
                />
              </label>
            ) : null}

            <div className="border-t border-[var(--border)] pt-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                  Country dial code
                </span>
                <select
                  className={`${inputCls} mt-1`}
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value as DialCodeOption)}
                >
                  {DIAL_CODES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
                  Send test to (your WhatsApp number)
                </span>
                <input
                  type="tel"
                  className={`${inputCls} mt-1`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 77 123 4567"
                />
              </label>
            </div>

            {selected.status !== "APPROVED" ? (
              <p className="text-[12px]" style={{ color: "var(--warning)" }}>
                Only APPROVED templates can be sent. This template is {selected.status}.
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canSend}
              onClick={() => void handleSend()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground, #000000)",
              }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Send test"}
            </button>

            {sendResult?.type === "success" ? (
              <div
                className="flex items-start gap-2 rounded-xl border p-3 text-[13px]"
                style={{
                  borderColor: "color-mix(in srgb, var(--success) 40%, var(--border))",
                  background: "color-mix(in srgb, var(--success) 8%, transparent)",
                  color: "var(--success)",
                }}
              >
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Message sent</p>
                  <p className="mt-1 break-all font-mono text-[11px] opacity-90">ID: {sendResult.messageId}</p>
                </div>
              </div>
            ) : null}

            {sendResult?.type === "error" ? (
              <div
                className="flex items-start gap-2 rounded-xl border p-3 text-[13px]"
                style={{
                  borderColor: "color-mix(in srgb, var(--error) 40%, var(--border))",
                  background: "color-mix(in srgb, var(--error) 8%, transparent)",
                  color: "var(--error)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Send failed</p>
                  <p className="mt-1 text-[12px] leading-snug">{sendResult.message}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="hidden w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-card)] p-8 text-center text-[13px] text-[var(--text-secondary)] lg:block lg:w-[420px]">
          Select a template to configure variables and send a test message.
        </div>
      )}
    </div>
  );
}
