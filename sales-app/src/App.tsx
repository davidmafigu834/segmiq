import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AUTH_EXPIRED_EVENT } from "./lib/api";
import { getPendingCount, subscribeCallLogQueue, syncQueue } from "./lib/call-log-queue";
import { fetchDashboard, fetchLeads } from "./lib/leads";
import { isLoggedIn, logout, getUserName } from "./lib/auth";
import { useOnline } from "./hooks/useOnline";
import { Login } from "./screens/Login";
import { Today } from "./screens/Today";
import { Leads } from "./screens/Leads";
import { FollowUps } from "./screens/FollowUps";
import { LeadDetail } from "./screens/LeadDetail";
import { Sync } from "./screens/Sync";
import { More } from "./screens/More";
import { LogCallSheet } from "./components/LogCallSheet";
import { AddLeadSheet } from "./components/AddLeadSheet";
import type { TabId } from "./components/TabBar";
import type { LeadRow } from "./lib/types";
import { isToday } from "./screens/date-utils";

type View =
  | { kind: "tab"; tab: TabId }
  | { kind: "lead"; leadId: string }
  | { kind: "sync" };

export default function App() {
  const online = useOnline();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ kind: "tab", tab: "today" });
  const [authExpiredMsg, setAuthExpiredMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [activeLeads, setActiveLeads] = useState<LeadRow[]>([]);
  const [followUpBadge, setFollowUpBadge] = useState(0);
  const [syncBadge, setSyncBadge] = useState(0);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [logLeadId, setLogLeadId] = useState<string | undefined>();
  const [logChannel, setLogChannel] = useState<"call" | "whatsapp">("call");
  const [returnTab, setReturnTab] = useState<TabId>("today");

  const refreshBadges = useCallback(async () => {
    setSyncBadge(await getPendingCount());
    try {
      const rows = await fetchLeads();
      const active = rows.filter((l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status));
      setActiveLeads(active);
      setFollowUpBadge(
        active.filter((l) => l.follow_up_date && isToday(new Date(l.follow_up_date))).length
      );
    } catch {
      try {
        const d = await fetchDashboard();
        setActiveLeads(d.allActiveLeads);
        setFollowUpBadge(d.numbers.followUpToday);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const ok = await isLoggedIn();
    setAuthed(ok);
    if (ok) {
      setUserName((await getUserName()) ?? "");
      void refreshBadges();
    }
  }, [refreshBadges]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handler = () => {
      setAuthExpiredMsg("Your session expired. Please sign in again.");
      void logout().then(() => {
        setView({ kind: "tab", tab: "today" });
        setAuthed(false);
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  useEffect(() => subscribeCallLogQueue(() => void refreshBadges()), [refreshBadges]);

  useEffect(() => {
    if (!online || !authed) return;
    void syncQueue().then(() => refreshBadges());
  }, [online, authed, refreshBadges]);

  useEffect(() => {
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive && authed) void refreshBadges();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [authed, refreshBadges]);

  function handleTabChange(tab: TabId) {
    if (tab === "add") {
      setAddLeadOpen(true);
      return;
    }
    setView({ kind: "tab", tab });
  }

  function openLogSheet(leadId?: string, channel: "call" | "whatsapp" = "call") {
    setLogLeadId(leadId);
    setLogChannel(channel);
    setLogSheetOpen(true);
  }

  function openLead(lead: LeadRow) {
    if (view.kind === "tab") setReturnTab(view.tab);
    setView({ kind: "lead", leadId: lead.id });
  }

  const handleHardwareBack = useCallback(() => {
    if (addLeadOpen) {
      setAddLeadOpen(false);
      return;
    }
    if (logSheetOpen) {
      setLogSheetOpen(false);
      return;
    }

    if (!authed) {
      void CapApp.exitApp();
      return;
    }

    if (view.kind === "lead") {
      setView({ kind: "tab", tab: returnTab });
      return;
    }

    if (view.kind === "sync") {
      setView({ kind: "tab", tab: "more" });
      return;
    }

    if (view.kind === "tab") {
      if (view.tab === "today") {
        void CapApp.exitApp();
      } else {
        setView({ kind: "tab", tab: "today" });
      }
    }
  }, [addLeadOpen, authed, logSheetOpen, returnTab, view]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener("backButton", handleHardwareBack);
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [handleHardwareBack]);

  function handleLoggedOut() {
    setView({ kind: "tab", tab: "today" });
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg-primary">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!authed) {
    return (
      <Login
        expiredMessage={authExpiredMsg}
        onSuccess={() => {
          setAuthExpiredMsg("");
          void checkAuth().then(() => setAuthed(true));
        }}
      />
    );
  }

  if (view.kind === "lead") {
    return (
      <>
        <LeadDetail
          leadId={view.leadId}
          userName={userName}
          onBack={() => setView({ kind: "tab", tab: returnTab })}
          onLogCall={(id, ch) => openLogSheet(id, ch ?? "call")}
        />
        <LogCallSheet
          open={logSheetOpen}
          leads={activeLeads}
          initialLeadId={logLeadId}
          initialChannel={logChannel}
          online={online}
          onClose={() => setLogSheetOpen(false)}
          onLogged={() => void refreshBadges()}
        />
        <AddLeadSheet
          open={addLeadOpen}
          online={online}
          onClose={() => setAddLeadOpen(false)}
          onCreated={(leadId) => {
            void refreshBadges();
            setView({ kind: "lead", leadId });
          }}
        />
      </>
    );
  }

  if (view.kind === "sync") {
    return (
      <>
        <Sync
          onTabChange={handleTabChange}
          followUpBadge={followUpBadge}
          syncBadge={syncBadge}
          onSyncComplete={() => void refreshBadges()}
        />
        <LogCallSheet
          open={logSheetOpen}
          leads={activeLeads}
          initialLeadId={logLeadId}
          initialChannel={logChannel}
          online={online}
          onClose={() => setLogSheetOpen(false)}
          onLogged={() => void refreshBadges()}
        />
        <AddLeadSheet
          open={addLeadOpen}
          online={online}
          onClose={() => setAddLeadOpen(false)}
          onCreated={(leadId) => {
            void refreshBadges();
            setView({ kind: "lead", leadId });
          }}
        />
      </>
    );
  }

  const tabProps = {
    userName,
    onTabChange: handleTabChange,
    onOpenLead: openLead,
    onLogCall: (leadId?: string, channel?: "call" | "whatsapp") =>
      openLogSheet(leadId, channel ?? "call"),
    followUpBadge,
    syncBadge,
  };

  let screen = null;
  switch (view.tab) {
    case "today":
      screen = <Today {...tabProps} />;
      break;
    case "leads":
      screen = <Leads {...tabProps} />;
      break;
    case "followups":
      screen = <FollowUps {...tabProps} />;
      break;
    case "more":
      screen = (
        <More
          {...tabProps}
          onLogout={() => void logout().then(handleLoggedOut)}
          onOpenSync={() => setView({ kind: "sync" })}
        />
      );
      break;
    default:
      screen = <Today {...tabProps} />;
  }

  return (
    <>
      {screen}
      <button
        type="button"
        onClick={() => openLogSheet()}
        aria-label="Log a call"
        className="fixed right-5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bg-quaternary text-accent shadow-lg ring-1 ring-border"
      >
        <Phone size={22} />
      </button>
      <LogCallSheet
        open={logSheetOpen}
        leads={activeLeads}
        initialLeadId={logLeadId}
        initialChannel={logChannel}
        online={online}
        onClose={() => setLogSheetOpen(false)}
        onLogged={() => void refreshBadges()}
      />
      <AddLeadSheet
        open={addLeadOpen}
        online={online}
        onClose={() => setAddLeadOpen(false)}
        onCreated={(leadId) => {
          void refreshBadges();
          if (view.kind === "tab") setReturnTab(view.tab);
          setView({ kind: "lead", leadId });
        }}
      />
    </>
  );
}
