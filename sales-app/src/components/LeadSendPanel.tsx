import { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  Grid3X3,
  Loader2,
  MessageSquare,
  Star,
  Tag,
} from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { openWhatsApp } from "../lib/whatsapp";
import { CrmButton } from "./crm";

type AssetType =
  | "PORTFOLIO"
  | "PROJECT"
  | "PRICING_PACKAGE"
  | "TESTIMONIALS"
  | "DOCUMENT"
  | "CUSTOM_MESSAGE";

const QUICK_ACTIONS: Array<{
  type: AssetType;
  label: string;
  icon: typeof Grid3X3;
}> = [
  { type: "PORTFOLIO", label: "Portfolio", icon: Grid3X3 },
  { type: "PROJECT", label: "Project", icon: Building2 },
  { type: "PRICING_PACKAGE", label: "Pricing", icon: Tag },
  { type: "TESTIMONIALS", label: "Reviews", icon: Star },
  { type: "DOCUMENT", label: "Document", icon: FileText },
  { type: "CUSTOM_MESSAGE", label: "Message", icon: MessageSquare },
];

type Package = { id: string; name: string };
type Project = { id: string; title: string };
type Document = { id: string; name: string };

type Props = {
  leadId: string;
  clientId: string;
  leadPhone: string | null;
};

export function LeadSendPanel({ leadId, clientId, leadPhone }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiGet<{ packages?: Package[] }>(`/api/clients/${clientId}/packages`),
      apiGet<Project[] | { error?: string }>(`/api/clients/${clientId}/projects`),
      apiGet<{ documents?: Document[] }>(`/api/clients/${clientId}/documents`),
    ]).then(([pkgRes, projRes, docRes]) => {
      if (cancelled) return;
      setPackages(pkgRes.data.packages ?? []);
      setProjects(Array.isArray(projRes.data) ? projRes.data : []);
      setDocuments(docRes.data.documents ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!leadPhone) {
    return (
      <p className="py-8 text-center text-[14px] text-ink-tertiary">
        Add a phone number to send assets via WhatsApp.
      </p>
    );
  }

  async function handleSend() {
    if (!selectedType || sending) return;

    if (selectedType === "CUSTOM_MESSAGE") {
      if (!customMessage.trim()) {
        setError("Write a message first.");
        return;
      }
      openWhatsApp(leadPhone, customMessage.trim());
      return;
    }

    if (selectedType === "PROJECT" && !selectedAssetId) {
      setError("Pick a project.");
      return;
    }
    if (selectedType === "PRICING_PACKAGE" && !selectedAssetId) {
      setError("Pick a pricing package.");
      return;
    }
    if (selectedType === "DOCUMENT" && !selectedAssetId) {
      setError("Pick a document.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess(false);
    try {
      const res = await apiPost<{ error?: string }>(`/api/leads/${leadId}/send-asset`, {
        assetType: selectedType,
        assetId: selectedAssetId || undefined,
        customMessage: customMessage || undefined,
      });
      if (!res.ok) throw new Error(res.data.error ?? "Send failed");
      setSuccess(true);
      setSelectedType(null);
      setSelectedAssetId("");
      setCustomMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p className="eyebrow mb-3">Send via WhatsApp</p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const active = selectedType === action.type;
              return (
                <button
                  key={action.type}
                  type="button"
                  onClick={() => {
                    setSelectedType(active ? null : action.type);
                    setSelectedAssetId("");
                    setError("");
                    setSuccess(false);
                  }}
                  className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
                    active
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border bg-surface-card text-ink-tertiary"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[11px] font-semibold">{action.label}</span>
                </button>
              );
            })}
          </div>

          {selectedType === "PROJECT" ? (
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : null}

          {selectedType === "PRICING_PACKAGE" ? (
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary"
            >
              <option value="">Select package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}

          {selectedType === "DOCUMENT" ? (
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary"
            >
              <option value="">Select document</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : null}

          {selectedType === "CUSTOM_MESSAGE" ? (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              placeholder="Your message…"
              className="mb-4 w-full resize-none rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
            />
          ) : null}

          {error ? <p className="mb-3 text-[13px] text-[var(--error)]">{error}</p> : null}
          {success ? (
            <p className="mb-3 text-[13px] text-[var(--success)]">Sent via WhatsApp!</p>
          ) : null}

          {selectedType ? (
            <CrmButton className="w-full" disabled={sending} onClick={() => void handleSend()}>
              {sending ? "Sending…" : "Send"}
            </CrmButton>
          ) : null}
        </>
      )}
    </div>
  );
}
