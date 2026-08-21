"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MailCheck, Upload } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { VerticalSettingsNav } from "@/components/settings/VerticalSettingsNav";
import { ClientAvatar } from "@/components/ClientAvatar";
import { QuoteSettingsManager } from "@/components/client-settings/QuoteSettingsManager";
import { DocumentsManager } from "@/components/client-settings/DocumentsManager";
import { WhatsAppInboxSettings } from "@/components/client-settings/WhatsAppInboxSettings";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import { getPublicBaseUrl } from "@/lib/constants";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "notifications", label: "Notifications" },
  { id: "branding", label: "Branding" },
  { id: "quotes", label: "Quotes" },
  { id: "integration", label: "Website" },
  { id: "advanced", label: "Advanced" },
];

const INDUSTRY_SUGGESTIONS = [
  "Construction",
  "Solar",
  "Legal",
  "Real Estate",
  "Medical",
  "Cleaning",
  "HVAC",
  "Landscaping",
  "Roofing",
  "Plumbing",
];

function normalizeSettingsTab(tab: string | null | undefined): string {
  if (!tab) return "profile";
  if (tab === "packages") return "quotes";
  return TABS.some((t) => t.id === tab) ? tab : "profile";
}

type ClientRow = Record<string, unknown>;
type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role?: string;
  also_sells?: boolean;
  round_robin_order: number;
  uncontacted_lead_count?: number;
};
type ManagerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  also_sells?: boolean;
};

