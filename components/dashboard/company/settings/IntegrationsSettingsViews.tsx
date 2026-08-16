"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
import { Badge, Button, Skeleton } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { WhatsAppConnectionSettings } from "@/components/client-settings/WhatsAppConnectionSettings";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import type { SafeWhatsAppConnection } from "@/lib/whatsapp/providers/types";

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
}: {
  facebookConnected: boolean;
  facebookPageName: string | null;
  helpEmail?: string | null;
  onManageWhatsApp: () => void;
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
