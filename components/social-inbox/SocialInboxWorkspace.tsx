"use client";

import { useEffect, useState } from "react";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { ToastProvider } from "@/components/sales/ui/Toast";
import type { UserRole } from "@/types";
import { SocialInboxApp } from "./SocialInboxApp";
import { useSocialInboxSession } from "./useSocialInboxSession";

type Pane = "queue" | "thread" | "intel";

export function SocialInboxSalesHost(props: {
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
  tasksBadge: number;
  isSolo: boolean;
  quotesBase: string;
  leadsBase: string;
  dealsBase: string;
  channelsHref: string;
  viewerId?: string;
}) {
  const [pane, setPane] = useState<Pane>("queue");
  return (
    <SalesAppShell
      userName={props.userName}
      userRoleLabel={props.userRoleLabel}
      avatarUrl={props.avatarUrl}
      unreadNotifications={props.unreadNotifications}
      notificationRole={props.notificationRole}
      whatsappBadge={props.whatsappBadge}
      tasksBadge={props.tasksBadge}
      isSolo={props.isSolo}
      showDefaultHeader={false}
      contentFlush
      hideMobileChrome={pane !== "queue"}
    >
      <SocialInboxClient
        quotesBase={props.quotesBase}
        leadsBase={props.leadsBase}
        dealsBase={props.dealsBase}
        channelsHref={props.channelsHref}
        viewerId={props.viewerId ?? "demo-rep"}
        canViewUnassigned={false}
        canAssign
        canManageChannels={false}
        canReply
        onPaneChange={setPane}
      />
    </SalesAppShell>
  );
}

export function SocialInboxCompanyHost(props: {
  userName: string;
  companyName: string;
  companyLogoUrl?: string | null;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
  quotesBase: string;
  leadsBase: string;
  dealsBase: string;
  channelsHref: string;
  viewerId?: string;
}) {
  const [pane, setPane] = useState<Pane>("queue");
  return (
    <ToastProvider>
      <CompanyWorkspaceShell
        companyName={props.companyName}
        companyLogoUrl={props.companyLogoUrl}
        userName={props.userName}
        avatarUrl={props.avatarUrl}
        unreadNotifications={props.unreadNotifications}
        notificationRole={props.notificationRole}
        whatsappBadge={props.whatsappBadge}
        immersive
        preferCollapsedSidebar
        hideMobileChrome={pane !== "queue"}
      >
        <SocialInboxClient
          quotesBase={props.quotesBase}
          leadsBase={props.leadsBase}
          dealsBase={props.dealsBase}
          channelsHref={props.channelsHref}
          viewerId={props.viewerId ?? "demo-rep"}
          canViewUnassigned
          canAssign
          canManageChannels
          canReply
          onPaneChange={setPane}
        />
      </CompanyWorkspaceShell>
    </ToastProvider>
  );
}

function SocialInboxClient(props: {
  quotesBase: string;
  leadsBase: string;
  dealsBase: string;
  channelsHref: string;
  viewerId: string;
  canViewUnassigned: boolean;
  canAssign: boolean;
  canManageChannels: boolean;
  canReply: boolean;
  onPaneChange: (pane: Pane) => void;
}) {
  const session = useSocialInboxSession({
    viewerId: props.viewerId,
    canViewUnassigned: props.canViewUnassigned,
    canAssign: props.canAssign,
    canManageChannels: props.canManageChannels,
    canReply: props.canReply,
    quotesBase: props.quotesBase,
    leadsBase: props.leadsBase,
    dealsBase: props.dealsBase,
  });

  useEffect(() => {
    props.onPaneChange(session.mobilePane);
  }, [props.onPaneChange, session.mobilePane]);

  return (
    <SocialInboxApp
      session={session}
      channelsHref={props.channelsHref}
      isDev={process.env.NODE_ENV !== "production"}
    />
  );
}
