"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { SiWhatsapp } from "react-icons/si";
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Skeleton,
  Switch,
  useSalesToast,
} from "@/components/sales/ui";
import { CrmThemeSetting } from "@/components/settings/CrmThemeSetting";
import { parseSalesPrefs, type SalesNotificationPrefs } from "@/lib/notification-prefs";
import { cn } from "@/lib/ui/cn";

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
  const { toast } = useSalesToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<SalesNotificationPrefs>({
    whatsapp: true,
    email: true,
    followUpReminders: true,
  });
  const [clientName, setClientName] = useState<string | null>(null);
  const [agencyContact, setAgencyContact] = useState<{ name: string; email: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const dirty = name.trim() !== savedName.trim() || phone.trim() !== savedPhone.trim();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const u = j.user as {
        name: string;
        phone: string | null;
        avatar_url: string | null;
        notification_prefs: unknown;
      };
      setName(u.name ?? "");
      setSavedName(u.name ?? "");
      setPhone(u.phone ?? "");
      setSavedPhone(u.phone ?? "");
      setAvatarUrl(u.avatar_url);
      setPrefs(parseSalesPrefs(u.notification_prefs));
      setClientName(j.clientName as string | null);
      setAgencyContact(j.agencyContact as { name: string; email: string } | null);
    } catch {
      toast({ tone: "error", title: "Couldn't load your profile" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validatePhoneDisplay(phoneVal: string): boolean {
    if (!phoneVal.trim()) {
      setPhoneError("Phone is required for WhatsApp alerts");
      return false;
    }
    const p = parsePhoneNumberFromString(phoneVal.trim());
    if (!p?.isValid()) {
      setPhoneError("Use international format, e.g. +263771234567");
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
      setSavedName(name.trim());
      setSavedPhone(phone.trim());
      toast({ tone: "success", title: "Profile updated", description: "Your changes have been saved." });
      router.refresh();
    } catch (e) {
      toast({
        tone: "error",
        title: "Couldn't update profile",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePrefs(next: SalesNotificationPrefs) {
    const prev = prefs;
    setPrefs(next);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_prefs: next }),
    });
    if (res.ok) {
      toast({ tone: "success", title: "Notification preferences updated" });
    } else {
      setPrefs(prev);
      toast({ tone: "error", title: "Couldn't update preferences" });
    }
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      toast({ tone: "error", title: "New passwords do not match" });
      return;
    }
    setPwSaving(true);
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
        toast({
          tone: "warning",
          title: "Password updated",
          description: "Please sign in again.",
        });
      } else {
        toast({ tone: "success", title: "Password updated" });
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwOpen(false);
      router.refresh();
    } catch (e) {
      toast({
        tone: "error",
        title: "Couldn't update password",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setPwSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      setAvatarUrl(j.avatar_url as string);
      toast({ tone: "success", title: "Photo updated" });
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Couldn't upload photo",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const strength = passwordStrength(newPw);
  const displayName = name.trim() || "Sales";

  const formattedPhone = useMemo(() => {
    if (!savedPhone.trim()) return null;
    const p = parsePhoneNumberFromString(savedPhone.trim());
    return p?.isValid() ? p.formatInternational() : savedPhone;
  }, [savedPhone]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Skeleton className="h-[200px] rounded-sales-xl" />
          <Skeleton className="h-[220px] rounded-sales-xl" />
          <Skeleton className="h-[280px] rounded-sales-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[220px] rounded-sales-xl" />
          <Skeleton className="h-[180px] rounded-sales-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {dirty ? (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            className="h-10 rounded-[10px]"
            loading={saving}
            onClick={() => void saveProfile()}
          >
            Save changes
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  <Avatar name={displayName} src={avatarUrl} size="xl" className="!h-20 !w-20 !text-[20px]" />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    onChange={(e) => void onAvatarChange(e)}
                  />
                  <button
                    type="button"
                    aria-label="Change profile photo"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-sales-border bg-sales-surface text-sales-text-secondary shadow-sales-card hover:bg-sales-surface-hover"
                  >
                    <Camera size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-semibold text-sales-text-primary">{displayName}</p>
                  <p className="mt-0.5 text-[13px] text-sales-text-secondary">Sales Executive</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 h-9 rounded-[10px]"
                    loading={uploading}
                    leftIcon={<Camera size={14} strokeWidth={1.8} />}
                    onClick={() => fileRef.current?.click()}
                  >
                    Change photo
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                <Field label="Display name" htmlFor="profile-name">
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full"
                  />
                </Field>
                <Field label="Role" htmlFor="profile-role">
                  <Input
                    id="profile-role"
                    value="Sales Executive"
                    readOnly
                    className="w-full cursor-not-allowed bg-sales-surface-subtle text-sales-text-muted"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Email"
                htmlFor="profile-email"
                hint="Sign-in email cannot be changed from Profile."
              >
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
                  />
                  <Input
                    id="profile-email"
                    value={initialEmail}
                    readOnly
                    className="cursor-not-allowed bg-sales-surface-subtle pl-9 text-sales-text-muted"
                  />
                </div>
              </Field>
              <Field
                label="Phone"
                htmlFor="profile-phone"
                error={phoneError ?? undefined}
                hint={
                  phoneError
                    ? undefined
                    : "Used for WhatsApp lead alerts. International format (E.164)."
                }
              >
                <div className="relative">
                  <Phone
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
                  />
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError(null);
                    }}
                    onBlur={() => validatePhoneDisplay(phone)}
                    placeholder="+263 77 123 4567"
                    className="pl-9"
                    invalid={Boolean(phoneError)}
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-sales-border-subtle !px-0 !py-0">
              <NotifRow
                icon={<SiWhatsapp size={16} color="#25D366" />}
                title="WhatsApp lead alerts"
                description="Notify me on WhatsApp when a new lead is assigned to me."
                checked={prefs.whatsapp}
                onChange={(v) => void savePrefs({ ...prefs, whatsapp: v })}
              />
              <NotifRow
                icon={<Mail size={16} strokeWidth={1.8} className="text-[#2684FF]" />}
                title="Email lead alerts"
                description="Email me when a new lead is assigned to me."
                checked={prefs.email}
                onChange={(v) => void savePrefs({ ...prefs, email: v })}
              />
              <NotifRow
                icon={<Bell size={16} strokeWidth={1.8} className="text-[#F59E0B]" />}
                title="Follow-up reminders"
                description="Remind me by WhatsApp the day before and on the day a follow-up is due."
                checked={prefs.followUpReminders}
                onChange={(v) => void savePrefs({ ...prefs, followUpReminders: v })}
              />
            </CardContent>
          </Card>

          {/* Preferences that exist */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <CrmThemeSetting />
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>My profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={displayName} src={avatarUrl} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-sales-text-primary">{displayName}</p>
                  <p className="text-[12px] text-sales-text-secondary">Sales Executive</p>
                </div>
              </div>
              <dl className="space-y-3 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-sales-text-muted">Workspace</dt>
                  <dd className="truncate font-medium text-sales-text-primary">{clientName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sales-text-muted">Email</dt>
                  <dd className="truncate font-medium text-sales-text-primary">{initialEmail}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sales-text-muted">Phone</dt>
                  <dd className="truncate font-medium text-sales-text-primary">
                    {formattedPhone || "Not added"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-sales-text-muted">Status</dt>
                  <dd className="font-medium text-sales-success">Active</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account & security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                onClick={() => setPwOpen((o) => !o)}
                className="flex w-full items-center gap-3 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-3 text-left transition-colors hover:bg-sales-surface-hover"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sales-neutral-100)]">
                  <KeyRound size={16} strokeWidth={1.8} className="text-sales-text-secondary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-sales-text-primary">
                    Change password
                  </span>
                  <span className="block text-[12px] text-sales-text-muted">
                    Update your sign-in password
                  </span>
                </span>
              </button>

              {pwOpen ? (
                <div className="space-y-3 rounded-[12px] border border-sales-border-subtle bg-sales-surface-subtle p-3">
                  <Field label="Current password" htmlFor="current-pw">
                    <Input
                      id="current-pw"
                      type="password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                  <Field label="New password" htmlFor="new-pw">
                    <Input
                      id="new-pw"
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      autoComplete="new-password"
                    />
                    {newPw ? (
                      <p className="mt-1 text-[11px] text-sales-text-muted">
                        Strength:{" "}
                        <span
                          className={cn(
                            "capitalize font-medium",
                            strength === "strong"
                              ? "text-sales-success"
                              : strength === "medium"
                                ? "text-[#B54708]"
                                : "text-sales-danger"
                          )}
                        >
                          {strength}
                        </span>
                      </p>
                    ) : null}
                  </Field>
                  <Field label="Confirm new password" htmlFor="confirm-pw">
                    <Input
                      id="confirm-pw"
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 flex-1 rounded-[10px]"
                      onClick={() => {
                        setPwOpen(false);
                        setCurrentPw("");
                        setNewPw("");
                        setConfirmPw("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-9 flex-1 rounded-[10px]"
                      loading={pwSaving}
                      disabled={!currentPw || !newPw || !confirmPw}
                      onClick={() => void changePassword()}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-2.5 rounded-[10px] bg-sales-surface-hover px-3 py-2.5">
                <ShieldCheck size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-sales-text-muted" />
                <p className="text-[12px] text-sales-text-secondary">
                  Changing your password signs out other devices on next request.
                </p>
              </div>
            </CardContent>
          </Card>

          {(clientName || agencyContact) && (
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px]">
                {clientName ? (
                  <p>
                    <span className="text-sales-text-muted">Workspace · </span>
                    <span className="font-medium text-sales-text-primary">{clientName}</span>
                  </p>
                ) : null}
                {agencyContact ? (
                  <p className="text-sales-text-secondary">
                    Support · {agencyContact.name}
                    {agencyContact.email ? ` · ${agencyContact.email}` : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NotifRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = title.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sales-sm bg-[var(--sales-neutral-100)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[13px] font-semibold text-sales-text-primary">
          {title}
        </label>
        <p className="mt-0.5 text-[12px] text-sales-text-secondary">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
