"use client";

import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const CSV_TEMPLATE =
  "name,phone,email,source,notes\nJohn Moyo,+263771234567,john@example.com,Phonebook,Met at expo\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportContactsModal({
  clientId,
  onClose,
  onSuccess,
}: {
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("clientId", clientId);

    try {
      const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setResult(data as ImportResult);
        onSuccess();
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import contacts</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Bulk add phonebook numbers as cold contacts — no leads created.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost grid h-9 w-9 place-items-center rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
            Download CSV template
          </button>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-quaternary)] px-4 py-8 text-center transition hover:border-[var(--border-hover)]">
            <Upload className="h-6 w-6 text-[var(--text-tertiary)]" strokeWidth={1.5} />
            <span className="text-[13px] text-[var(--text-secondary)]">
              {file ? file.name : "Click to choose CSV file"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

          {result ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-quaternary)] p-3 text-[13px] text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">
                Imported {result.imported} contact{result.imported === 1 ? "" : "s"}
              </p>
              {result.skipped > 0 ? (
                <p className="mt-1">Skipped {result.skipped} row{result.skipped === 1 ? "" : "s"}</p>
              ) : null}
              {result.errors.length > 0 ? (
                <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-4 text-[12px]">
                  {result.errors.slice(0, 8).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-[13px]">
              {result ? "Done" : "Cancel"}
            </button>
            {!result ? (
              <button
                type="submit"
                disabled={!file || loading}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)] disabled:opacity-50"
              >
                {loading ? "Importing…" : "Import"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
