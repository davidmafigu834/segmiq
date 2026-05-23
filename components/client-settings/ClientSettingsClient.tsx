"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { VerticalSettingsNav } from "@/components/settings/VerticalSettingsNav";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PackagesManager } from "@/components/client-settings/PackagesManager";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "notifications", label: "Notifications" },
  { id: "branding", label: "Branding" },
  { id: "packages", label: "Packages" },
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
  return TABS.some((t) => t.id === tab) ? tab : "profile";
}

type ClientRow = Record<string, unknown>;
type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  round_robin_order: number;
};
type ManagerRow = { id: string; name: string; email: string; phone: string | null };

export function ClientSettingsClient({
  clientId,
  initialClient,
  initialSalespeople,
  initialManager,
  agencyDefaultHours,
  initialTab,
}: {
  clientId: string;
  initialClient: ClientRow;
  initialSalespeople: UserRow[];
  initialManager: { id: string; name: string; email: string; phone: string | null } | null;
  agencyDefaultHours: number;
  initialTab?: string;
}) {
  const TEMP_PASS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const tempPassStorageKey = `client-settings-temp-pass:${clientId}`;
  const [tab, setTab] = useState(() => normalizeSettingsTab(initialTab));
  const notificationsSectionRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [client, setClient] = useState(initialClient);
  const [sales, setSales] = useState(initialSalespeople);
  const [manager, setManager] = useState<ManagerRow | null>(initialManager);

  const [profileForm, setProfileForm] = useState({
    name: String(initialClient.name ?? ""),
    industry: String(initialClient.industry ?? ""),
    slug: String(initialClient.slug ?? ""),
    logo_url: String(initialClient.logo_url ?? ""),
    response_time_limit_hours: Number(initialClient.response_time_limit_hours ?? agencyDefaultHours),
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
  const [inviteEmailResult, setInviteEmailResult] = useState<{ email: string; emailSent: boolean } | null>(null);

  const savedClientName = useMemo(() => String(client.name ?? "").trim(), [client.name]);

  const rrList = useMemo(
    () => [...sales].filter((s) => s.is_active).sort((a, b) => a.round_robin_order - b.round_robin_order),
    [sales]
  );
  const rrIndex = Number(client.round_robin_index ?? 0);
  const nextUp = rrList.length ? rrList[rrIndex % rrList.length] : null;

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
        slug: profileForm.slug.trim(),
        logo_url: profileForm.logo_url.trim() || null,
        response_time_limit_hours: profileForm.response_time_limit_hours,
      });
      setToast("Saved profile.");
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
    setSaving(true);
    try {
      await patchClient({ deleteConfirmName: deleteConfirm.trim() });
      setToast("Client archived.");
      window.location.href = "/dashboard/clients";
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
      setInviteEmailResult({ email: inviteForm.email, emailSent });
      if (!emailSent && j.temporaryPassword) {
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
      setInviteEmailResult({ email: inviteForm.email, emailSent });
      if (!emailSent && j.temporaryPassword) {
        setTempPass(j.temporaryPassword as string);
        setTempPassExpiresAt(Date.now() + TEMP_PASS_TTL_MS);
      }
      if (j.message) setToast(String(j.message));
      setInviteMgrOpen(false);
      setInviteForm({ name: "", email: "", phone: "" });
      if (newMgr?.id && newMgr?.name && newMgr?.email) {
        setManager({
          id: newMgr.id,
          name: newMgr.name,
          email: newMgr.email,
          phone: typeof newMgr.phone === "string" ? newMgr.phone : null,
        });
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
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      const j = await res.json();
      setToast(j.error ?? "Failed");
      return;
    }
    setSales((prev) => prev.map((u) => (u.id === id ? { ...u, is_active } : u)));
  }

  async function removeSales(id: string) {
    if (!window.confirm("Remove this salesperson?")) return;
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
    try {
      await navigator.clipboard.writeText(tempPass);
      setToast("Temporary password copied.");
    } catch {
      setToast("Could not copy automatically. Please copy manually.");
    }
  }

  return (
    <div className="flex gap-10 pb-24">
      <VerticalSettingsNav tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-w-0 flex-1">
        {toast ? (
          <div className="mb-4 rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm">{toast}</div>
        ) : null}
        {inviteEmailResult?.emailSent === true ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "rgba(61,214,140,0.08)", border: "0.5px solid rgba(61,214,140,0.2)", borderRadius: 10, marginBottom: 16 }}>
            <i className="ti ti-mail-check" style={{ fontSize: 16, color: "#3dd68c" }} />
            <p style={{ fontSize: 13, color: "#3dd68c", margin: 0, flex: 1 }}>
              Login details sent to {inviteEmailResult.email}
            </p>
            <button type="button" style={{ fontSize: 12, color: "#3dd68c", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }} onClick={() => setInviteEmailResult(null)}>
              Dismiss
            </button>
          </div>
        ) : inviteEmailResult?.emailSent === false ? (
          <div style={{ padding: "12px 14px", background: "rgba(245,166,35,0.08)", border: "0.5px solid rgba(245,166,35,0.2)", borderRadius: 10, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#f5a623", margin: "0 0 8px", fontWeight: 600 }}>
              Email failed to send. Share these credentials manually:
            </p>
            <p style={{ fontSize: 13, color: "#ededed", margin: "0 0 4px" }}>
              Email: {inviteEmailResult.email}
            </p>
            <p style={{ fontSize: 13, color: "#ededed", margin: "0 0 8px", fontFamily: "monospace" }}>
              Password: {tempPass}
            </p>
            <div>
              <button type="button" style={{ fontSize: 12, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", marginRight: 12 }} onClick={() => void copyTempPassword()}>
                Copy password
              </button>
              <button type="button" style={{ fontSize: 12, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }} onClick={() => { setInviteEmailResult(null); setTempPass(null); }}>
                Dismiss
              </button>
            </div>
          </div>
        ) : tempPass ? (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Temporary password: <code className="font-mono">{tempPass}</code>
            <button type="button" className="ml-2 underline" onClick={() => void copyTempPassword()}>
              Copy
            </button>
            <button type="button" className="ml-2 underline" onClick={() => setTempPass(null)}>
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
                <span className="font-mono text-[10px] uppercase text-ink-tertiary">Subdomain slug</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
                  value={profileForm.slug}
                  onChange={(e) => setProfileForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                />
              </label>
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
            </div>
            <div className="sticky bottom-0 border-t border-border bg-[var(--surface-page)] pt-4">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveProfile()}>
                Save
              </button>
            </div>

            <div className="mt-12 border-t border-[var(--danger-border)] pt-8">
              <h3 className="text-sm font-semibold text-[var(--danger-fg)]">Danger zone</h3>
              <p className="mt-2 text-sm text-ink-secondary">
                Type the <strong>saved</strong> client name <strong>{savedClientName || "—"}</strong> to archive and hide
                this client. If you edited the name above, click <strong>Save</strong> first so the confirmation matches
                what is stored.
              </p>
              <input
                className="mt-3 max-w-md rounded-md border border-border px-3 py-2 text-sm"
                placeholder="Client name"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="mt-3 block rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger-fg)]"
                disabled={saving || !savedClientName || deleteConfirm.trim() !== savedClientName}
                onClick={() => void deleteClient()}
              >
                Delete client
              </button>
            </div>
          </div>
        ) : null}

        {tab === "team" ? (
          <div className="space-y-8">
            <section>
              <h3 className="font-mono text-[10px] uppercase text-ink-tertiary">Manager</h3>
              {manager ? (
                <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-card p-4">
                  <ClientAvatar name={manager.name} size="md" />
                  <div>
                    <div className="font-medium">{manager.name}</div>
                    <div className="font-mono text-xs text-ink-secondary">{manager.email}</div>
                    <div className="text-xs text-ink-tertiary">{manager.phone ?? "—"}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost ml-auto text-sm"
                    onClick={() => {
                      setInviteError(null);
                      setInviteMgrOpen(true);
                    }}
                  >
                    Replace / invite
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary mt-2"
                  onClick={() => {
                    setInviteError(null);
                    setInviteMgrOpen(true);
                  }}
                >
                  Invite manager
                </button>
              )}
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

              <div className="mt-6 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-card-alt font-mono text-[10px] uppercase text-ink-tertiary">
                    <tr>
                      <th className="px-3 py-2">Rep</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th>
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
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={s.is_active}
                            onChange={(e) => void toggleSales(s.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
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
                <div className="flex h-full w-full max-w-md flex-col border border-border bg-surface-card p-5 shadow-lg md:h-auto md:rounded-lg md:p-6">
                  <h3 className="font-display text-xl">{inviteSalesOpen ? "Invite salesperson" : "Invite manager"}</h3>
                  <label className="mt-3 block text-sm">
                    Name
                    <input
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-base md:text-sm"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                      autoCapitalize="words"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Email
                    <input
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-base md:text-sm"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                      inputMode="email"
                      autoCapitalize="off"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Phone (E.164{inviteMgrOpen ? ", optional for manager" : ""})
                    <input
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-base md:text-sm"
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
              <span className="font-mono text-[10px] uppercase text-ink-tertiary">Twilio WhatsApp override</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm"
                value={notifForm.twilio_whatsapp_override}
                onChange={(e) => setNotifForm((f) => ({ ...f, twilio_whatsapp_override: e.target.value }))}
                placeholder="Leave blank to use agency default"
              />
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

        {tab === "packages" ? (
          <div className="max-w-2xl space-y-6">
            <h2 className="font-display text-2xl">Packages &amp; Documents</h2>
            <PackagesManager clientId={clientId} />
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
                className="rounded-md border border-amber-500/40 px-4 py-2 text-sm text-amber-800"
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
