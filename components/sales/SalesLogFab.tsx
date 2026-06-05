"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { QuickLogSheet } from "./QuickLogSheet";

export function SalesLogFab({ leads }: { leads: PriorityLead[] }) {
  const router = useRouter();
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [preselectedLeadId, setPreselectedLeadId] = useState("");
  const [logChannel, setLogChannel] = useState<"call" | "whatsapp">("call");

  function openLogSheet(leadId = "", channel: "call" | "whatsapp" = "call") {
    setPreselectedLeadId(leadId);
    setLogChannel(channel);
    setShowLogSheet(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openLogSheet("")}
        className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-[var(--shadow-accent-glow)] hover:bg-[var(--accent-hover)] transition-colors"
        aria-label="Log a call"
      >
        <Phone size={22} />
      </button>

      {showLogSheet && (
        <QuickLogSheet
          leads={leads}
          preselectedLeadId={preselectedLeadId}
          onClose={() => setShowLogSheet(false)}
          onSuccess={() => router.refresh()}
          defaultChannel={logChannel}
        />
      )}
    </>
  );
}

export function useSalesLogSheet() {
  const router = useRouter();
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [preselectedLeadId, setPreselectedLeadId] = useState("");
  const [logChannel, setLogChannel] = useState<"call" | "whatsapp">("call");

  function openLogSheet(leadId = "", channel: "call" | "whatsapp" = "call") {
    setPreselectedLeadId(leadId);
    setLogChannel(channel);
    setShowLogSheet(true);
  }

  function logSheetProps(leads: PriorityLead[]) {
    return {
      showLogSheet,
      openLogSheet,
      sheet: showLogSheet ? (
        <QuickLogSheet
          leads={leads}
          preselectedLeadId={preselectedLeadId}
          onClose={() => setShowLogSheet(false)}
          onSuccess={() => router.refresh()}
          defaultChannel={logChannel}
        />
      ) : null,
    };
  }

  return { openLogSheet, logSheetProps };
}
