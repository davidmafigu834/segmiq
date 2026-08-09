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
        className="fixed bottom-[var(--sales-mobile-fab-bottom,calc(env(safe-area-inset-bottom)+1rem))] right-4 z-[var(--sales-z-dropdown,40)] hidden h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 text-[var(--accent-foreground)] shadow-[var(--shadow-lg)] transition-colors hover:bg-[var(--accent-hover)] layout:bottom-6 layout:right-5 layout:flex"
        aria-label="Log a call"
      >
        <Phone size={17} />
        <span className="text-[13px] font-semibold">Log call</span>
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
