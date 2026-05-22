"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, Mail, Phone } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { normalizeToE164 } from "@/lib/phone-validate";
import type { ManagerNotificationPrefs } from "@/lib/notification-prefs";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function SectionDivider() {
  return <hr className="my-10 border-t border-[--border]" />;
}

function Field({
  label,
  caption,
  error,
  children,
}: {
  label: string;
  caption?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-[--text-tertiary]">{label}</div>
      {caption ? <div className="mb-1.5 mt-0.5 text-xs text-[--text-secondary]">{caption}</div> : <div className="mb-1.5" />}
      {children}
      {error ? <p className="mt-1 text-xs text-[--danger]">{error}</p> : null}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1 w-full rounded-md border border-[--border] bg-[--surface-card] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] disabled:cursor-not-allowed disabled:bg-[--surface-card-alt] disabled:text-[--text-tertiary]"
    />
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="password"
      {...props}
      className="mt-1 w-full rounded-md border border-[--border] bg-[--surface-card] px-3 py-2 text-sm text-[--text-primary]"
    />
  );
}

function StrengthMeter({ strength }: { strength: "weak" | "medium" | "strong" }) {
  return (
    <span className="text-xs text-[--text-tertiary]">
      Strength: <span className="capitalize text-[--text-primary]">{strength}</span>
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors",
        checked ? "border-[--accent] bg-[--accent]" : "border-[--border-strong] bg-[--surface-card-alt]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[14px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

type EventRowKey = "newLead" | "dealWon" | "uncontactedLead";

function PrefRow({
  label,
  description,
  event,
  prefs,
  onToggle,
  channels = ["whatsapp", "email"],
}: {
  label: string;
  description: string;
  event: EventRowKey;
  prefs: ManagerNotificationPrefs;
  onToggle: (event: EventRowKey, channel: "whatsapp" | "email", value: boolean) => void;
  channels?: ("whatsapp" | "email")[];
}) {
  const row = prefs[event];
  return (
    <tr>
      <td className="py-4 pr-6">
        <div className="text-sm font-medium text-[--text-primary]">{label}</div>
        <div className="mt-0.5 text-xs text-[--text-secondary]">{description}</div>
      </td>
      <td className="w-24 py-4 text-center">
        {channels.includes("whatsapp") ? (
          <Toggle checked={row.whatsapp} onChange={(v) => onToggle(event, "whatsapp", v)} />
        ) : (
          <span className="text-[--text-tertiary]">—</span>
        )}
      </td>
      <td className="w-24 py-4 text-center">
        {channels.includes("email") ? (
          <Toggle checked={row.email} onChange={(v) => onToggle(event, "email", v)} />
        ) : (
          <span className="text-[--text-tertiary]">—</span>
        )}
      </td>
    </tr>
  );
}

export type ClientAccountUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  notification_prefs: ManagerNotificationPrefs;
};

export type AgencyContactRow = { name: string; email: string; phone: string | null };

export function ClientAccountClient({
  user: initialUser,
  agencyContact,
  client,
}: {
  user: ClientAccountUser;
  agencyContact: AgencyContactRow | null;
  client: { id: string; name: string; industry: string | null; logo_url: string | null };
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUser.avatar_url);
  const [prefs, setPrefs] = useState<ManagerNotificationPrefs>(initialUser.notification_prefs);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [notifSaved, setNotifSaved] = useState(false);
  /** Browser timers are numeric IDs; avoids NodeJS.Timeout vs number mismatch in client components. */
  const notifTimer = useRef<number | null>(null);
  const notifDebounce = useRef<number | null>(null);

  const initialName = initialUser.name;
  const initialPhone = initialUser.phone ?? "";
  const initialAvatar = initialUser.avatar_url;
  const isDirty =
    name.trim() !== initialName.trim() ||
    phone.trim() !== initialPhone.trim() ||
    (avatarUrl ?? "") !== (initialAvatar ?? "");

  const strength = passwordStrength(newPw);
  const canSavePassword = currentPw.length > 0 && newPw.length >= 8 && newPw === confirmPw;

  useEffect(() => {
    setUser(initialUser);
    setName(initialUser.name);
    setPhone(initialUser.phone ?? "");
    setAvatarUrl(initialUser.avatar_url);
    setPrefs(initialUser.notification_prefs);
  }, [initialUser]);

  useEffect(() => {
    if (!savedToast) return;
    const t = window.setTimeout(() => setSavedToast(false), 2000);
    return () => window.clearTimeout(t);
  }, [savedToast]);

  useEffect(() => {
    return () => {
      if (notifTimer.current != null) window.clearTimeout(notifTimer.current);
      if (notifDebounce.current != null) window.clearTimeout(notifDebounce.current);
    };
  }, []);

  const flashNotifSaved = useCallback(() => {
    setNotifSaved(true);
    if (notifTimer.current != null) window.clearTimeout(notifTimer.current);
    notifTimer.current = window.setTimeout(() => setNotifSaved(false), 1000) as unknown as number;
  }, []);

  const schedulePrefsPatch = useCallback(
    (next: ManagerNotificationPrefs) => {
      if (notifDebounce.current != null) window.clearTimeout(notifDebounce.current);
      notifDebounce.current = window.setTimeout(async () => {
        const res = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_prefs: next }),
        });
        if (res.ok) {
          const j = (await res.json()) as { user?: ClientAccountUser };
          if (j.user?.notification_prefs) setPrefs(j.user.notification_prefs);
          flashNotifSaved();
        }
        notifDebounce.current = null;
      }, 400) as unknown as number;
    },
    [flashNotifSaved]
  );

  function handlePhoneChange(v: string) {
    setPhone(v);
    setPhoneError(null);
  }

  function validatePhoneForSave(raw: string): boolean {
    const t = raw.trim();
    if (!t) {
      setPhoneError(null);
      return true;
    }
    const n = normalizeToE164(t);
    if (!n) {
      setPhoneError("Phone doesn't look valid. Use international format starting with +.");
      return false;
    }
    setPhoneError(null);
    return true;
  }

  async function handleSavePersonal() {
    if (!validatePhoneForSave(phone)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          avatar_url: avatarUrl,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      if (j.user) setUser({ ...user, ...j.user, notification_prefs: prefs });
      setSavedToast(true);
      router.refresh();
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
    setConfirmError(null);
    if (newPw !== confirmPw) {
      setConfirmError("Passwords do not match");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      await signIn("credentials", {
        email: user.email,
        password: newPw,
        redirect: false,
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      router.refresh();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingPw(false);
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
      setAvatarError(j.error ?? "Upload failed");
      return;
    }
    setAvatarUrl(j.avatar_url as string);
    router.refresh();
  }

  function togglePref(event: EventRowKey, channel: "whatsapp" | "email", value: boolean) {
    setPrefs((prev) => {
      const next = {
        ...prev,
        [event]: { ...prev[event], [channel]: value },
      } as ManagerNotificationPrefs;
      schedulePrefsPatch(next);
      return next;
    });
  }

  function toggleWeeklyDigestEmail(value: boolean) {
    setPrefs((prev) => {
      const next: ManagerNotificationPrefs = {
        ...prev,
        weeklyDigest: { email: value },
      };
      schedulePrefsPatch(next);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="mb-10">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[--text-tertiary]">
          {client.name} / Account
        </div>
        <h1 className="font-serif text-4xl tracking-tight text-[--text-primary]">Your account</h1>
        <p className="mt-2 text-sm text-[--text-secondary]">
          Manage your profile, password, and notification preferences.
        </p>
      </header>

      <section>
        <h2 className="mb-1 font-serif text-2xl text-[--text-primary]">Personal info</h2>
        <p className="mb-6 text-sm text-[--text-secondary]">How we contact you about leads and deals.</p>

        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <label className="relative cursor-pointer shrink-0">
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => void onAvatarChange(e)} />
              <ClientAvatar name={name} size={80} src={avatarUrl} />
              <span className="mt-2 block text-center text-[11px] text-[--text-secondary]">Upload</span>
            </label>
            <div className="min-w-0 flex-1 space-y-5">
              <Field label="Name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email" caption="Contact your agency to change your email.">
                <TextInput value={user.email} disabled />
              </Field>
              <Field
                label="Phone"
                caption="WhatsApp alerts for new leads and won deals will be sent here. Use international format (e.g., +263 77 123 4567)."
                error={phoneError}
              >
                <TextInput
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+263 77 123 4567"
                />
              </Field>
            </div>
          </div>
          {avatarError ? <p className="text-xs text-[--danger]">{avatarError}</p> : null}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSavePersonal()}
            disabled={!isDirty || saving}
            className="rounded-md bg-[--surface-sidebar] px-5 py-2.5 text-sm font-medium text-[--text-on-dark] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {savedToast ? (
            <span className="flex items-center gap-1.5 text-sm text-[--success]">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>
      </section>

      <SectionDivider />

      <section>
        <h2 className="mb-1 font-serif text-2xl text-[--text-primary]">Password</h2>
        <p className="mb-6 text-sm text-[--text-secondary]">Changing your password signs you out of other devices.</p>

        <div className="space-y-5">
          <Field label="Current password">
            <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password" caption={<StrengthMeter strength={strength} />}>
            <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" error={confirmError}>
            <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => void handleSavePassword()}
          disabled={!canSavePassword || savingPw}
          className="mt-8 rounded-md bg-[--surface-sidebar] px-5 py-2.5 text-sm font-medium text-[--text-on-dark] disabled:opacity-40"
        >
          {savingPw ? "Updating…" : "Update password"}
        </button>
      </section>

      <SectionDivider />

      <section>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 font-serif text-2xl text-[--text-primary]">Notifications</h2>
            <p className="text-sm text-[--text-secondary]">Choose how and when you want to be alerted.</p>
          </div>
          <span
            className={[
              "pt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[--success] transition-opacity duration-300",
              notifSaved ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            Saved
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="pb-3 font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[--text-tertiary]">
                Event
              </th>
              <th className="w-24 pb-3 text-center font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[--text-tertiary]">
                WhatsApp
              </th>
              <th className="w-24 pb-3 text-center font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-[--text-tertiary]">
                Email
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--border]">
            <PrefRow
              label="New lead assigned"
              description="Each time a new lead is assigned to one of your salespeople."
              event="newLead"
              prefs={prefs}
              onToggle={togglePref}
            />
            <PrefRow
              label="Deal won"
              description="When one of your team closes a deal."
              event="dealWon"
              prefs={prefs}
              onToggle={togglePref}
            />
            <PrefRow
              label="Lead uncontacted"
              description="If a new lead hasn't been called within your response SLA."
              event="uncontactedLead"
              prefs={prefs}
              onToggle={togglePref}
            />
            <tr>
              <td className="py-4 pr-6">
                <div className="text-sm font-medium text-[--text-primary]">Weekly digest</div>
                <div className="mt-0.5 text-xs text-[--text-secondary]">
                  Summary of the week&apos;s performance every Monday.
                </div>
              </td>
              <td className="w-24 py-4 text-center">
                <span className="text-[--text-tertiary]">—</span>
              </td>
              <td className="w-24 py-4 text-center">
                <Toggle checked={prefs.weeklyDigest.email} onChange={toggleWeeklyDigestEmail} />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-6 text-xs text-[--text-tertiary]">
          Your agency admin may send system-level alerts that can&apos;t be disabled.
        </p>
      </section>

      <SectionDivider />

      <section>
        <h2 className="mb-1 font-serif text-2xl text-[--text-primary]">Your agency</h2>
        <p className="mb-6 text-sm text-[--text-secondary]">
          Need help? Your agency admin can update settings, add team members, or change integrations.
        </p>

        <div className="rounded-lg border border-[--border] bg-[--surface-card] p-6">
          {agencyContact ? (
            <>
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--surface-card-alt] font-serif text-lg text-[--text-primary]">
                  {initials(agencyContact.name)}
                </div>
                <div>
                  <div className="font-serif text-lg text-[--text-primary]">{agencyContact.name}</div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[--text-tertiary]">Agency admin</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <a
                  href={`mailto:${agencyContact.email}`}
                  className="flex items-center gap-2 text-[--text-primary] hover:text-[--accent-ink]"
                >
                  <Mail className="h-4 w-4 text-[--text-tertiary]" />
                  {agencyContact.email}
                </a>
                {agencyContact.phone ? (
                  <a href={`tel:${agencyContact.phone}`} className="flex items-center gap-2 text-[--text-primary]">
                    <Phone className="h-4 w-4 text-[--text-tertiary]" />
                    {agencyContact.phone}
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-sm text-[--text-secondary]">Agency admin info unavailable.</div>
          )}
        </div>
      </section>
    </div>
  );
}
