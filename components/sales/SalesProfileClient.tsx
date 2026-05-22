"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ClientAvatar } from "@/components/ClientAvatar";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { parseSalesPrefs, type SalesNotificationPrefs } from "@/lib/notification-prefs";

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

export function SalesProfileClient({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<SalesNotificationPrefs>({ whatsapp: true, email: true, followUpReminders: true });
  const [clientName, setClientName] = useState<string | null>(null);
  const [agencyContact, setAgencyContact] = useState<{ name: string; email: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const u = j.user as { name: string; phone: string | null; avatar_url: string | null; notification_prefs: unknown };
      setName(u.name);
      setPhone(u.phone ?? "");
      setAvatarUrl(u.avatar_url);
      setPrefs(parseSalesPrefs(u.notification_prefs));
      setClientName(j.clientName as string | null);
      setAgencyContact(j.agencyContact as { name: string; email: string } | null);
    } catch {
      setToast("Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!prefsSaved) return;
    const t = window.setTimeout(() => setPrefsSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [prefsSaved]);

  function validatePhoneDisplay(phoneVal: string): boolean {
    if (!phoneVal.trim()) {
      setPhoneError("Phone is required for WhatsApp alerts");
      return false;
    }
    const p = parsePhoneNumberFromString(phoneVal.trim());
    if (!p?.isValid()) {
      setPhoneError("Use international format, e.g. +15551234567");
      return false;
    }
    setPhoneError(null);
    return true;
  }

  async function saveProfile() {
    if (!validatePhoneDisplay(phone)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setToast("Profile saved.");
      router.refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function savePrefs(next: SalesNotificationPrefs) {
    setPrefs(next);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_prefs: next }),
    });
    if (res.ok) {
      setPrefsSaved(true);
    }
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setToast("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const r = await signIn("credentials", {
        email: initialEmail,
        password: newPw,
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

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) {
      setToast(j.error ?? "Upload failed");
      return;
    }
    setAvatarUrl(j.avatar_url as string);
    router.refresh();
  }

  const strength = passwordStrength(newPw);

  if (loading) {
    return <div className="shimmer mx-auto h-96 max-w-[640px] rounded-lg" />;
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-12 pb-16">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">SALES / PROFILE</p>
        <h1 className="font-display text-[26px] leading-none tracking-display text-ink-primary sm:text-[36px]">Your profile</h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          Keep your contact info current so leads reach you fast.
        </p>
      </header>

      {toast ? (
        <div className="rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm">{toast}</div>
      ) : null}

      <section className="space-y-6">
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Personal info</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <label className="relative cursor-pointer">
            <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => void onAvatarChange(e)} />
            <ClientAvatar name={name} size={80} src={avatarUrl} />
            <span className="mt-2 block text-center text-[11px] text-[var(--accent)]">Upload</span>
          </label>
          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Name</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Email</span>
              <input
                className="mt-1 w-full cursor-not-allowed rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm text-ink-tertiary"
                value={initialEmail}
                readOnly
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Phone (WhatsApp)</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
                onBlur={() => validatePhoneDisplay(phone)}
              />
              {phoneError ? <p className="mt-1 text-xs text-[var(--danger-fg)]">{phoneError}</p> : null}
              <p className="mt-1 text-xs text-ink-tertiary">
                This is the number that receives WhatsApp lead alerts. Use international format (E.164).
              </p>
            </label>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveProfile()}>
              Save
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Change password</h2>
        <label className="block max-w-md">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">Current password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="block max-w-md">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">New password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
          {newPw ? (
            <span className="mt-1 block text-xs text-ink-tertiary">
              Strength: <span className="capitalize text-ink-primary">{strength}</span>
            </span>
          ) : null}
        </label>
        <label className="block max-w-md">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary">Confirm new password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void changePassword()}>
          Update password
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Notification preferences</h2>
          {prefsSaved ? <span className="text-xs text-[var(--success)]">Saved</span> : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.whatsapp}
            onChange={(e) => void savePrefs({ ...prefs, whatsapp: e.target.checked })}
          />
          WhatsApp notifications for new leads
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.email}
            onChange={(e) => void savePrefs({ ...prefs, email: e.target.checked })}
          />
          Email notifications for new leads
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.followUpReminders}
            onChange={(e) => void savePrefs({ ...prefs, followUpReminders: e.target.checked })}
          />
          Follow-up reminder WhatsApps
        </label>
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">Team</h2>
        <div className="mt-3 rounded-lg border border-border bg-surface-card p-4 text-sm">
          <p>
            <span className="text-ink-tertiary">Client: </span>
            {clientName ? <span className="font-medium">{clientName}</span> : "—"}
          </p>
          <p className="mt-2 text-ink-tertiary">
            Agency support: {agencyContact ? `${agencyContact.name} · ${agencyContact.email}` : "—"}
          </p>
        </div>
      </section>
    </div>
  );
}
