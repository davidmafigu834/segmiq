import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
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
  const [logLeadId, setLogLeadId] = useState<string | undefined>();
  const [logChannel, setLogChannel] = useState<"call" | "whatsapp">("call");

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
    if (tab === "log") {
      openLogSheet();
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
    setView({ kind: "lead", leadId: lead.id });
  }

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
          onBack={() => setView({ kind: "tab", tab: "leads" })}
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
      <LogCallSheet
        open={logSheetOpen}
        leads={activeLeads}
        initialLeadId={logLeadId}
        initialChannel={logChannel}
        online={online}
        onClose={() => setLogSheetOpen(false)}
        onLogged={() => void refreshBadges()}
      />
    </>
  );
}
