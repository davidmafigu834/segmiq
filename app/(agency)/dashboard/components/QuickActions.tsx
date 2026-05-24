"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Building2, Upload } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";

export function QuickActions() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pb-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/leads")}
          className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <UserPlus size={14} strokeWidth={2} />
          New lead
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/clients")}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <Building2 size={14} strokeWidth={2} />
          Add client
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <Upload size={14} strokeWidth={2} />
          Import leads
        </button>
      </div>

      {showImport ? (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onSuccess={() => setShowImport(false)}
        />
      ) : null}
    </>
  );
}
