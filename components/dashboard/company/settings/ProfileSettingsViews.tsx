"use client";

import { useRef, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button, FieldError, FieldHint, FieldLabel, Input, Switch } from "@/components/sales/ui";
import { SettingsSectionCard, SettingsInfoGrid } from "./SettingsSectionCard";
import { SettingsNeedHelpCard } from "./CompanySettingsRail";
import { ClientAvatar } from "@/components/ClientAvatar";
import { useCrmTheme } from "@/components/CrmThemeProvider";
import { normalizeToE164 } from "@/lib/phone-validate";
import type { ManagerNotificationPrefs } from "@/lib/notification-prefs";
import type { CompanySettingsCurrentUser } from "@/lib/settings/company-settings-types";
import type { CrmTheme } from "@/lib/crm-theme";
import { cn } from "@/lib/ui/cn";

export function ProfilePersonalSection({
  user,
  companyName,
  onUserChange,
  toast,
}: {
  user: CompanySettingsCurrentUser;
  companyName: string;
  onUserChange: (next: Partial<CompanySettingsCurrentUser>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function save() {
    setPhoneError(null);
    let nextPhone: string | null = phone.trim() || null;
    if (nextPhone) {
      const norm = normalizeToE164(nextPhone);
      if (!norm) {
        setPhoneError("Use international format like +263 77 123 4567.");
        return;
      }
      nextPhone = norm;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: nextPhone }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save profile");
      onUserChange({ name: name.trim(), phone: nextPhone });
      toast({ title: "Personal information updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/users/me/avatar", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't upload photo");
      onUserChange({ avatarUrl: json.avatar_url ?? null });
      toast({ title: "Profile photo updated.", tone: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't upload photo", tone: "error" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSectionCard title="Profile Identity" description="How your name and photo appear across SegmiQ.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <button type="button" className="shrink-0 text-left" onClick={() => fileRef.current?.click()}>
            <ClientAvatar name={name || user.name} size={80} src={user.avatarUrl} />
            <span className="mt-2 block text-center text-[12px] text-sales-text-secondary">Change photo</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => void onAvatar(e.target.files?.[0])}
          />
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <FieldLabel htmlFor="me-name">Name</FieldLabel>
              <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="me-email">Login email</FieldLabel>
              <Input id="me-email" value={user.email} disabled />
              <FieldHint>Contact SegmiQ support to change your login email.</FieldHint>
            </div>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Contact Information" description="WhatsApp alerts for new leads and won deals use this number.">
        <FieldLabel htmlFor="me-phone">Phone</FieldLabel>
        <Input
          id="me-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+263 77 123 4567"
          invalid={Boolean(phoneError)}
        />
        {phoneError ? <FieldError>{phoneError}</FieldError> : null}
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="md" loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Role" description="Your access in this company.">
        <SettingsInfoGrid
          rows={[
            { label: "Role", value: "Company Manager" },
            { label: "Company", value: companyName },
          ]}
        />
      </SettingsSectionCard>
    </div>
  );
}

export function ProfileAccountSection({
  toast,
}: {
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function save() {
    setConfirmError(null);
    if (newPw !== confirmPw) {
      setConfirmError("Passwords do not match.");
      return;
    }
    setSaving(true);
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
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update password", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Password"
      description="Changing your password signs you out of other devices. Two-factor authentication is not available yet."
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
          <Input id="pw-current" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="pw-new">New password</FieldLabel>
          <Input id="pw-new" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <FieldHint>At least 8 characters, including a number or symbol.</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} invalid={Boolean(confirmError)} />
          {confirmError ? <FieldError>{confirmError}</FieldError> : null}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          disabled={!currentPw || newPw.length < 8}
          onClick={() => void save()}
        >
          Update password
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

export function ProfileAppearanceSection() {
  const { theme, setTheme } = useCrmTheme();
  function pick(next: CrmTheme) {
    if (next !== theme) setTheme(next);
  }
  return (
    <SettingsSectionCard
      title="Appearance"
      description="Choose light or dark for this device. This does not change company brand colors."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        {(["light", "dark"] as const).map((opt) => {
          const active = theme === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className={cn(
                "flex flex-1 flex-col rounded-[10px] border px-4 py-3 text-left transition-colors",
                active
                  ? "border-sales-brand-border bg-sales-brand-soft"
                  : "border-sales-border bg-sales-surface hover:bg-sales-surface-hover"
              )}
            >
              <span className="text-[13px] font-semibold capitalize text-sales-text-primary">{opt}</span>
              <span className="mt-0.5 text-[12px] text-sales-text-secondary">
                {opt === "dark" ? "Low-light workspace" : "Bright, high-contrast workspace"}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsSectionCard>
  );
}

export function NotificationsAlertsSection({
  user,
  onUserChange,
  toast,
}: {
  user: CompanySettingsCurrentUser;
  onUserChange: (next: Partial<CompanySettingsCurrentUser>) => void;
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const [prefs, setPrefs] = useState<ManagerNotificationPrefs>(user.notificationPrefs);
  const [saving, setSaving] = useState(false);

  async function persist(next: ManagerNotificationPrefs) {
    setPrefs(next);
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_prefs: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save notifications");
      onUserChange({ notificationPrefs: next });
      toast({ title: "Notification preferences saved.", tone: "success" });
    } catch (err) {
      setPrefs(user.notificationPrefs);
      toast({ title: err instanceof Error ? err.message : "Couldn't save", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  function toggle(event: "newLead" | "dealWon" | "uncontactedLead", channel: "whatsapp" | "email") {
    const next = {
      ...prefs,
      [event]: { ...prefs[event], [channel]: !prefs[event][channel] },
    };
    void persist(next);
  }

  const rows: Array<{
    key: "newLead" | "dealWon" | "uncontactedLead";
    label: string;
    description: string;
  }> = [
    { key: "newLead", label: "New lead assigned", description: "When a new lead is assigned to one of your salespeople." },
    { key: "dealWon", label: "Deal won", description: "When someone on your team closes a deal." },
    { key: "uncontactedLead", label: "Lead uncontacted", description: "If a new lead has not been called within your response SLA." },
  ];

  return (
    <SettingsSectionCard
      title="Sales Alerts"
      description="Choose WhatsApp and email for each event. System alerts from SegmiQ cannot be turned off."
    >
      <div className="divide-y divide-sales-border-subtle">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sales-surface-subtle text-sales-text-secondary">
                <Bell size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-sales-text-primary">{row.label}</p>
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">{row.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 sm:pl-11">
              <label className="flex items-center gap-2 text-[12px] text-sales-text-secondary">
                <SiWhatsapp size={13} aria-hidden />
                WhatsApp
                <Switch
                  checked={prefs[row.key].whatsapp}
                  onCheckedChange={() => toggle(row.key, "whatsapp")}
                  disabled={saving}
                  aria-label={`${row.label} WhatsApp`}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-sales-text-secondary">
                <Mail size={13} aria-hidden />
                Email
                <Switch
                  checked={prefs[row.key].email}
                  onCheckedChange={() => toggle(row.key, "email")}
                  disabled={saving}
                  aria-label={`${row.label} email`}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </SettingsSectionCard>
  );
}

export function ProfileHelpRail({ email }: { email?: string | null }) {
  return (
    <SettingsNeedHelpCard
      email={email}
      copy="Need to change your login email or recover access? Contact SegmiQ support."
    />
  );
}
