"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { VerticalSettingsNav } from "@/components/settings/VerticalSettingsNav";
import { ClientAvatar } from "@/components/ClientAvatar";

function passwordStrength(pw: string): "weak" | "medium" | "strong" {
  if (pw.length < 8) return "weak";
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (score >= 3) return "strong";
  if (score >= 1) return "medium";
  return "weak";
}

type SettingsPayload = {
  settings: {
    id: string;
    agency_name: string | null;
    logo_url: string | null;
    default_response_time_limit_hours: number;
    default_currency: string;
    default_timezone: string;
    terms_url: string | null;
    privacy_url: string | null;
  };
  connections: {
    metaWhatsApp: {
      configured: boolean;
      provider: string;
      phoneNumberIdMasked: string | null;
      businessAccountIdMasked: string | null;
    };
    twilio: {
      configured: boolean;
      accountSidMasked: string | null;
      whatsappFrom: string | null;
      legacy?: boolean;
    };
    resend: { configured: boolean; fromEmail: string | null };
  };
};

type AdminRow = { id: string; name: string; email: string; is_active: boolean; created_at: string };

type MessageLogRow = {
  id: string;
  created_at: string;
  notification_type: string;
  channel: string;
  recipient_masked: string;
  status: string;
  error_message: string | null;
  error_code: string | null;
  template_key: string | null;
};

/** Shown on Agency team until dismissed or 30 days pass (stored in localStorage only). */
type PendingAdminPassword = {
  userId: string;
  email: string;
  password: string;
  expiresAt: number;
};

const AGENCY_TEAM_TEMP_PASS_STORAGE_KEY = "agency-settings-team-temp-passes";
const AGENCY_TEAM_TEMP_PASS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function parsePendingAdminPasswords(raw: string | null): PendingAdminPassword[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: PendingAdminPassword[] = [];
    const now = Date.now();
    for (const x of arr) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const userId = typeof o.userId === "string" ? o.userId : null;
      const email = typeof o.email === "string" ? o.email : "";
      const password = typeof o.password === "string" ? o.password : null;
      const expiresAt = typeof o.expiresAt === "number" ? o.expiresAt : null;
      if (!userId || !password || !expiresAt) continue;
      if (now >= expiresAt) continue;
      out.push({ userId, email, password, expiresAt });
    }
    return out;
  } catch {
    return [];
  }
}

const TABS = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "team", label: "Agency team" },
  { id: "billing", label: "Billing" },
  { id: "legal", label: "Legal" },
];

