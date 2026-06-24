"use client";

import { useEffect, useMemo, useState } from "react";
import { MailCheck } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ClientAvatar } from "@/components/ClientAvatar";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  round_robin_order: number;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [inviteEmailResult, setInviteEmailResult] = useState<{ email: string; emailSent: boolean } | null>(null);

  const rrList = useMemo(
    () => [...sales].filter((s) => s.is_active).sort((a, b) => a.round_robin_order - b.round_robin_order),
    [sales]
  );
  const nextUp = rrList.length ? rrList[roundRobinIndex % rrList.length] : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/users?manage=1`)
      .then((r) => r.json())
      .then((j: { users?: UserRow[]; error?: string }) => {
        if (cancelled) return;
        if (j.users) setSales(j.users);
        else if (j.error) setToast(j.error);
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
      setInviteEmailResult({ email: inviteForm.email, emailSent });
      if (!emailSent && (j as { temporaryPassword?: string }).temporaryPassword) {
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

  async function toggleSales(id: string, is_active: boolean) {
    const res = await fetch(`/api/clients/${clientId}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      const j = await res.json();
      setToast((j as { error?: string }).error ?? "Failed");
      return;
    }
    setSales((prev) => prev.map((u) => (u.id === id ? { ...u, is_active } : u)));
  }

  async function removeSales(id: string) {
    if (!window.confirm("Remove this salesperson? Their account will be deleted.")) return;
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
    try {
      await navigator.clipboard.writeText(tempPass);
      setToast("Temporary password copied.");
    } catch {
      setToast("Could not copy automatically. Please copy manually.");
    }
  }

  if (loading) {
    return <div className="shimmer mb-10 h-40 rounded-xl" />;
  }

  return (
    <section className="mt-12 space-y-6 border-t border-border pt-10">
      {toast ? (
        <div className="rounded-md border border-border bg-surface-card-alt px-3 py-2 text-sm">{toast}</div>
      ) : null}

      {inviteEmailResult?.emailSent === true ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--success-border)] bg-[var(--success-muted)] px-3.5 py-3 text-[13px] text-[var(--success)]">
          <MailCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <p className="m-0 flex-1">Login details sent to {inviteEmailResult.email}</p>
          <button type="button" className="text-xs underline" onClick={() => setInviteEmailResult(null)}>
            Dismiss
          </button>
        </div>
      ) : inviteEmailResult?.emailSent === false ? (
        <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-muted)] px-3.5 py-3">
          <p className="mb-2 text-xs font-semibold text-[var(--warning)]">
            Email failed to send. Share these credentials manually:
          </p>
          <p className="mb-1 text-[13px] text-ink-primary">Email: {inviteEmailResult.email}</p>
          <p className="mb-2 font-mono text-[13px] text-ink-primary">Password: {tempPass}</p>
          <button type="button" className="mr-3 text-xs underline" onClick={() => void copyTempPassword()}>
            Copy password
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink-primary">Team members</h2>
          <p className="mt-1 text-sm text-ink-secondary">Add salespeople, pause access, or adjust lead rotation.</p>
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

      <div className="overflow-hidden rounded-xl border border-border">
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
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-tertiary">
                  No salespeople yet. Add your first team member above.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
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

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-overlay)] p-0 md:items-center md:justify-center md:p-4">
          <div className="flex h-full w-full max-w-md flex-col border border-border bg-surface-card p-5 shadow-lg md:h-auto md:rounded-xl md:p-6">
            <h3 className="font-display text-xl">Invite salesperson</h3>
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
              Phone (E.164)
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
                  setInviteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary h-11 flex-1 md:h-9 md:flex-none"
                disabled={saving}
                onClick={() => void inviteSalesperson()}
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
