"use client";

import { useEffect, useRef, useState } from "react";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

type ClientOption = { id: string; name: string };

type Props = {
  clientId?: string;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
};

const CSV_TEMPLATE =
  "name,phone,email,budget,source,notes,assigned_to_email\nJohn Doe,+263771234567,john@example.com,5000,MANUAL,First contact,sales@company.com\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportLeadsModal({ clientId: initialClientId, onClose, onSuccess }: Props) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialClientId) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data) => {
          const list = (data.clients ?? []) as ClientOption[];
          setClients(list);
          if (list.length > 0 && !selectedClientId) {
            setSelectedClientId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [initialClientId, selectedClientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedClientId) return;

    setLoading(true);
    setError("");
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("clientId", selectedClientId);

    try {
      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setResult(data as ImportResult);
        onSuccess(data as ImportResult);
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--ag-surface, #0a0a0a)",
          border: "0.5px solid var(--ag-border, #2a2a2a)",
          borderRadius: 16,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--ag-font-display)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--ag-text-primary, #fff)",
            }}
          >
            Import leads from CSV
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--ag-text-tertiary, #666)",
              cursor: "pointer",
              padding: 4,
              fontSize: 16,
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit}>
            {!initialClientId && clients.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ag-text-secondary, #aaa)",
                    marginBottom: 6,
                  }}
                >
                  Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    height: 36,
                    background: "var(--ag-surface-2, #111)",
                    border: "0.5px solid var(--ag-border, #2a2a2a)",
                    borderRadius: 8,
                    color: "var(--ag-text-primary, #fff)",
                    fontSize: 13,
                    padding: "0 10px",
                  }}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ag-text-secondary, #aaa)",
                  }}
                >
                  CSV file
                </label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ag-lime, #d4ff4f)",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "var(--ag-font-body)",
                  }}
                >
                  <i className="ti ti-download" style={{ marginRight: 4 }} />
                  Download template
                </button>
              </div>

              <div
                style={{
                  border: `1px dashed ${file ? "var(--ag-lime, #d4ff4f)" : "var(--ag-border, #2a2a2a)"}`,
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--ag-surface-2, #111)",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <i
                  className="ti ti-table-import"
                  style={{
                    fontSize: 24,
                    color: file ? "var(--ag-lime, #d4ff4f)" : "var(--ag-text-tertiary, #666)",
                    display: "block",
                    marginBottom: 8,
                  }}
                />
                {file ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ag-text-primary, #fff)" }}>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ag-text-secondary, #aaa)" }}>
                      Click to select CSV file
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--ag-text-tertiary, #666)" }}>
                      Required columns: name, phone
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div
              style={{
                background: "var(--ag-surface-2, #111)",
                border: "0.5px solid var(--ag-border, #2a2a2a)",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 20,
                fontSize: 12,
                color: "var(--ag-text-tertiary, #666)",
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--ag-text-secondary, #aaa)" }}>
                CSV format
              </p>
              <p style={{ margin: 0 }}>
                Required: <strong>name</strong>, <strong>phone</strong>
                <br />
                Optional: email, budget, source, notes, assigned_to_email
                <br />
                Valid sources: FACEBOOK, LANDING_PAGE, MANUAL, REFERRAL
              </p>
            </div>

            {error && (
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  color: "#ef4444",
                  background: "#fef2f2",
                  borderRadius: 6,
                  padding: "8px 12px",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  height: 38,
                  background: "var(--ag-surface-2, #111)",
                  border: "0.5px solid var(--ag-border, #2a2a2a)",
                  borderRadius: 8,
                  color: "var(--ag-text-secondary, #aaa)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--ag-font-body)",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !file || !selectedClientId}
                style={{
                  flex: 1,
                  height: 38,
                  background: "var(--ag-lime, #d4ff4f)",
                  border: "none",
                  borderRadius: 8,
                  color: "var(--ag-lime-fg, #000)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading || !file || !selectedClientId ? "not-allowed" : "pointer",
                  opacity: loading || !file || !selectedClientId ? 0.6 : 1,
                  fontFamily: "var(--ag-font-body)",
                }}
              >
                {loading ? "Importing…" : "Import leads"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              style={{
                background: result.imported > 0 ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${result.imported > 0 ? "#bbf7d0" : "#fecaca"}`,
                borderRadius: 10,
                padding: "16px 18px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 28,
                  fontWeight: 700,
                  color: result.imported > 0 ? "#16a34a" : "#dc2626",
                }}
              >
                {result.imported}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                leads imported
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ag-text-secondary, #aaa)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Skipped rows
                </p>
                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 16px",
                    fontSize: 12,
                    color: "var(--ag-text-tertiary, #666)",
                    maxHeight: 160,
                    overflowY: "auto",
                    lineHeight: 1.8,
                  }}
                >
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                height: 38,
                background: "var(--ag-lime, #d4ff4f)",
                border: "none",
                borderRadius: 8,
                color: "var(--ag-lime-fg, #000)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--ag-font-body)",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