export function AgencySettingsClient() {
  const router = useRouter();
  const [tab, setTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedGeneral, setSavedGeneral] = useState(false);
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [form, setForm] = useState({
    agency_name: "",
    logo_url: "",
    default_response_time_limit_hours: 2,
    default_currency: "USD",
    default_timezone: "America/New_York",
    terms_url: "",
    privacy_url: "",
  });

  const [legalForm, setLegalForm] = useState({ terms_url: "", privacy_url: "" });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<{ email: string; emailSent: boolean } | null>(null);
  const [pendingAdminPasswords, setPendingAdminPasswords] = useState<PendingAdminPassword[]>([]);
  const skipNextPersistRef = useRef(true);
  const [messageLogs, setMessageLogs] = useState<MessageLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  /** Optional override for test notification email (blank = use login email on server). */
  const [testNotificationEmail, setTestNotificationEmail] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [meRes, sRes, aRes] = await Promise.all([
        fetch("/api/users/me"),
        fetch("/api/agency/settings"),
        fetch("/api/agency/admins"),
      ]);
      if (meRes.ok) {
        const meJson = (await meRes.json()) as { user?: { email?: string } };
        const em = meJson.user?.email;
        if (typeof em === "string" && em) {
          setAccountEmail(em);
        }
      }
      const sJson = (await sRes.json()) as SettingsPayload;
      const aJson = (await aRes.json()) as { admins: AdminRow[] };
      if (sRes.ok) {
        setData(sJson);
        const st = sJson.settings;
        setForm({
          agency_name: st.agency_name ?? "",
          logo_url: st.logo_url ?? "",
          default_response_time_limit_hours: st.default_response_time_limit_hours,
          default_currency: st.default_currency,
          default_timezone: st.default_timezone,
          terms_url: st.terms_url ?? "",
          privacy_url: st.privacy_url ?? "",
        });
        setLegalForm({ terms_url: st.terms_url ?? "", privacy_url: st.privacy_url ?? "" });
      }
      if (aRes.ok) setAdmins(aJson.admins ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AGENCY_TEAM_TEMP_PASS_STORAGE_KEY);
      setPendingAdminPasswords(parsePendingAdminPasswords(saved));
    } catch {
      // Ignore parse/storage errors in restricted environments.
    }
  }, []);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      if (pendingAdminPasswords.length === 0) {
        window.localStorage.removeItem(AGENCY_TEAM_TEMP_PASS_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(
        AGENCY_TEAM_TEMP_PASS_STORAGE_KEY,
        JSON.stringify(pendingAdminPasswords)
      );
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [pendingAdminPasswords]);

  useEffect(() => {
    if (tab !== "notifications") return;
    let cancelled = false;
    (async () => {
      setLogsLoading(true);
      try {
        const res = await fetch("/api/agency/message-logs");
        const j = (await res.json()) as { logs?: MessageLogRow[] };
        if (!cancelled && res.ok) setMessageLogs(j.logs ?? []);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function saveGeneral() {
    setSaving(true);
    try {
      const res = await fetch("/api/agency/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_name: form.agency_name || null,
          logo_url: form.logo_url || null,
          default_response_time_limit_hours: form.default_response_time_limit_hours,
          default_currency: form.default_currency,
          default_timezone: form.default_timezone,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setToast("Saved agency settings.");
      setSavedGeneral(true);
      window.setTimeout(() => setSavedGeneral(false), 2000);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveLegal() {
    setSaving(true);
    try {
      const res = await fetch("/api/agency/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms_url: legalForm.terms_url || null,
          privacy_url: legalForm.privacy_url || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setToast("Saved legal URLs.");
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    if (!newEmail.trim()) {
      setToast("Enter a new email address");
      return;
    }
    const pw = emailCurrentPassword;
    if (!pw) {
      setToast("Enter your current password to confirm the change");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim(), currentPassword: pw }),
      });
      const j = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not update email");
      const next = j.email ?? newEmail.trim();
      setAccountEmail(next);
      setNewEmail("");
      setEmailCurrentPassword("");
      const r = await signIn("credentials", {
        email: next,
        password: pw,
        redirect: false,
      });
      if (r?.error) {
        setToast("Email updated — sign in with your new address if you are signed out.");
      } else {
        setToast("Email updated.");
      }
      router.refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setToast("New passwords do not match");
      return;
    }
    const nextPw = newPw;
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: nextPw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed");
      const r = await signIn("credentials", {
        email: accountEmail,
        password: nextPw,
        redirect: false,
      });
      if (r?.error) {
        setToast("Password updated — please sign in again.");
      } else {
        setToast("Password updated.");
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      router.refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function testNotification() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmail: testNotificationEmail.trim() || undefined,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        provider?: string;
        whatsapp?: string;
        email?: string;
        emailTo?: string | null;
        detail?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const emailHint =
        j.email === "ok" && j.emailTo ? ` (sent to ${j.emailTo})` : j.email === "skipped" ? " (email skipped)" : "";
      const prov = j.provider ? ` [${j.provider}]` : "";
      setToast(
        `Test${prov}: WhatsApp ${j.whatsapp ?? "?"}, Email ${j.email ?? "?"}${emailHint}` +
          (j.detail ? ` — ${j.detail}` : "")
      );
      const lr = await fetch("/api/agency/message-logs");
      if (lr.ok) {
        const lj = (await lr.json()) as { logs?: MessageLogRow[] };
        setMessageLogs(lj.logs ?? []);
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agency/invite-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const j = (await res.json()) as {
        error?: string;
        user?: { id?: string; email?: string };
        temporaryPassword?: string;
        emailSent?: boolean;
      };
      if (!res.ok) throw new Error(j.error ?? "Invite failed");
      const user = j.user;
      const temporaryPassword = j.temporaryPassword;
      const userId = user?.id;
      const emailSent = typeof j.emailSent === "boolean" ? j.emailSent : false;
      const resolvedEmail = typeof user?.email === "string" ? user.email : inviteEmail.trim();
      setInviteResult({ email: resolvedEmail, emailSent });
      if (!emailSent && userId && temporaryPassword) {
        setPendingAdminPasswords((prev) => [
          ...prev.filter((p) => p.userId !== userId),
          {
            userId,
            email: resolvedEmail,
            password: temporaryPassword,
            expiresAt: Date.now() + AGENCY_TEAM_TEMP_PASS_TTL_MS,
          },
        ]);
      }
      setInviteOpen(false);
      setInviteEmail("");
      setToast("Admin user created.");
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function copyPendingPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setToast("Temporary password copied.");
    } catch {
      setToast("Could not copy automatically. Please copy manually.");
    }
  }

  function dismissPendingInvitePassword(userId: string) {
    setPendingAdminPasswords((prev) => prev.filter((p) => p.userId !== userId));
  }

  async function deactivateAdmin(id: string) {
    if (!window.confirm("Deactivate this admin? They will not be able to sign in.")) return;
    const res = await fetch(`/api/agency/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    if (!res.ok) {
      const j = await res.json();
      setToast(j.error ?? "Failed");
      return;
    }
    await load();
  }

  if (loading && !data) {
    return <div className="shimmer h-96 rounded-lg" />;
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:flex-row md:gap-10">
      <VerticalSettingsNav tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-w-0 flex-1">
        {toast ? (
          <div className="mb-4 rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm text-ink-primary">
            {toast}
          </div>
        ) : null}

        {tab === "general" ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl text-ink-primary">General</h2>
              <p className="mt-1 text-sm text-ink-secondary">Defaults for new clients and platform identity.</p>
            </div>
            <div className="grid max-w-lg gap-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Agency name</span>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-tertiary)]">
                  Shown in the top-left of the platform and on client-facing emails.
                </p>
                <input
                  className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base md:text-sm"
                  value={form.agency_name}
                  onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Logo URL</span>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-tertiary)]">Used in emails and branded surfaces when set.</p>
                <input
                  className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base md:text-sm"
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                  Default response time (hours)
                </span>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-tertiary)]">
                  New clients inherit this SLA. Leads not contacted within this window get flagged.
                </p>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base md:text-sm"
                  value={form.default_response_time_limit_hours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_response_time_limit_hours: Number(e.target.value) || 2 }))
                  }
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Default currency</span>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-tertiary)]">
                  Used to format deal values across reports.
                </p>
                <input
                  className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base md:text-sm"
                  value={form.default_currency}
                  onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Default timezone</span>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-tertiary)]">
                  Controls when daily cron jobs fire and how dates display.
                </p>
                <input
                  className="mt-2 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base md:text-sm"
                  value={form.default_timezone}
                  onChange={(e) => setForm((f) => ({ ...f, default_timezone: e.target.value }))}
                  placeholder="America/New_York"
                />
              </label>
            </div>
            <div className="safe-bottom sticky bottom-0 border-t border-border bg-[var(--surface-page)] pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary h-11 md:h-9" disabled={saving} onClick={() => void saveGeneral()}>
                  {saving ? "Saving…" : "Save"}
                </button>
                {savedGeneral ? (
                  <span className="text-[13px] font-medium text-[var(--success)]" aria-live="polite">
                    Saved ✓
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "account" ? (
          <div className="max-w-lg space-y-10">
            <div>
              <h2 className="font-display text-2xl text-ink-primary">Account</h2>
              <p className="mt-1 text-sm text-ink-secondary">Your login for this platform.</p>
            </div>

            <section className="space-y-4">
              <h3 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Login email</h3>
              {accountEmail ? (
                <p className="text-sm text-ink-secondary">
                  Currently <span className="font-mono text-ink-primary">{accountEmail}</span>
                </p>
              ) : (
                <p className="text-sm text-ink-tertiary">Loading email…</p>
              )}
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">New email</span>
                <input
                  type="email"
                  className="input-base mt-1"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Current password (to confirm)</span>
                <input
                  type="password"
                  className="input-base mt-1"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="button"
                className="btn-primary h-11 md:h-9"
                disabled={saving || !accountEmail}
                onClick={() => void changeEmail()}
              >
                {saving ? "Saving…" : "Update email"}
              </button>
            </section>

            <section className="space-y-4">
              <h3 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Change password</h3>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Current password</span>
                <input
                  type="password"
                  className="input-base mt-1"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">New password</span>
                <input
                  type="password"
                  className="input-base mt-1"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
                {newPw ? (
                  <span className="mt-1 block text-xs text-ink-tertiary">
                    Strength: <span className="capitalize text-ink-primary">{passwordStrength(newPw)}</span>
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Confirm new password</span>
                <input
                  type="password"
                  className="input-base mt-1"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <p className="text-xs text-ink-tertiary">Use at least 8 characters and include a number or symbol.</p>
              <button
                type="button"
                className="btn-primary h-11 md:h-9"
                disabled={saving || !accountEmail}
                onClick={() => void changePassword()}
              >
                {saving ? "Updating…" : "Update password"}
              </button>
            </section>
          </div>
        ) : null}

        {tab === "notifications" ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl text-ink-primary">Notifications</h2>
            <p className="text-sm text-ink-secondary">
              Credentials are read from environment variables (Vercel → Project → Settings → Environment Variables). Do not
              paste secrets into this UI.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      data?.connections.metaWhatsApp?.configured ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <div className="font-mono text-[10px] uppercase text-ink-tertiary">WhatsApp (Meta)</div>
                </div>
                <p className="mt-2 text-sm text-ink-primary">
                  {data?.connections.metaWhatsApp?.configured
                    ? "Currently sending via Meta Cloud API."
                    : "Not configured (set Meta WhatsApp env on Vercel)."}
                </p>
                <p className="mt-1 font-mono text-xs text-ink-secondary">
                  Phone number ID: {data?.connections.metaWhatsApp?.phoneNumberIdMasked ?? "—"}
                </p>
                <p className="mt-1 font-mono text-xs text-ink-secondary">
                  WABA: {data?.connections.metaWhatsApp?.businessAccountIdMasked ?? "—"}
                </p>
                {data?.connections.twilio?.configured && data?.connections.twilio?.legacy ? (
                  <p className="mt-2 text-xs text-ink-tertiary">
                    Legacy Twilio creds are present; outbound WhatsApp uses Meta when `META_WHATSAPP_*` is set.
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${data?.connections.resend.configured ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                  <div className="font-mono text-[10px] uppercase text-ink-tertiary">Resend</div>
                </div>
                <p className="mt-2 text-sm">
                  <span className={data?.connections.resend.configured ? "text-emerald-600" : "text-red-600"}>
                    {data?.connections.resend.configured ? "Connected" : "Not configured"}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-ink-secondary">
                  From email: {data?.connections.resend.fromEmail ?? "—"}
                </p>
              </div>
            </div>
            <div className="max-w-lg space-y-2">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Test email recipient (optional)</span>
                <input
                  type="email"
                  className="input-base mt-1"
                  placeholder="you@example.com — any inbox you want"
                  value={testNotificationEmail}
                  onChange={(e) => setTestNotificationEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <p className="text-xs text-ink-secondary">
                Leave this blank to send the test to your Segmiq login email. Or enter any valid address (work,
                personal, a colleague) to confirm Resend delivery there.
              </p>
              <button type="button" className="btn-primary h-11 md:h-9" disabled={saving} onClick={() => void testNotification()}>
                Test notification
              </button>
            </div>

            <div className="mt-10">
              <h3 className="font-display text-lg text-ink-primary">Recent notifications</h3>
              <p className="mt-1 text-sm text-ink-secondary">Last 20 outbound WhatsApp / email attempts (masked recipients).</p>
              {logsLoading ? (
                <p className="mt-4 text-sm text-ink-tertiary">Loading…</p>
              ) : messageLogs.length === 0 ? (
                <p className="mt-4 text-sm text-ink-tertiary">
                  No delivery rows yet. Apply the message_logs migration, then trigger a lead or test notification.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border bg-surface-card-alt font-mono text-[10px] uppercase text-ink-tertiary">
                      <tr>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Channel</th>
                        <th className="px-3 py-2">Recipient</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messageLogs.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-secondary">
                            {row.created_at ? format(parseISO(row.created_at), "MMM d, HH:mm") : "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.notification_type}</td>
                          <td className="px-3 py-2 text-xs">{row.channel}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.recipient_masked}</td>
                          <td className="px-3 py-2 text-xs">{row.status}</td>
                          <td className="max-w-[200px] truncate px-3 py-2 text-xs text-[var(--danger-fg)]" title={row.error_message ?? ""}>
                            {row.error_code ? `${row.error_code}: ` : ""}
                            {row.error_message ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "team" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-ink-primary">Agency team</h2>
              <button type="button" className="btn-ghost text-sm" onClick={() => setInviteOpen(true)}>
                Invite admin
              </button>
            </div>
            {inviteResult?.emailSent === true ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "rgba(61,214,140,0.08)", border: "0.5px solid rgba(61,214,140,0.2)", borderRadius: 10 }}>
                <i className="ti ti-mail-check" style={{ fontSize: 16, color: "#3dd68c" }} />
                <p style={{ fontSize: 13, color: "#3dd68c", margin: 0, flex: 1 }}>
                  Login details sent to {inviteResult.email}
                </p>
                <button type="button" style={{ fontSize: 12, color: "#3dd68c", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }} onClick={() => setInviteResult(null)}>
                  Dismiss
                </button>
              </div>
            ) : inviteResult?.emailSent === false ? (
              <div style={{ padding: "12px 14px", background: "rgba(245,166,35,0.08)", border: "0.5px solid rgba(245,166,35,0.2)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#f5a623", margin: "0 0 4px", fontWeight: 600 }}>
                  Email failed to send. Credentials are shown below — share them manually.
                </p>
                <button type="button" style={{ fontSize: 12, color: "#f5a623", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }} onClick={() => setInviteResult(null)}>
                  Dismiss
                </button>
              </div>
            ) : null}
            {pendingAdminPasswords.length > 0 ? (
              <div className="space-y-3">
                {pendingAdminPasswords.map((p) => (
                  <div
                    key={p.userId}
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-ink-primary"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-ink-secondary">Temporary password for</span>
                      <span className="font-medium">{p.email}</span>
                    </div>
                    <div className="mt-2 font-mono text-sm">
                      <code className="break-all">{p.password}</code>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-tertiary">
                      <span>Expires {format(new Date(p.expiresAt), "MMM d, yyyy")}</span>
                      <button
                        type="button"
                        className="text-ink-primary underline underline-offset-2 hover:text-ink-secondary"
                        onClick={() => void copyPendingPassword(p.password)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="text-ink-primary underline underline-offset-2 hover:text-ink-secondary"
                        onClick={() => dismissPendingInvitePassword(p.userId)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-surface-card-alt font-mono text-[10px] uppercase text-ink-tertiary">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <ClientAvatar name={a.name} size="sm" />
                          <span className="font-medium">{a.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{a.email}</td>
                      <td className="px-4 py-3 text-xs text-ink-tertiary">
                        {a.created_at ? format(parseISO(a.created_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">{a.is_active ? "Active" : "Inactive"}</td>
                      <td className="px-4 py-3 text-right">
                        {a.is_active ? (
                          <button
                            type="button"
                            className="text-sm text-[var(--danger-fg)] hover:underline"
                            onClick={() => void deactivateAdmin(a.id)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inviteOpen ? (
              <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-overlay)] p-0 md:items-center md:justify-center md:p-4">
                <div className="flex h-full w-full flex-col border border-border bg-surface-card p-5 shadow-lg md:h-auto md:max-w-md md:rounded-lg md:p-6">
                  <h3 className="font-display text-xl">Invite agency admin</h3>
                  <label className="mt-4 block">
                    <span className="font-mono text-[10px] uppercase text-ink-tertiary">Email</span>
                    <input
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-base md:text-sm"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      inputMode="email"
                      autoCapitalize="off"
                    />
                  </label>
                  <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border pt-4 md:mt-4 md:border-t-0 md:pt-0">
                    <button type="button" className="btn-ghost h-11 flex-1 md:h-9 md:flex-none" onClick={() => setInviteOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary h-11 flex-1 md:h-9 md:flex-none" disabled={saving} onClick={() => void sendInvite()}>
                      Send invite
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "billing" ? (
          <div>
            <h2 className="font-display text-2xl text-ink-primary">Billing</h2>
            <p className="mt-4 text-ink-secondary">Billing settings coming soon. Stripe integration will live here.</p>
          </div>
        ) : null}

        {tab === "legal" ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl text-ink-primary">Legal</h2>
            <p className="text-sm text-ink-secondary">Shown in landing page footers (when set).</p>
            <div className="grid max-w-lg gap-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Terms of Service URL</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={legalForm.terms_url}
                  onChange={(e) => setLegalForm((f) => ({ ...f, terms_url: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Privacy Policy URL</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={legalForm.privacy_url}
                  onChange={(e) => setLegalForm((f) => ({ ...f, privacy_url: e.target.value }))}
                />
              </label>
            </div>
            <div className="safe-bottom sticky bottom-0 border-t border-border bg-[var(--surface-page)] pt-4">
              <button type="button" className="btn-primary h-11 md:h-9" disabled={saving} onClick={() => void saveLegal()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
