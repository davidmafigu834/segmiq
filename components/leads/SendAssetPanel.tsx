"use client";

import { useState, useEffect } from "react";

type Package = {
  id: string;
  name: string;
  price_from: number | null;
  price_to: number | null;
  price_label: string | null;
  currency: string;
  description: string | null;
};

type Project = {
  id: string;
  title: string;
  category: string | null;
};

type Document = {
  id: string;
  name: string;
  description: string | null;
  file_type: string | null;
};

type AssetType =
  | "PORTFOLIO"
  | "PROJECT"
  | "PRICING_PACKAGE"
  | "TESTIMONIALS"
  | "DOCUMENT"
  | "CUSTOM_MESSAGE";

type Props = {
  leadId: string;
  clientId: string;
  leadPhone?: string | null;
  onSent: () => void;
};

const QUICK_ACTIONS: Array<{
  type: AssetType;
  label: string;
  icon: string;
  color: string;
}> = [
  { type: "PORTFOLIO", label: "Portfolio", icon: "ti-layout-grid", color: "#3dd68c" },
  { type: "PROJECT", label: "Project", icon: "ti-building", color: "#60a5fa" },
  { type: "PRICING_PACKAGE", label: "Pricing", icon: "ti-tag", color: "#D4FF4F" },
  { type: "TESTIMONIALS", label: "Reviews", icon: "ti-star", color: "#f5a623" },
  { type: "DOCUMENT", label: "Document", icon: "ti-file-text", color: "#a78bfa" },
  { type: "CUSTOM_MESSAGE", label: "Message", icon: "ti-message", color: "#71717a" },
];

export function SendAssetPanel({ leadId, clientId, leadPhone, onSent }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/clients/${clientId}/packages`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/projects`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/documents`).then((r) => r.json()),
    ])
      .then(([pkgData, projData, docData]) => {
        if (cancelled) return;
        // packages route returns { packages: [...] }
        setPackages((pkgData as { packages?: Package[] }).packages ?? []);
        // projects route returns the raw array directly (not wrapped)
        setProjects(Array.isArray(projData) ? (projData as Project[]) : []);
        // documents route returns { documents: [...] }
        setDocuments((docData as { documents?: Document[] }).documents ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function selectType(type: AssetType) {
    setSelectedType(selectedType === type ? null : type);
    setSelectedAssetId("");
    setCustomMessage("");
    setResult(null);
    setErrorMsg("");
  }

  function canSend(): boolean {
    if (!selectedType || !leadPhone) return false;
    if (selectedType === "PROJECT" && !selectedAssetId) return false;
    if (selectedType === "PRICING_PACKAGE" && !selectedAssetId) return false;
    if (selectedType === "DOCUMENT" && !selectedAssetId) return false;
    if (selectedType === "CUSTOM_MESSAGE" && !customMessage.trim()) return false;
    return true;
  }

  async function handleSend() {
    if (!canSend() || sending) return;
    setSending(true);
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/leads/${leadId}/send-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: selectedType,
          assetId: selectedAssetId || undefined,
          customMessage: customMessage || undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.ok) {
        setResult("success");
        setTimeout(() => {
          setSelectedType(null);
          setSelectedAssetId("");
          setCustomMessage("");
          setResult(null);
          onSent();
        }, 2000);
      } else {
        setResult("error");
        setErrorMsg(json.error ?? "Send failed");
      }
    } catch {
      setResult("error");
      setErrorMsg("Network error — try again");
    } finally {
      setSending(false);
    }
  }

  if (!leadPhone) {
    return (
      <div className="py-5 text-center">
        <i className="ti ti-phone-off block text-2xl text-ink-tertiary" />
        <p className="mt-2 text-[13px] text-ink-tertiary">
          No phone number — add one to enable sending
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
        Send to prospect via WhatsApp
      </p>

      {/* Quick action grid */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => selectType(action.type)}
            className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all"
            style={{
              background:
                selectedType === action.type
                  ? "rgba(212,255,79,0.06)"
                  : "var(--surface-card-alt)",
              borderColor:
                selectedType === action.type
                  ? "rgba(212,255,79,0.25)"
                  : "rgba(255,255,255,0.06)",
            }}
          >
            <i
              className={`ti ${action.icon} text-lg`}
              style={{
                color:
                  selectedType === action.type ? action.color : "var(--text-tertiary)",
              }}
            />
            <span
              className="text-[11px] font-semibold"
              style={{
                color:
                  selectedType === action.type
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
              }}
            >
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Secondary selector */}
      {selectedType === "PROJECT" && (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Select project
          </label>
          {loading ? (
            <p className="text-[12px] text-ink-tertiary">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-[12px] text-ink-tertiary">No public projects yet.</p>
          ) : (
            <select
              className="input-base w-full"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.category ? ` — ${p.category}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selectedType === "PRICING_PACKAGE" && (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Select package
          </label>
          {loading ? (
            <p className="text-[12px] text-ink-tertiary">Loading…</p>
          ) : packages.length === 0 ? (
            <p className="text-[12px] text-ink-tertiary">
              No packages yet — add some in client settings.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedAssetId(pkg.id)}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all"
                  style={{
                    background:
                      selectedAssetId === pkg.id
                        ? "rgba(212,255,79,0.06)"
                        : "var(--surface-card-alt)",
                    borderColor:
                      selectedAssetId === pkg.id
                        ? "rgba(212,255,79,0.25)"
                        : "rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[13px] font-semibold text-ink-primary">{pkg.name}</span>
                  <span className="text-[12px] text-ink-tertiary">
                    {pkg.price_label ??
                      (pkg.price_from
                        ? `${pkg.currency} ${pkg.price_from.toLocaleString()}`
                        : "Quoted")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedType === "DOCUMENT" && (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Select document
          </label>
          {loading ? (
            <p className="text-[12px] text-ink-tertiary">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-[12px] text-ink-tertiary">
              No documents yet — add some in client settings.
            </p>
          ) : (
            <select
              className="input-base w-full"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">Choose a document…</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selectedType === "CUSTOM_MESSAGE" && (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Your message
          </label>
          <textarea
            className="input-base w-full resize-none"
            rows={4}
            placeholder="Type your message to the prospect…"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
        </div>
      )}

      {/* Send button */}
      {selectedType && (
        <div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend() || sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition-all"
            style={{
              background:
                result === "success"
                  ? "rgba(61,214,140,0.12)"
                  : result === "error"
                  ? "rgba(255,68,68,0.12)"
                  : !canSend() || sending
                  ? "var(--surface-card-alt)"
                  : "var(--ag-lime, #D4FF4F)",
              color:
                result === "success"
                  ? "#3dd68c"
                  : result === "error"
                  ? "#ff6b6b"
                  : !canSend() || sending
                  ? "var(--text-tertiary)"
                  : "#0a0a0a",
              border:
                result === "success"
                  ? "0.5px solid rgba(61,214,140,0.2)"
                  : result === "error"
                  ? "0.5px solid rgba(255,68,68,0.2)"
                  : "none",
              cursor: !canSend() || sending ? "not-allowed" : "pointer",
            }}
          >
            {result === "success" ? (
              <>
                <i className="ti ti-check text-sm" />
                Sent successfully
              </>
            ) : result === "error" ? (
              <>
                <i className="ti ti-alert-circle text-sm" />
                {errorMsg || "Send failed — try again"}
              </>
            ) : sending ? (
              "Sending…"
            ) : (
              <>
                <i className="ti ti-brand-whatsapp text-sm" />
                Send via WhatsApp
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
