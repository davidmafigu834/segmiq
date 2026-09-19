"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { Badge, Button, Skeleton, useSalesToast } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { WhatsAppConnectionSettings } from "@/components/client-settings/WhatsAppConnectionSettings";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";
import type { SafeSocialConnection } from "@/lib/social-inbox/types";
import { connectionStatusLabel } from "@/lib/social-inbox/display";

function whatsappStatusLabel(connection: SafeWhatsAppConnection | null): { label: string; tone: "success" | "warning" | "neutral" } {
  if (!connection) return { label: "Unknown", tone: "neutral" };
  if (connection.connected) return { label: "Connected", tone: "success" };
  if (connection.status === "RECONNECT_REQUIRED") return { label: "Reconnection required", tone: "warning" };
  if (["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(connection.status)) {
    return { label: "Connecting", tone: "warning" };
  }
  return { label: "Not connected", tone: "neutral" };
}

export function IntegrationsAppsSection({
  facebookConnected,
  facebookPageName,
  helpEmail,
  onManageWhatsApp,
  onManageChannels,
}: {
  facebookConnected: boolean;
  facebookPageName: string | null;
  helpEmail?: string | null;
  onManageWhatsApp: () => void;
  onManageChannels: () => void;
}) {
  const [connection, setConnection] = useState<SafeWhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/company/whatsapp/connection", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { connection?: SafeWhatsAppConnection };
        if (!cancelled) setConnection(body.connection ?? null);
      })
      .catch(() => {
        if (!cancelled) setConnection(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wa = whatsappStatusLabel(connection);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SettingsSectionCard title="Connected Apps" description="Only integrations that exist for this company.">
        {loading ? (
          <Skeleton className="h-16 w-full rounded-[10px]" />
        ) : (
          <button
            type="button"
            onClick={onManageWhatsApp}
            className="flex w-full items-center gap-3 rounded-[10px] px-2 py-3 text-left hover:bg-sales-surface-hover"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#ECFDF3] text-[#16A34A]">
              <SiWhatsapp size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-sales-text-primary">WhatsApp</span>
              <span className="mt-0.5 block text-[12px] text-sales-text-secondary">Sales Hub connection</span>
            </span>
            <Badge tone={wa.tone} appearance="soft">
              {wa.label}
            </Badge>
            <ChevronRight size={16} className="text-sales-text-muted" />
          </button>
        )}

        <div className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-2 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#1877F2]">
            <SiFacebook size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-sales-text-primary">Facebook Lead Ads</span>
            <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
              {facebookConnected
                ? facebookPageName || "Page connected"
                : "SegmiQ support connects Facebook Lead Ads for your company."}
            </span>
          </span>
          <Badge tone={facebookConnected ? "success" : "neutral"} appearance="soft">
            {facebookConnected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        {!facebookConnected && helpEmail ? (
          <Button
            variant="secondary"
            size="sm"
            className="ml-14"
            onClick={() => {
              window.location.href = `mailto:${helpEmail}?subject=${encodeURIComponent("Facebook Lead Ads connection")}`;
            }}
          >
            Contact support
          </Button>
        ) : null}

        <button
          type="button"
          onClick={onManageChannels}
          className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-2 py-3 text-left hover:bg-sales-surface-hover"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sales-brand-soft text-sales-text-primary">
            <SiInstagram size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-sales-text-primary">Social channels</span>
            <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
              Facebook Messenger, comments, and Instagram for Social Inbox
            </span>
          </span>
          <ChevronRight size={16} className="text-sales-text-muted" />
        </button>
      </SettingsSectionCard>
    </div>
  );
}

export function IntegrationsWhatsAppSection() {
  return <WhatsAppConnectionSettings embedded />;
}

export function IntegrationsWebsiteSection({ clientId }: { clientId: string }) {
  return (
    <SettingsSectionCard title="Website API" description="Capture leads from your website into this company.">
      <WebsiteIntegrationPanel clientId={clientId} />
    </SettingsSectionCard>
  );
}

function connectionTone(
  status: SafeSocialConnection["status"]
): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "disconnected") return "neutral";
  if (status === "auth_expired") return "danger";
  return "warning";
}