export function ClientSettingsClient({
  clientId,
  initialClient,
  initialSalespeople,
  initialManagers,
  initialInstantForms = [],
  agencyDefaultHours,
  initialTab,
  globalWhatsAppQuickConnectEnabled = false,
}: {
  clientId: string;
  initialClient: ClientRow;
  initialSalespeople: UserRow[];
  initialManagers: ManagerRow[];
  initialInstantForms?: { id: string; name: string; status: string }[];
  agencyDefaultHours: number;
  initialTab?: string;
  globalWhatsAppQuickConnectEnabled?: boolean;
}) {
  const TEMP_PASS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const tempPassStorageKey = `client-settings-temp-pass:${clientId}`;
  const [tab, setTab] = useState(() => normalizeSettingsTab(initialTab));
  const notificationsSectionRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [client, setClient] = useState(initialClient);
  const [sales, setSales] = useState(initialSalespeople);
  const [managers, setManagers] = useState<ManagerRow[]>(initialManagers);

  const [profileForm, setProfileForm] = useState({
    name: String(initialClient.name ?? ""),
    industry: String(initialClient.industry ?? ""),
    business_type: (initialClient.business_type === "real_estate" ? "real_estate" : "trades") as
      | "trades"
      | "real_estate",
    slug: String(initialClient.slug ?? ""),
    logo_url: String(initialClient.logo_url ?? ""),
    response_time_limit_hours: Number(initialClient.response_time_limit_hours ?? agencyDefaultHours),
    dial_code: String(initialClient.dial_code ?? "263"),
  });

  const [notifForm, setNotifForm] = useState({
    twilio_whatsapp_override: String(initialClient.twilio_whatsapp_override ?? ""),
    send_prospect_confirmation: (initialClient.send_prospect_confirmation as boolean | null) ?? true,
  });

  const [brandForm, setBrandForm] = useState({
    primary_color: String(initialClient.primary_color ?? "#00D4FF"),
  });

  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [inviteSalesOpen, setInviteSalesOpen] = useState(false);
  const [inviteMgrOpen, setInviteMgrOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [tempPassExpiresAt, setTempPassExpiresAt] = useState<number | null>(null);
  const [inviteEmailResult, setInviteEmailResult] = useState<{
    email: string;
    emailSent: boolean;
    userName?: string;
    source?: "invite" | "reset";
  } | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);

  const savedClientName = useMemo(() => String(client.name ?? "").trim(), [client.name]);
  const profileNameDirty = useMemo(
    () => profileForm.name.trim() !== savedClientName,
    [profileForm.name, savedClientName]
  );

  const rrList = useMemo(
    () => [...sales].filter((s) => s.is_active).sort((a, b) => a.round_robin_order - b.round_robin_order),
    [sales]
  );
  const rrIndex = Number(client.round_robin_index ?? 0);
  const nextUp = rrList.length ? rrList[rrIndex % rrList.length] : null;

  useEffect(() => {
    if (tab !== "team") return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/clients/${clientId}/users?manage=1`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/users?manage=1&role=CLIENT_MANAGER`).then((r) => r.json()),
    ])
      .then(([salesJson, mgrJson]: [{ users?: UserRow[] }, { users?: ManagerRow[] }]) => {
        if (cancelled) return;
        if (salesJson.users) setSales(salesJson.users);
        if (mgrJson.users) setManagers(mgrJson.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, clientId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(tempPassStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { value?: unknown; expiresAt?: unknown };
      const value = typeof parsed.value === "string" ? parsed.value : null;
      const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : null;
      if (!value || !expiresAt) {
        window.localStorage.removeItem(tempPassStorageKey);
        return;
      }
      if (Date.now() >= expiresAt) {
        window.localStorage.removeItem(tempPassStorageKey);
        return;
      }
      setTempPass(value);
      setTempPassExpiresAt(expiresAt);
    } catch {
      // Ignore parse/storage errors in restricted environments.
    }
  }, [tempPassStorageKey]);

  useEffect(() => {
    try {
      if (tempPass) {
        const expiresAt = tempPassExpiresAt ?? Date.now() + TEMP_PASS_TTL_MS;
        window.localStorage.setItem(tempPassStorageKey, JSON.stringify({ value: tempPass, expiresAt }));
        if (tempPassExpiresAt == null) setTempPassExpiresAt(expiresAt);
      } else {
        window.localStorage.removeItem(tempPassStorageKey);
        if (tempPassExpiresAt != null) setTempPassExpiresAt(null);
      }
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [tempPass, tempPassExpiresAt, tempPassStorageKey, TEMP_PASS_TTL_MS]);

  useEffect(() => {
    if (tab !== "notifications") return;
    const id = window.requestAnimationFrame(() => {
      notificationsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [tab]);

  async function patchClient(body: Record<string, unknown>) {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Request failed");
    if (j.client) setClient(j.client);
    return j;
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await patchClient({
        name: profileForm.name.trim(),
        industry: profileForm.industry.trim(),
        business_type: profileForm.business_type,
        slug: profileForm.slug.trim(),
        logo_url: profileForm.logo_url.trim() || null,
        response_time_limit_hours: profileForm.response_time_limit_hours,
        dial_code: profileForm.dial_code.trim() || null,
      });
      setToast("Saved profile.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("File too large. Max 5 MB.");
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const uploadRes = await fetch(`/api/clients/${clientId}/logo/upload`, {
        method: "POST",
        body,
      });
      const payload = (await uploadRes.json().catch(() => ({}))) as {
        publicUrl?: string;
        error?: string;
      };
      if (!uploadRes.ok || !payload.publicUrl) {
        throw new Error(payload.error ?? "Upload failed");
      }
      await patchClient({ logo_url: payload.publicUrl });
      setProfileForm((f) => ({ ...f, logo_url: payload.publicUrl! }));
      setToast("Logo uploaded.");
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveWhatsAppInbox(data: {
    meta_whatsapp_phone_number_id: string | null;
    meta_whatsapp_display_number: string | null;
    meta_whatsapp_access_token: string | null;
    assignment_mode: "direct" | "pool" | "round_robin";
    whatsapp_qualification_enabled: boolean;
    whatsapp_instant_form_id: string | null;
  }) {
    setSaving(true);
    try {
      await patchClient(data);
      setClient((c) => ({ ...c, ...data }));
      setToast("Saved WhatsApp inbox settings.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSaving(true);
    try {
      await patchClient({
        twilio_whatsapp_override: notifForm.twilio_whatsapp_override.trim() || null,
        send_prospect_confirmation: notifForm.send_prospect_confirmation,
      });
      setToast("Saved notification settings.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding() {
    setSaving(true);
    try {
      await patchClient({
        primary_color: brandForm.primary_color,
      });
      setToast("Saved branding.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    const confirmName = deleteConfirm.trim();
    if (!confirmName || confirmName !== savedClientName) {
      setToast("Type the exact client name to confirm deletion.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteConfirmName: confirmName }),
      });
      const j = (await res.json()) as { error?: string; archived?: boolean };
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setToast("Client archived. Slug, public profile, and Facebook connection were released.");
      window.location.assign("/dashboard/clients");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const items = Array.from(rrList);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    const orderedUserIds = items.map((x) => x.id);
    const res = await fetch(`/api/clients/${clientId}/sales-order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedUserIds }),
    });
    if (!res.ok) {
      const j = await res.json();
      setToast(j.error ?? "Reorder failed");
      return;
    }
    setSales(items.map((u, i) => ({ ...u, round_robin_order: i })));
    setToast("Rotation order updated.");
  }

  async function inviteSales() {
    setSaving(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "SALESPERSON",
          name: inviteForm.name,
          email: inviteForm.email,
          phone: inviteForm.phone,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const newUser = j.user as Partial<UserRow> | undefined;
      const emailSent = typeof j.emailSent === "boolean" ? j.emailSent : false;
      setInviteEmailResult({ email: inviteForm.email, emailSent, userName: inviteForm.name, source: "invite" });
      if (j.temporaryPassword) {
        setTempPass(j.temporaryPassword as string);
        setTempPassExpiresAt(Date.now() + TEMP_PASS_TTL_MS);
      }
      if (j.message) setToast(String(j.message));
      setInviteSalesOpen(false);
      setInviteForm({ name: "", email: "", phone: "" });
      const newUserId = typeof newUser?.id === "string" ? newUser.id : null;
      const newUserName = typeof newUser?.name === "string" ? newUser.name : null;
      const newUserEmail = typeof newUser?.email === "string" ? newUser.email : null;
      const newUserPhone = typeof newUser?.phone === "string" ? newUser.phone : null;
      if (newUserId && newUserName && newUserEmail) {
        setSales((prev) => [
          ...prev,
          {
            id: newUserId,
            name: newUserName,
            email: newUserEmail,
            phone: newUserPhone,
            is_active: true,
            round_robin_order: prev.length,
          },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setInviteError(msg);
      setToast(msg);
    } finally {
      setSaving(false);
    }
  }

  async function inviteManager() {
    setSaving(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "CLIENT_MANAGER",
          name: inviteForm.name,
          email: inviteForm.email,
          phone: inviteForm.phone,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const newMgr = j.user as Partial<ManagerRow> | undefined;
      const emailSent = typeof j.emailSent === "boolean" ? j.emailSent : false;
      setInviteEmailResult({ email: inviteForm.email, emailSent, userName: inviteForm.name, source: "invite" });
      if (j.temporaryPassword) {
        setTempPass(j.temporaryPassword as string);
        setTempPassExpiresAt(Date.now() + TEMP_PASS_TTL_MS);
      }
      if (j.message) setToast(String(j.message));
      setInviteMgrOpen(false);
      setInviteForm({ name: "", email: "", phone: "" });
      if (newMgr?.id && newMgr?.name && newMgr?.email) {
        const added: ManagerRow = {
          id: newMgr.id,
          name: newMgr.name,
          email: newMgr.email,
          phone: typeof newMgr.phone === "string" ? newMgr.phone : null,
          is_active: true,
        };
        setManagers((prev) => [...prev, added]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setInviteError(msg);
      setToast(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSales(id: string, is_active: boolean) {
    const rep = sales.find((s) => s.id === id);
    if (!is_active && rep && (rep.uncontacted_lead_count ?? 0) > 0) {
      const ok = window.confirm(
        `${rep.name} has ${rep.uncontacted_lead_count} uncontacted lead(s). Deactivating will redistribute them to other active salespeople. Continue?`
      );
      if (!ok) return;
    }

    const res = await fetch(`/api/clients/${clientId}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    const j = (await res.json()) as {
      error?: string;
      migration?: { migrated: number; unassigned: number };
    };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }
    setSales((prev) => prev.map((u) => (u.id === id ? { ...u, is_active, uncontacted_lead_count: 0 } : u)));
    if (j.migration && j.migration.migrated + j.migration.unassigned > 0) {
      setToast(
        `Deactivated. ${j.migration.migrated} uncontacted lead(s) reassigned${j.migration.unassigned ? `, ${j.migration.unassigned} left unassigned` : ""}.`
      );
    }
  }

  async function promoteToManager(id: string) {
    const rep = sales.find((s) => s.id === id);
    if (!rep) return;

    const leadNote =
      (rep.uncontacted_lead_count ?? 0) > 0
        ? ` Their ${rep.uncontacted_lead_count} uncontacted lead(s) will be redistributed to other salespeople.`
        : "";
    if (
      !window.confirm(
        `Promote ${rep.name} to manager? They will gain manager access alongside existing managers.${leadNote} Continue?`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/clients/${clientId}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "CLIENT_MANAGER" }),
    });
    const j = (await res.json()) as {
      error?: string;
      migration?: { migrated: number; unassigned: number };
      manager?: ManagerRow;
    };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }

    const promoted = j.manager;
    if (promoted?.id && promoted?.name && promoted?.email) {
      setManagers((prev) => [
        ...prev,
        {
          id: promoted.id,
          name: promoted.name,
          email: promoted.email,
          phone: promoted.phone ?? null,
          is_active: promoted.is_active ?? true,
        },
      ]);
    }
    setSales((prev) => prev.filter((u) => u.id !== id));
    const migrated = j.migration?.migrated ?? 0;
    setToast(
      `${rep.name} is now a manager.${migrated > 0 ? ` ${migrated} uncontacted lead(s) were redistributed.` : ""}`
    );
  }

  async function toggleManager(id: string, is_active: boolean) {
    const mgr = managers.find((m) => m.id === id);
    if (!is_active && mgr?.also_sells) {
      const ok = window.confirm(
        `${mgr.name} is a selling manager. Deactivating will turn off selling and redistribute their uncontacted leads. Continue?`
      );
      if (!ok) return;
    }

    const res = await fetch(`/api/clients/${clientId}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }
    setManagers((prev) => prev.map((m) => (m.id === id ? { ...m, is_active } : m)));
    if (mgr?.also_sells && !is_active) {
      setSales((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function toggleAlsoSells(manager: ManagerRow, also_sells: boolean) {
    if (also_sells && !manager.phone) {
      setToast("Add a phone number for this manager before enabling Also sells.");
      return;
    }

    if (!also_sells) {
      const count = sales.find((s) => s.id === manager.id)?.uncontacted_lead_count ?? 0;
      if (count > 0) {
        const ok = window.confirm(
          `${manager.name} has ${count} uncontacted lead(s). Turning off Also sells will redistribute them. Continue?`
        );
        if (!ok) return;
      }
    }

    const res = await fetch(`/api/clients/${clientId}/users/${manager.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ also_sells, phone: manager.phone ?? undefined }),
    });
    const j = (await res.json()) as {
      error?: string;
      manager?: ManagerRow & { round_robin_order?: number };
      migration?: { migrated: number; unassigned: number };
      requiresReauth?: boolean;
    };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }

    const updated = j.manager ?? { ...manager, also_sells };
    setManagers((prev) => prev.map((m) => (m.id === manager.id ? { ...m, ...updated } : m)));

    if (also_sells && updated) {
      setSales((prev) => {
        const without = prev.filter((s) => s.id !== manager.id);
        return [
          ...without,
          {
            id: manager.id,
            name: manager.name,
            email: manager.email,
            phone: manager.phone,
            is_active: manager.is_active,
            role: "CLIENT_MANAGER",
            also_sells: true,
            round_robin_order: updated.round_robin_order ?? without.length,
            uncontacted_lead_count: 0,
          },
        ].sort((a, b) => a.round_robin_order - b.round_robin_order);
      });
    } else {
      setSales((prev) => prev.filter((s) => s.id !== manager.id));
    }

    if (j.migration && j.migration.migrated + j.migration.unassigned > 0) {
      setToast(
        `Also sells off. ${j.migration.migrated} uncontacted lead(s) reassigned${j.migration.unassigned ? `, ${j.migration.unassigned} left unassigned` : ""}.`
      );
    } else if (also_sells) {
      setToast("Also sells enabled — open My leads from the sidebar to work your assigned pipeline.");
    } else {
      setToast("Also sells turned off.");
    }
  }

  async function removeManager(id: string) {
    if (!window.confirm("Remove this manager? Their account will be deleted.")) return;
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, { method: "DELETE" });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }
    setManagers((prev) => prev.filter((m) => m.id !== id));
    setToast("Manager removed.");
  }

  async function removeSales(id: string) {
    const rep = sales.find((s) => s.id === id);
    const leadNote =
      rep && (rep.uncontacted_lead_count ?? 0) > 0
        ? ` ${rep.uncontacted_lead_count} uncontacted lead(s) will be redistributed first.`
        : "";
    if (!window.confirm(`Remove this salesperson?${leadNote}`)) return;
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      setToast(j.error ?? "Failed");
      return;
    }
    setSales((prev) => prev.filter((u) => u.id !== id));
  }

  async function copyTempPassword() {
    if (!tempPass) return;
    const text = inviteEmailResult?.email
      ? `Email: ${inviteEmailResult.email}\nPassword: ${tempPass}`
      : tempPass;
    try {
      await navigator.clipboard.writeText(text);
      setToast(inviteEmailResult?.email ? "Login details copied." : "Temporary password copied.");
    } catch {
      setToast("Could not copy automatically. Please copy manually.");
    }
  }

  async function resetUserPassword(user: { id: string; name: string; email: string }) {
    if (
      !window.confirm(
        `Generate a new temporary password for ${user.name}? They will be signed out of all devices. You will see the new password so you can share it with them manually.`
      )
    ) {
      return;
    }
    setResettingPasswordId(user.id);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${user.id}/reset-password`, {
        method: "POST",
      });
      const j = (await res.json()) as { error?: string; emailSent?: boolean; temporaryPassword?: string };
      if (!res.ok) {
        setToast(j.error ?? "Failed to reset password");
        return;
      }
      const emailSent = j.emailSent === true;
      setInviteEmailResult({ email: user.email, emailSent, userName: user.name, source: "reset" });
      if (j.temporaryPassword) {
        setTempPass(j.temporaryPassword);
        setTempPassExpiresAt(Date.now() + TEMP_PASS_TTL_MS);
      }
      setToast(`New password for ${user.name}. Copy and share it with them manually.`);
    } finally {
      setResettingPasswordId(null);
    }
  }

  return (
    <div className="flex gap-10 pb-24">
      <VerticalSettingsNav tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-w-0 flex-1">
        {toast ? (
          <div className="mb-4 rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm">{toast}</div>
        ) : null}
        {tempPass && inviteEmailResult ? (
          <div className="mb-4 rounded-xl border border-border bg-surface-card-alt px-3.5 py-3">
            <p className="mb-2 text-xs font-semibold text-ink-primary">
              {inviteEmailResult.source === "reset" ? "New login details for" : "Login details for"}{" "}
              {inviteEmailResult.userName ?? inviteEmailResult.email} — share manually (e.g. WhatsApp):
            </p>
            <p className="mb-1 text-[13px] text-ink-primary">Email: {inviteEmailResult.email}</p>
            <p className="mb-2 font-mono text-[13px] text-ink-primary">Password: {tempPass}</p>
            {inviteEmailResult.emailSent ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-secondary">
                <MailCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                Also emailed to {inviteEmailResult.email}.
              </p>
            ) : (
              <p className="mb-2 text-xs text-[var(--warning)]">
                Email could not be sent — please share these credentials yourself.
              </p>
            )}
            <button type="button" className="mr-3 text-xs underline" onClick={() => void copyTempPassword()}>
              Copy login details
            </button>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                setInviteEmailResult(null);
                setTempPass(null);
                setTempPassExpiresAt(null);
              }}
            >
              Dismiss
            </button>
          </div>
        ) : tempPass ? (
          <div className="mb-4 rounded-md border border-[var(--warning-border)] bg-[var(--warning-muted)] px-3 py-2 text-sm">
            Temporary password: <code className="font-mono">{tempPass}</code>
            <button type="button" className="ml-2 underline" onClick={() => void copyTempPassword()}>
              Copy
            </button>
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setTempPass(null);
                setTempPassExpiresAt(null);
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl">Profile</h2>
            <p className="text-xs text-ink-tertiary">
              Default response SLA from agency: {agencyDefaultHours}h (used when creating new clients).
            </p>
            <div className="grid max-w-lg gap-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Client name</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Industry</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.industry}
                  onChange={(e) => setProfileForm((f) => ({ ...f, industry: e.target.value }))}
                  list="industry-suggestions"
                />
                <datalist id="industry-suggestions">
                  {INDUSTRY_SUGGESTIONS.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Business type</span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.business_type}
                  onChange={(e) =>
                    setProfileForm((f) => ({
                      ...f,
                      business_type: e.target.value as "trades" | "real_estate",
                    }))
                  }
                >
                  <option value="trades">Trades (default)</option>
                  <option value="real_estate">Real estate</option>
                </select>
                <p className="mt-1 text-xs text-ink-tertiary">
                  Real estate unlocks Listings, Viewings, and Agent terminology. Trades clients are unchanged.
                </p>
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Subdomain slug</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
                  value={profileForm.slug}
                  onChange={(e) => setProfileForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                />
              </label>
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Logo</span>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <ClientAvatar
                    name={profileForm.name || "Client"}
                    size={64}
                    src={profileForm.logo_url || null}
                  />
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoFile(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo || saving}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-card px-3 py-2 text-sm font-medium text-ink-primary hover:border-border-hover disabled:opacity-50"
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingLogo ? "Uploading…" : "Upload logo"}
                    </button>
                  </div>
                </div>
                {logoError ? <p className="mt-2 text-xs text-[var(--danger-fg)]">{logoError}</p> : null}
              </div>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Logo URL</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.logo_url}
                  onChange={(e) => setProfileForm((f) => ({ ...f, logo_url: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Response time limit (hours)</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.response_time_limit_hours}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, response_time_limit_hours: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Default country dial code</span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                  value={profileForm.dial_code}
                  onChange={(e) => setProfileForm((f) => ({ ...f, dial_code: e.target.value }))}
                >
                  <option value="263">Zimbabwe (+263)</option>
                  <option value="260">Zambia (+260)</option>
                  <option value="27">South Africa (+27)</option>
                  <option value="254">Kenya (+254)</option>
                </select>
              </label>
            </div>

            <div className="mt-12 border-t border-[var(--danger-border)] pt-8 pb-8">
              <h3 className="text-sm font-semibold text-[var(--danger-fg)]">Danger zone</h3>
              <p className="mt-2 text-sm text-ink-secondary">
                Type the client name <strong>{savedClientName || "—"}</strong> to archive and hide this client from
                lists.
                {profileNameDirty ? (
                  <>
                    {" "}
                    You have unsaved name changes — click <strong>Save</strong> below first.
                  </>
                ) : null}
              </p>
              <input
                className="mt-3 max-w-md rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary"
                placeholder="Client name"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="mt-3 block rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger-fg)]"
                disabled={
                  saving || !savedClientName || profileNameDirty || deleteConfirm.trim() !== savedClientName
                }
                onClick={() => void deleteClient()}
              >
                Delete client
              </button>
            </div>

            <div className="safe-bottom sticky bottom-0 z-10 border-t border-border bg-[var(--surface-page)] pt-4">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveProfile()}>
                Save
              </button>
            </div>
          </div>
        ) : null}

        {tab === "team" ? (
          <div className="space-y-8">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-[10px] uppercase text-ink-tertiary">Managers</h3>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => {
                    setInviteError(null);
                    setInviteMgrOpen(true);
                  }}
                >
                  Add manager
                </button>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
                Clients can have multiple active managers with full team oversight.
              </p>
              <p className="mt-1 text-xs text-ink-tertiary">
                Turn on Also sells when a manager takes calls and closes deals like a salesperson.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-card-alt font-mono text-[10px] uppercase text-ink-tertiary">
                    <tr>
                      <th className="px-3 py-2">Manager</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Also sells</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-tertiary">
                          No managers yet. Add the first manager above.
                        </td>
                      </tr>
                    ) : (
                      managers.map((m) => (
                        <tr key={m.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <ClientAvatar name={m.name} size="sm" />
                              {m.name}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{m.email}</td>
                          <td className="px-3 py-2 text-xs">{m.phone ?? "—"}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(m.also_sells)}
                              disabled={!m.is_active}
                              title={!m.phone ? "Add a phone number first" : undefined}
                              onChange={(e) => void toggleAlsoSells(m, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={m.is_active}
                              onChange={(e) => void toggleManager(m.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="mr-3 text-xs text-[var(--accent)] disabled:opacity-50"
                              disabled={!m.is_active || resettingPasswordId === m.id}
                              onClick={() => void resetUserPassword(m)}
                            >
                              {resettingPasswordId === m.id ? "Resetting…" : "Reset password"}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-[var(--danger-fg)]"
                              onClick={() => void removeManager(m.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-[10px] uppercase text-ink-tertiary">Salespeople</h3>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => {
                    setInviteError(null);
                    setInviteSalesOpen(true);
                  }}
                >
                  Add salesperson
                </button>
              </div>

              {rrList.filter((s) => s.is_active).length > 0 ? (
                <div className="mt-4">
                  <p className="text-sm text-ink-secondary">
                    Next up: <span className="font-medium text-ink-primary">{nextUp?.name ?? "—"}</span>
                  </p>
                  <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
                    <Droppable droppableId="rr" direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="mt-3 flex flex-wrap items-center gap-2"
                        >
                          {rrList.map((s, index) => (
                            <Draggable key={s.id} draggableId={s.id} index={index}>
                              {(p) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className="flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-1"
                                >
                                  <ClientAvatar name={s.name} size={28} />
                                  <span className="max-w-[100px] truncate text-xs">{s.name}</span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                  <p className="mt-2 text-[11px] text-ink-tertiary">Drag to reorder round-robin rotation.</p>
                </div>
              ) : null}

              <div className="mt-6 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-card-alt font-mono text-[10px] uppercase text-ink-tertiary">
                    <tr>
                      <th className="px-3 py-2">Rep</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Uncontacted</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <ClientAvatar name={s.name} size="sm" />
                            {s.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{s.email}</td>
                        <td className="px-3 py-2 text-xs">{s.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {(s.uncontacted_lead_count ?? 0) > 0 ? (
                            <span className="font-medium text-[var(--warning)]">{s.uncontacted_lead_count}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={s.is_active}
                            onChange={(e) => void toggleSales(s.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="mr-3 text-xs text-[var(--accent)] disabled:opacity-50"
                            disabled={!s.is_active || resettingPasswordId === s.id}
                            onClick={() => void resetUserPassword(s)}
                          >
                            {resettingPasswordId === s.id ? "Resetting…" : "Reset password"}
                          </button>
                          <button
                            type="button"
                            className="mr-3 text-xs text-[var(--accent)]"
                            onClick={() => void promoteToManager(s.id)}
                          >
                            Promote to manager
                          </button>
                          <button type="button" className="text-xs text-[var(--danger-fg)]" onClick={() => void removeSales(s.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {(inviteSalesOpen || inviteMgrOpen) && (
              <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-overlay)] p-0 md:items-center md:justify-center md:p-4">
                <div className="flex h-full w-full max-w-md flex-col border border-border bg-surface-card p-5 shadow-lg md:h-auto md:rounded-xl md:p-6">
                  <h3 className="font-display text-xl">{inviteSalesOpen ? "Invite salesperson" : "Invite manager"}</h3>
                  <label className="mt-3 block text-sm">
                    Name
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary md:text-sm"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                      autoCapitalize="words"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Email
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary md:text-sm"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                      inputMode="email"
                      autoCapitalize="off"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Phone (E.164{inviteMgrOpen ? ", optional for manager" : ""})
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-base text-ink-primary placeholder:text-ink-tertiary md:text-sm"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+15551234567"
                      inputMode="tel"
                    />
                  </label>
                  {inviteError ? (
                    <p className="mt-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-fg)]">
                      {inviteError}
                    </p>
                  ) : null}
                  <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border pt-4 md:mt-4 md:border-t-0 md:pt-0">
                    <button
                      type="button"
                      className="btn-ghost h-11 flex-1 md:h-9 md:flex-none"
                      onClick={() => {
                        setInviteError(null);
                        setInviteSalesOpen(false);
                        setInviteMgrOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary h-11 flex-1 md:h-9 md:flex-none"
                      disabled={saving}
                      onClick={() => void (inviteSalesOpen ? inviteSales() : inviteManager())}
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {tab === "whatsapp" ? (
          <WhatsAppInboxSettings
            clientId={clientId}
            clientName={String(client.name ?? "Client")}
            initialPhoneNumberId={String(client.meta_whatsapp_phone_number_id ?? "")}
            initialDisplayNumber={String(client.meta_whatsapp_display_number ?? "")}
            initialAccessToken={String(client.meta_whatsapp_access_token ?? "")}
            initialAssignmentMode={
              (client.assignment_mode as "direct" | "pool" | "round_robin" | undefined) ?? "round_robin"
            }
            initialQualificationEnabled={client.whatsapp_qualification_enabled !== false}
            initialInstantFormId={(client.whatsapp_instant_form_id as string | null) ?? null}
            initialWhatsAppQuickConnectEnabled={Boolean(client.whatsapp_temporary_web_enabled)}
            globalWhatsAppQuickConnectEnabled={globalWhatsAppQuickConnectEnabled}
            instantForms={initialInstantForms}
            webhookBaseUrl={getPublicBaseUrl()}
            saving={saving}
            onSave={saveWhatsAppInbox}
          />
        ) : null}

        {tab === "notifications" ? (
          <div
            id="client-settings-notifications"
            ref={notificationsSectionRef}
            className="max-w-lg scroll-mt-24 space-y-6"
          >
            <h2 className="font-display text-2xl">Notifications</h2>
            <p className="text-sm text-ink-secondary">
              Client managers choose email and WhatsApp alerts per event on their{" "}
              <strong className="text-ink-primary">Account</strong> page (client portal → Account).
            </p>
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Test WhatsApp redirect (optional)</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
                value={notifForm.twilio_whatsapp_override}
                onChange={(e) => setNotifForm((f) => ({ ...f, twilio_whatsapp_override: e.target.value }))}
                placeholder="Leave blank — sends to each user's phone"
              />
              <p className="mt-1 text-xs text-ink-secondary">
                Legacy testing field. When set to a valid phone number, all WhatsApp alerts for this client go there
                instead of salespeople/managers. Leave blank in production.
              </p>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative inline-block">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={notifForm.send_prospect_confirmation}
                  onChange={(e) => setNotifForm((f) => ({ ...f, send_prospect_confirmation: e.target.checked }))}
                />
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${
                    notifForm.send_prospect_confirmation ? "bg-[var(--info)]" : "bg-surface-card-alt border border-border"
                  }`}
                />
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    notifForm.send_prospect_confirmation ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-primary">Prospect confirmation WhatsApp</p>
                <p className="text-xs text-ink-secondary">
                  Send an automatic WhatsApp message to the prospect right after they submit the form,
                  confirming receipt and sharing the portfolio link.
                </p>
              </div>
            </label>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveNotifications()}>
              Save
            </button>
          </div>
        ) : null}

        {tab === "branding" ? (
          <div className="max-w-lg space-y-6">
            <h2 className="font-display text-2xl">Branding</h2>
            <label className="block">
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Primary color</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={brandForm.primary_color}
                  onChange={(e) => setBrandForm((f) => ({ ...f, primary_color: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0"
                />
                <input
                  className="flex-1 rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
                  value={brandForm.primary_color}
                  onChange={(e) => setBrandForm((f) => ({ ...f, primary_color: e.target.value }))}
                />
              </div>
            </label>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveBranding()}>
              Save
            </button>
          </div>
        ) : null}

        {tab === "quotes" ? (
          <div className="space-y-10">
            <div className="space-y-6">
              <h2 className="font-display text-2xl">Quotations</h2>
              <QuoteSettingsManager clientId={clientId} />
            </div>
            <DocumentsManager clientId={clientId} />
          </div>
        ) : null}

        {tab === "integration" ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl">Website Integration</h2>
            <WebsiteIntegrationPanel clientId={clientId} />
          </div>
        ) : null}

        {tab === "advanced" ? (
          <div className="space-y-6">
            <h2 className="font-display text-2xl">Advanced</h2>
            <button
              type="button"
              className="btn-ghost border border-border"
              onClick={() => {
                window.open(`/api/clients/${clientId}/export`, "_blank");
              }}
            >
              Export all leads (CSV)
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm"
                disabled={saving || client.is_active === false}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await patchClient({ is_active: false });
                    setToast("Client paused — landing returns 404.");
                    window.location.reload();
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : "Error");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Pause client
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--warning-border)] px-4 py-2 text-sm text-[var(--warning)]"
                disabled={saving || Boolean(client.is_archived)}
                onClick={async () => {
                  if (!window.confirm("Archive this client? It will disappear from lists.")) return;
                  setSaving(true);
                  try {
                    await patchClient({ is_archived: true, is_active: false });
                    setToast("Archived.");
                    window.location.href = "/dashboard/clients";
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : "Error");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Archive client
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
