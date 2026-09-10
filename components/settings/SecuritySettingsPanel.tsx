"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SettingsSectionCard } from "@/components/dashboard/company/settings/SettingsSectionCard";
import { Button, Input, Field } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { secureSignOut } from "@/components/auth/SessionLifecycle";
import { OrgSecurityPanel } from "@/components/settings/OrgSecurityPanel";

type SessionItem = {
  id: string;
  current: boolean;
  sessionType: string;
  browser: string;
  os: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  lastSeenLabel: string;
};

type SecurityEventItem = {
  id: string;
  type: string;
  createdAt: string;
  summary: string;
};

type MfaStatus = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  policy: "optional" | "recommended" | "required";
};

export function SecuritySettingsPanel({
  toast,
}: {
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [eventsOffset, setEventsOffset] = useState(0);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busyMfa, setBusyMfa] = useState(false);

  const [disablePw, setDisablePw] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, eRes, mRes, pRes] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch("/api/auth/security-events?limit=20&offset=0", { cache: "no-store" }),
        fetch("/api/auth/mfa", { cache: "no-store" }),
        fetch("/api/users/me/security-meta", { cache: "no-store" }),
      ]);
      if (sRes.ok) {
        const j = (await sRes.json()) as { sessions?: SessionItem[] };
        setSessions(j.sessions ?? []);
      }
      if (eRes.ok) {
        const j = (await eRes.json()) as { events?: SecurityEventItem[] };
        setEvents(j.events ?? []);
        setEventsOffset(20);
      }
      if (mRes.ok) {
        setMfa((await mRes.json()) as MfaStatus);
      }
      if (pRes.ok) {
        const j = (await pRes.json()) as { passwordChangedAt?: string | null };
        setPasswordChangedAt(j.passwordChangedAt ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changePassword() {
    if (newPw !== confirmPw) {
      toast({ title: "Passwords do not match.", tone: "error" });
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't update password");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast({ title: "Password updated.", tone: "success" });
      void load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update password", tone: "error" });
    } finally {
      setSavingPw(false);
    }
  }

  async function startMfaSetup() {
    setBusyMfa(true);
    setRecoveryCodes(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_start" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        qrDataUrl?: string;
        manualKey?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not start setup");
      setQrDataUrl(json.qrDataUrl ?? null);
      setManualKey(json.manualKey ?? null);
      setSetupOpen(true);
      setSetupCode("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Setup failed", tone: "error" });
    } finally {
      setBusyMfa(false);
    }
  }

  async function confirmMfaSetup() {
    setBusyMfa(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_confirm", code: setupCode }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        recoveryCodes?: string[];
      };
      if (!res.ok) throw new Error(json.error ?? "Invalid code");
      setRecoveryCodes(json.recoveryCodes ?? []);
      setQrDataUrl(null);
      setManualKey(null);
      setSetupCode("");
      toast({ title: "Two-step verification enabled.", tone: "success" });
      void load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not enable", tone: "error" });
    } finally {
      setBusyMfa(false);
    }
  }

  async function disableMfa() {
    setBusyMfa(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable",
          password: disablePw,
          totpCode: disableCode,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not disable");
      setManageOpen(false);
      setDisablePw("");
      setDisableCode("");
      toast({ title: "Two-step verification disabled.", tone: "success" });
      void load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not disable", tone: "error" });
    } finally {
      setBusyMfa(false);
    }
  }

  async function regenerateCodes() {
    setBusyMfa(true);
    try {
      const step = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "step_up", totpCode: disableCode || undefined, password: disablePw || undefined }),
      });
      if (!step.ok && !disableCode) {
        toast({ title: "Enter your authenticator code first.", tone: "error" });
        return;
      }
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_recovery", totpCode: disableCode }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        recoveryCodes?: string[];
      };
      if (!res.ok) throw new Error(json.error ?? "Could not regenerate");
      setRecoveryCodes(json.recoveryCodes ?? []);
      toast({ title: "New recovery codes generated.", tone: "success" });
      void load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not regenerate", tone: "error" });
    } finally {
      setBusyMfa(false);
    }
  }

  async function revokeSession(id: string, isCurrent: boolean) {
    if (isCurrent) {
      const ok = window.confirm(
        "Signing out this device will end your current SegmiQ session."
      );
      if (!ok) return;
    }
    const res = await fetch(`/api/auth/session?sessionId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast({ title: "Could not sign out that session.", tone: "error" });
      return;
    }
    if (isCurrent) {
      await secureSignOut("/login");
      return;
    }
    toast({ title: "Signed out.", tone: "success" });
    void load();
  }

  async function revokeOthers() {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "others" }),
    });
    if (!res.ok) {
      toast({ title: "Could not sign out other devices.", tone: "error" });
      return;
    }
    toast({ title: "Other devices signed out.", tone: "success" });
    void load();
  }

  async function revokeEverywhere() {
    const ok = window.confirm(
      "This will sign you out of SegmiQ on every device, including this one."
    );
    if (!ok) return;
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "all" }),
    });
    if (!res.ok) {
      toast({ title: "Could not sign out everywhere.", tone: "error" });
      return;
    }
    await secureSignOut("/login");
  }

  async function loadMoreEvents() {
    const res = await fetch(`/api/auth/security-events?limit=20&offset=${eventsOffset}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const j = (await res.json()) as { events?: SecurityEventItem[] };
    setEvents((prev) => [...prev, ...(j.events ?? [])]);
    setEventsOffset((o) => o + 20);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-[13px] text-sales-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading security settings…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {mfa?.policy === "required" && !mfa.enabled ? (
        <div className="rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-sales-text-primary">
          Two-step verification is required for your account. Set it up below to keep full access.
        </div>
      ) : null}

      <SettingsSectionCard
        title="Password"
        description={
          passwordChangedAt
            ? `Last changed ${new Date(passwordChangedAt).toLocaleDateString()}`
            : "Changing your password signs you out of other devices."
        }
      >
        <div className="space-y-4">
          <Field label="Current password" htmlFor="sec-pw-current">
            <Input
              id="sec-pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="sec-pw-new" hint="At least 8 characters, including a number or symbol.">
            <Input
              id="sec-pw-new"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="sec-pw-confirm">
            <Input
              id="sec-pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            size="md"
            loading={savingPw}
            disabled={!currentPw || newPw.length < 8}
            onClick={() => void changePassword()}
          >
            Change password
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Two-step verification"
        description={
          mfa?.enabled
            ? "Authenticator app is protecting your account."
            : mfa?.policy === "recommended"
              ? "Strongly recommended. Add an authenticator app for an extra layer of security."
              : "Add an extra layer of security to your account."
        }
      >
        {recoveryCodes ? (
          <div className="space-y-3">
            <p className="text-[13px] text-sales-text-secondary">
              Save these recovery codes now. They will not be shown again.
            </p>
            <ul className="grid grid-cols-1 gap-1.5 font-mono text-[13px] sm:grid-cols-2">
              {recoveryCodes.map((c) => (
                <li key={c} className="rounded-md bg-sales-bg px-3 py-2 text-sales-text-primary">
                  {c}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRecoveryCodes(null);
                setSetupOpen(false);
              }}
            >
              Done
            </Button>
          </div>
        ) : setupOpen && qrDataUrl ? (
          <div className="space-y-4">
            <p className="text-[13px] text-sales-text-secondary">
              Scan this QR code with your authenticator app, then enter the 6-digit code.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Authenticator QR code" className="h-[180px] w-[180px] rounded-lg border border-sales-border" />
            {manualKey ? (
              <p className="text-[12px] text-sales-text-muted">
                Manual key: <span className="font-mono text-sales-text-primary">{manualKey}</span>
              </p>
            ) : null}
            <Field label="Authenticator code" htmlFor="setup-code">
              <Input
                id="setup-code"
                inputMode="numeric"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                placeholder="000000"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" size="md" loading={busyMfa} onClick={() => void confirmMfaSetup()}>
                Enable
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setSetupOpen(false);
                  setQrDataUrl(null);
                  setManualKey(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : mfa?.enabled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-sales-text-primary">Authenticator app</p>
                <p className="text-[13px] text-sales-text-secondary">
                  Enabled
                  {mfa.recoveryCodesRemaining > 0
                    ? ` · ${mfa.recoveryCodesRemaining} recovery codes remaining`
                    : ""}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setManageOpen((v) => !v)}>
                Manage
              </Button>
            </div>
            {manageOpen ? (
              <div className="space-y-3 rounded-[10px] border border-sales-border-subtle bg-sales-bg/50 p-4">
                <Field label="Current password" htmlFor="dis-pw">
                  <Input id="dis-pw" type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} />
                </Field>
                <Field label="Authenticator code" htmlFor="dis-code">
                  <Input id="dis-code" inputMode="numeric" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" loading={busyMfa} onClick={() => void regenerateCodes()}>
                    Regenerate recovery codes
                  </Button>
                  <Button variant="danger" size="sm" loading={busyMfa} onClick={() => void disableMfa()}>
                    Disable two-step verification
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-sales-text-secondary">
              Use Google Authenticator, Microsoft Authenticator, 1Password, or any TOTP app.
            </p>
            <Button variant="primary" size="sm" loading={busyMfa} onClick={() => void startMfaSetup()}>
              Set up
            </Button>
          </div>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Your devices"
        description="Sessions signed in to your SegmiQ account. A browser login counts as one device."
      >
        <ul className="divide-y divide-sales-border-subtle">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-sales-text-primary">{s.deviceName}</p>
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                  {s.current ? (
                    <span className="text-emerald-600 dark:text-emerald-400">This device · {s.lastSeenLabel}</span>
                  ) : (
                    s.lastSeenLabel
                  )}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void revokeSession(s.id, s.current)}>
                Sign out
              </Button>
            </li>
          ))}
          {sessions.length === 0 ? (
            <li className="py-2 text-[13px] text-sales-text-secondary">No active sessions.</li>
          ) : null}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void revokeOthers()} disabled={sessions.length <= 1}>
            Sign out all other devices
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void revokeEverywhere()}>
            Sign out everywhere
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Security activity" description="Recent security events for your account only.">
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-sales-text-primary">{ev.summary}</span>
              <span className="shrink-0 text-[12px] text-sales-text-muted">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {events.length === 0 ? (
            <li className="text-[13px] text-sales-text-secondary">No recent activity.</li>
          ) : null}
        </ul>
        {events.length >= 20 ? (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => void loadMoreEvents()}>
              Load more
            </Button>
          </div>
        ) : null}
      </SettingsSectionCard>

      <OrgSecurityPanel toast={toast} />

      <p className={cn("text-[12px] text-sales-text-muted")}>
        Lost your authenticator and recovery codes? Contact SegmiQ support — there is no self-service MFA bypass.
      </p>
    </div>
  );
}
