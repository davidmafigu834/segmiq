"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";

export function QuickActionBar() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);

  const actions = [
    {
      label: "New lead",
      icon: "ti-user-plus",
      primary: true,
      action: () => router.push("/dashboard/leads"),
    },
    {
      label: "Add client",
      icon: "ti-building",
      primary: false,
      action: () => router.push("/dashboard/clients"),
    },
    {
      label: "Import leads",
      icon: "ti-upload",
      primary: false,
      action: () => setShowImport(true),
    },
    {
      label: "Invite salesperson",
      icon: "ti-user-share",
      primary: false,
      action: () => router.push("/dashboard/settings"),
    },
  ];

  return (
    <>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 0 20px",
        flexWrap: "wrap",
      }}
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.action}
          style={{
            height: 34,
            padding: "0 14px",
            background: a.primary ? "var(--ag-lime)" : "var(--ag-surface-2)",
            color: a.primary ? "var(--ag-lime-fg)" : "var(--ag-text-secondary)",
            border: a.primary ? "none" : "0.5px solid var(--ag-border)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--ag-font-body)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          <i className={`ti ${a.icon}`} style={{ fontSize: 13 }} />
          {a.label}
        </button>
      ))}
    </div>

    {showImport && (
      <ImportLeadsModal
        onClose={() => setShowImport(false)}
        onSuccess={() => setShowImport(false)}
      />
    )}
    </>
  );
}