export function IntegrationsChannelsSection() {
  const { toast } = useSalesToast();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<SafeSocialConnection[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const social = searchParams.get("social");
    if (social === "connected") toast({ title: "Facebook and Instagram connected", tone: "success" });
    if (social === "denied") toast({ title: "Connection cancelled", tone: "warning" });
    if (social === "no_pages") toast({ title: "No Facebook Pages were available on that account", tone: "warning" });
    if (social === "unconfigured" || social === "token_failed") {
      toast({ title: "Meta is not fully configured for this environment", tone: "error" });
    }
  }, [searchParams, toast]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/social-inbox/connections", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        connections?: SafeSocialConnection[];
        metaConfigured?: boolean;
      };
      setConnections(body.connections ?? []);
      setMetaConfigured(body.metaConfigured !== false);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function disconnect(connectionId: string) {
    setBusyId(connectionId);
    try {
      const res = await fetch("/api/social-inbox/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", connectionId }),
      });
      if (!res.ok) {
        toast({ title: "Could not disconnect that channel", tone: "error" });
        return;
      }
      toast({ title: "Channel disconnected", tone: "success" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const facebook = connections.filter((c) => c.provider === "facebook");
  const instagram = connections.filter((c) => c.provider === "instagram");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SettingsSectionCard
        title="Social channels"
        description="Connect Facebook Pages and Instagram professional accounts for Social Inbox. WhatsApp stays in its own settings."
      >
        {!metaConfigured ? (
          <p className="mb-3 text-[13px] text-sales-text-secondary">
            Official Meta credentials are not configured in this environment. Salespeople can still preview Social Inbox with sample conversations.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              window.location.href = "/api/social-inbox/oauth/start";
            }}
            disabled={!metaConfigured}
          >
            Connect Facebook & Instagram
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Facebook" description="Page messages, comments, and advertisement comments.">
        {loading ? (
          <Skeleton className="h-16 w-full rounded-[10px]" />
        ) : facebook.length === 0 ? (
          <p className="text-[13px] text-sales-text-secondary">No Facebook Page connected yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {facebook.map((conn) => (
              <li key={conn.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#1877F2]">
                  <SiFacebook size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-sales-text-primary">
                    {conn.displayName || "Facebook Page"}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
                    {conn.isDemo ? "Sample connection" : conn.lastEventAt ? "Receiving events" : "Waiting for events"}
                  </span>
                </span>
                <Badge tone={connectionTone(conn.status)} appearance="soft">
                  {connectionStatusLabel(conn.status)}
                </Badge>
                {!conn.isDemo && conn.status !== "disconnected" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === conn.id}
                    onClick={() => void disconnect(conn.id)}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard title="Instagram" description="Direct messages and comments on posts, reels, and ads.">
        {loading ? (
          <Skeleton className="h-16 w-full rounded-[10px]" />
        ) : instagram.length === 0 ? (
          <p className="text-[13px] text-sales-text-secondary">
            Instagram connects through a Facebook Page with a linked professional account.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {instagram.map((conn) => (
              <li key={conn.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDF2F8] text-[#E1306C]">
                  <SiInstagram size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-sales-text-primary">
                    {conn.displayName || conn.username || "Instagram"}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
                    {conn.isDemo ? "Sample connection" : conn.username ? `@${conn.username}` : "Professional account"}
                  </span>
                </span>
                <Badge tone={connectionTone(conn.status)} appearance="soft">
                  {connectionStatusLabel(conn.status)}
                </Badge>
                {!conn.isDemo && conn.status !== "disconnected" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === conn.id}
                    onClick={() => void disconnect(conn.id)}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SettingsSectionCard>
    </div>
  );
}
