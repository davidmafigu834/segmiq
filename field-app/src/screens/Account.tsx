import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";
import { apiGet } from "../lib/api";
import { getClientId, getRole, getUserName, logout, type CloudClient } from "../lib/auth";
import { APP_NAME, APP_VERSION, CLOUD_LINKS } from "../lib/app-info";
import { AvatarInitials, FWSectionLabel } from "../components/fw";

type Props = {
  onClose: () => void;
  onLoggedOut: () => void;
};

function roleLabel(role: string | null): string {
  if (role === "AGENCY_ADMIN") return "Agency admin";
  if (role === "CLIENT_MANAGER") return "Client manager";
  if (role === "SALESPERSON") return "Field team";
  return "Cloud user";
}

export function Account({ onClose, onLoggedOut }: Props) {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const [name, userRole, clientId] = await Promise.all([
        getUserName(),
        getRole(),
        getClientId(),
      ]);
      setUserName(name ?? "");
      setRole(userRole);

      if (!clientId) return;
      const res = await apiGet<CloudClient[] | { error?: string }>("/api/cloud/app/clients");
      if (Array.isArray(res.data)) {
        const match = res.data.find((c) => c.id === clientId);
        if (match) setClientName(match.name);
      }
    })();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    onLoggedOut();
  }

  function openUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <div className="flex items-center gap-3 border-b border-black/[0.06] bg-canvas px-4 py-4">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-black/[0.08]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={2} />
        </button>
        <div>
          <FWSectionLabel>Menu</FWSectionLabel>
          <p className="font-fw-display text-[22px] leading-tight text-ink">Account</p>
        </div>
      </div>

      <main
        className="flex-1 px-5 py-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* User card — mirrors Cloud More page */}
        <div className="mb-5 flex items-center gap-3.5 rounded-[20px] bg-ink p-5">
          <AvatarInitials name={userName || "User"} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-fw-display text-base text-white">{userName || "Signed in"}</p>
            <p className="font-fw-body text-xs text-white/50">{roleLabel(role)}</p>
            {clientName && (
              <p className="mt-1 truncate font-fw-body text-[11px] text-lime">{clientName}</p>
            )}
          </div>
        </div>

        <FWSectionLabel className="mb-3 px-1">Account</FWSectionLabel>
        <div className="mb-6 overflow-hidden rounded-[20px] border border-black/[0.08] bg-card">
          <button
            type="button"
            onClick={() => openUrl(CLOUD_LINKS.settings)}
            className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunken">
              <Settings className="h-4 w-4 text-soil-3" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-fw-body text-[13px] font-semibold text-ink">Profile & settings</p>
              <p className="font-fw-body text-[11px] text-warm">Password, business info, watermark</p>
            </div>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-warm-muted" />
          </button>
          <button
            type="button"
            onClick={() => openUrl(CLOUD_LINKS.dashboard)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunken">
              <UserCircle className="h-4 w-4 text-soil-3" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-fw-body text-[13px] font-semibold text-ink">Open Cloud dashboard</p>
              <p className="font-fw-body text-[11px] text-warm">Full web app on cloud.segmiq.com</p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-warm-muted" />
          </button>
        </div>

        <FWSectionLabel className="mb-3 px-1">Support</FWSectionLabel>
        <div className="mb-6 overflow-hidden rounded-[20px] border border-black/[0.08] bg-card">
          <button
            type="button"
            onClick={() => openUrl(CLOUD_LINKS.help)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunken">
              <HelpCircle className="h-4 w-4 text-soil-3" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-fw-body text-[13px] font-semibold text-ink">Help & FAQ</p>
              <p className="font-fw-body text-[11px] text-warm">How to use Segmiq Cloud</p>
            </div>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-warm-muted" />
          </button>
        </div>

        <div className="mb-6 rounded-[20px] border border-black/[0.08] bg-card px-4 py-3.5">
          <p className="font-fw-body text-[13px] font-semibold text-ink">{APP_NAME}</p>
          <p className="font-fw-body text-[11px] text-warm">Version {APP_VERSION}</p>
        </div>

        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3.5 font-fw-body text-sm font-semibold text-red-600 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </main>
    </div>
  );
}
