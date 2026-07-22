"use client";

import { useEffect, useMemo, useState } from "react";
import { MailCheck } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ClientAvatar } from "@/components/ClientAvatar";

type ManagerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  also_sells?: boolean;
};

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

export function TeamMembersManager({
  clientId,
  roundRobinIndex = 0,
}: {
  clientId: string;
  /** Current round-robin pointer on the client (for "next up" label). */
  roundRobinIndex?: number;
}) {
  const [sales, setSales] = useState<UserRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMgrOpen, setInviteMgrOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [inviteEmailResult, setInviteEmailResult] = useState<{
    email: string;
    emailSent: boolean;
    userName?: string;
    source?: "invite" | "reset";
  } | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);

  const rrList = useMemo(
    () => [...sales].filter((s) => s.is_active).sort((a, b) => a.round_robin_order - b.round_robin_order),
    [sales]
  );
  const nextUp = rrList.length ? rrList[roundRobinIndex % rrList.length] : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/clients/${clientId}/users?manage=1`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/users?manage=1&role=CLIENT_MANAGER`).then((r) => r.json()),
    ])
      .then(([salesJson, mgrJson]: [{ users?: UserRow[]; error?: string }, { users?: ManagerRow[] }]) => {
        if (cancelled) return;
        if (salesJson.users) setSales(salesJson.users);
        else if (salesJson.error) setToast(salesJson.error);
        if (mgrJson.users) setManagers(mgrJson.users);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

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
      setToast((j as { error?: string }).error ?? "Reorder failed");
      return;
    }
    setSales(items.map((u, i) => ({ ...u, round_robin_order: i })));
    setToast("Rotation order updated.");
  }

  async function inviteSalesperson() {
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
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed");
      const newUser = (j as { user?: Partial<UserRow> }).user;
      const emailSent = typeof (j as { emailSent?: boolean }).emailSent === "boolean" ? (j as { emailSent: boolean }).emailSent : false;
      setInviteEmailResult({ email: inviteForm.email, emailSent, userName: inviteForm.name, source: "invite" });
      if ((j as { temporaryPassword?: string }).temporaryPassword) {
        setTempPass((j as { temporaryPassword: string }).temporaryPassword);
      }
      if ((j as { message?: string }).message) setToast(String((j as { message: string }).message));
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", phone: "" });
      const newId = newUser?.id;
      const newName = newUser?.name;
      const newEmail = newUser?.email;
      if (newId && newName && newEmail) {
        setSales((prev) => [
          ...prev,
          {
            id: newId,
            name: newName,
            email: newEmail,
            phone: typeof newUser.phone === "string" ? newUser.phone : null,
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
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed");
      const newMgr = (j as { user?: Partial<ManagerRow> }).user;
      const emailSent = typeof (j as { emailSent?: boolean }).emailSent === "boolean" ? (j as { emailSent: boolean }).emailSent : false;
      setInviteEmailResult({ email: inviteForm.email, emailSent, userName: inviteForm.name, source: "invite" });
      if ((j as { temporaryPassword?: string }).temporaryPassword) {
        setTempPass((j as { temporaryPassword: string }).temporaryPassword);
      }
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
      setToast("Manager invited.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setInviteError(msg);
      setToast(msg);
    } finally {
      setSaving(false);
    }
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
      setToast(
        j.requiresReauth
          ? "Also sells enabled. Sign in again to open the Sales portal and mobile app."
          : "Also sells enabled — manager can log calls and receive leads."
      );
    } else {
      setToast("Also sells turned off.");
    }
  }

  async function removeManager(id: string) {
    if (!window.confirm("Remove this manager? Their account will be deleted.")) return;
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      setToast((j as { error?: string }).error ?? "Failed");
      return;
    }
    setManagers((prev) => prev.filter((m) => m.id !== id));
    setToast("Manager removed.");
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
        `Deactivated. ${j.migration.migrated} uncontacted lead(s) reassigned${j.migration.unassigned ? `, ${j.migration.unassigned} left unassigned (no active reps)` : ""}.`
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
        `Promote ${rep.name} to manager? They will join the existing manager team.${leadNote} Continue?`
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
      manager?: { id: string; name: string; email: string; phone: string | null };
    };
    if (!res.ok) {
      setToast(j.error ?? "Failed");
      return;
    }

    setSales((prev) => prev.filter((u) => u.id !== id));
    const promoted = j.manager;
    if (promoted?.id && promoted?.name && promoted?.email) {
      setManagers((prev) => [
        ...prev,
        {
          id: promoted.id,
          name: promoted.name,
          email: promoted.email,
          phone: promoted.phone ?? null,
          is_active: true,
        },
      ]);
    }
    const migrated = j.migration?.migrated ?? 0;
    setToast(
      `${rep.name} is now a manager.${migrated > 0 ? ` ${migrated} uncontacted lead(s) were redistributed.` : ""} They should log in again to refresh their access.`
    );
  }

  async function removeSales(id: string) {
    const rep = sales.find((s) => s.id === id);
    const leadNote =
      rep && (rep.uncontacted_lead_count ?? 0) > 0
        ? ` ${rep.uncontacted_lead_count} uncontacted lead(s) will be redistributed first.`
        : "";
    if (!window.confirm(`Remove this salesperson? Their account will be deleted.${leadNote}`)) return;
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      setToast((j as { error?: string }).error ?? "Failed");
      return;
    }
    setSales((prev) => prev.filter((u) => u.id !== id));
    setToast("Salesperson removed.");
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
      }
      setToast(`New password for ${user.name}. Copy and share it with them manually.`);
    } finally {
      setResettingPasswordId(null);
    }
  }

  if (loading) {
    return <div className="shimmer mb-10 h-40 rounded-xl" />;
  }

  return (
    <section className="ag-fade-in mt-12 space-y-6 border-t border-[var(--border)] pt-10">
      {toast ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm">{toast}</div>
      ) : null}

      {tempPass && inviteEmailResult ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 py-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
            {inviteEmailResult.source === "reset" ? "New login details for" : "Login details for"}{" "}
            {inviteEmailResult.userName ?? inviteEmailResult.email} — share manually (e.g. WhatsApp):
          </p>
          <p className="mb-1 text-[13px] text-[var(--text-primary)]">Email: {inviteEmailResult.email}</p>
          <p className="mb-2 font-mono text-[13px] text-[var(--text-primary)]">Password: {tempPass}</p>
          {inviteEmailResult.emailSent ? (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
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
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Managers</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Add co-managers with full team oversight.</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Turn on Also sells when a manager takes calls and closes deals like a salesperson.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            onClick={() => {
              setInviteError(null);
              setInviteMgrOpen(true);
            }}
          >
            Add manager
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-tertiary)] font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
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
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--text-tertiary)]">
                    No managers listed yet.
                  </td>
                </tr>
              ) : (
                managers.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--border)]">
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
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Salespeople</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Add salespeople, pause access, or adjust lead rotation.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setInviteError(null);
            setInviteOpen(true);
          }}
        >
          Add salesperson
        </button>
      </div>

      {rrList.length > 0 ? (
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Next up: <span className="font-medium text-[var(--text-primary)]">{nextUp?.name ?? "—"}</span>
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
                          className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-card)] px-2 py-1"
                        >
                          <ClientAvatar name={s.name} size={28} />
                          <span className="max-w-[100px] truncate text-xs">
                            {s.name}
                            {s.role === "CLIENT_MANAGER" ? " (mgr)" : ""}
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">Drag to reorder round-robin rotation.</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-tertiary)] font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
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
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--text-tertiary)]">
                  No salespeople yet. Add your first team member above.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
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
                    <button
                      type="button"
                      className="text-xs text-[var(--danger-fg)]"
                      onClick={() => void removeSales(s.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(inviteOpen || inviteMgrOpen) ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-overlay)] p-0 md:items-center md:justify-center md:p-4">
          <div className="flex h-full w-full max-w-md flex-col border border-[var(--border)] bg-[var(--surface-card)] p-5 shadow-lg md:h-auto md:rounded-xl md:p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{inviteOpen ? "Invite salesperson" : "Invite manager"}</h3>
            <label className="mt-3 block text-sm">
              Name
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] md:text-sm"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                autoCapitalize="words"
              />
            </label>
            <label className="mt-3 block text-sm">
              Email
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] md:text-sm"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                inputMode="email"
                autoCapitalize="off"
              />
            </label>
            <label className="mt-3 block text-sm">
              Phone (E.164{inviteMgrOpen ? ", optional for manager" : ""})
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] md:text-sm"
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
            <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-[var(--border)] pt-4 md:mt-4 md:border-t-0 md:pt-0">
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] md:h-9 md:flex-none"
                onClick={() => {
                  setInviteError(null);
                  setInviteOpen(false);
                  setInviteMgrOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary h-11 flex-1 md:h-9 md:flex-none"
                disabled={saving}
                onClick={() => void (inviteOpen ? inviteSalesperson() : inviteManager())}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
