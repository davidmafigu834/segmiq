"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { Badge, Button, Input, Skeleton } from "@/components/sales/ui";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { CompanyTeamInviteDialog } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  also_sells: boolean;
};

function roleLabel(member: Member): string {
  if (member.role === "CLIENT_MANAGER") return member.also_sells ? "Manager (also sells)" : "Company Manager";
  return "Salesperson";
}

export function TeamMembersSection({
  clientId,
  currentUserId,
  toast,
}: {
  clientId: string;
  currentUserId: string;
  toast: (opts: { title: string; tone?: "success" | "error" | "warning" }) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, mgrRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/users?manage=1`),
        fetch(`/api/clients/${clientId}/users?manage=1&role=CLIENT_MANAGER`),
      ]);
      const salesJson = (await salesRes.json().catch(() => ({}))) as { users?: Member[]; error?: string };
      const mgrJson = (await mgrRes.json().catch(() => ({}))) as { users?: Member[]; error?: string };
      if (!salesRes.ok) throw new Error(salesJson.error ?? "Couldn't load team");
      if (!mgrRes.ok) throw new Error(mgrJson.error ?? "Couldn't load managers");
      const sales = (salesJson.users ?? []).map((u) => ({
        ...u,
        role: u.role ?? "SALESPERSON",
        also_sells: Boolean(u.also_sells),
        is_active: u.is_active !== false,
      }));
      const managers = (mgrJson.users ?? []).map((u) => ({
        ...u,
        role: "CLIENT_MANAGER",
        also_sells: Boolean(u.also_sells),
        is_active: u.is_active !== false,
      }));
      const byId = new Map<string, Member>();
      for (const row of [...managers, ...sales]) byId.set(row.id, row);
      setMembers([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || roleLabel(m).toLowerCase().includes(q)
    );
  }, [members, query]);

  const managerCount = members.filter((m) => m.role === "CLIENT_MANAGER" && m.is_active).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-sales-text-primary">Team Members</h2>
          <p className="mt-0.5 text-[13px] text-sales-text-secondary">
            Manage people who can access your company account.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)}>
          Invite Team Member
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" className="pl-9" />
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-[12px]" />
      ) : error ? (
        <SettingsSectionCard title="Team Members">
          <p className="text-[13px] text-sales-text-secondary">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
            Retry
          </Button>
        </SettingsSectionCard>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface sm:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-sales-border-subtle text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr
                    key={member.id}
                    className="cursor-pointer border-b border-sales-border-subtle last:border-0 hover:bg-sales-surface-hover"
                    onClick={() => setSelected(member)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sales-text-primary">{member.name}</p>
                      <p className="text-[12px] text-sales-text-secondary">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sales-text-secondary">{roleLabel(member)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={member.is_active ? "success" : "neutral"} appearance="soft">
                        {member.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sales-text-secondary">
                      {member.role === "CLIENT_MANAGER" ? "Settings & team" : "Sales workspace"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-subtle hover:text-sales-text-primary"
                        aria-label={`Manage ${member.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(member);
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {filtered.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelected(member)}
                className="rounded-[12px] border border-sales-border bg-sales-surface p-4 text-left"
              >
                <p className="text-[14px] font-semibold text-sales-text-primary">{member.name}</p>
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">{member.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="neutral" appearance="soft">
                    {roleLabel(member)}
                  </Badge>
                  <Badge tone={member.is_active ? "success" : "neutral"} appearance="soft">
                    {member.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {inviteOpen ? (
        <CompanyTeamInviteDialog
          clientId={clientId}
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            toast({ title: "Invitation sent.", tone: "success" });
            void load();
          }}
        />
      ) : null}

      {selected ? (
        <MemberAccessDrawer
          clientId={clientId}
          member={selected}
          currentUserId={currentUserId}
          lastManager={selected.role === "CLIENT_MANAGER" && managerCount <= 1}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            void load();
          }}
          toast={toast}
        />
      ) : null}
    </div>
  );
}

function MemberAccessDrawer({
  clientId,
  member,
  currentUserId,
  lastManager,
  onClose,
  onChanged,
  toast,
}: {
  clientId: string;
  member: Member;
  currentUserId: string;
  lastManager: boolean;
  onClose: () => void;
  onChanged: () => void;
  toast: (opts: { title: string; tone?: "success" | "error" | "warning" }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isSelf = member.id === currentUserId;

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't update member");
      toast({ title: success, tone: "success" });
      onChanged();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't update member", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function removeAccess() {
    if (!window.confirm(`${member.name} will lose access. Historical leads, deals, and customers stay in SegmiQ.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${member.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't remove member");
      toast({ title: "Access removed.", tone: "success" });
      onChanged();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't remove member", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumSheet
      title={member.name}
      description="Account access for this company. This is not the salesperson performance profile."
      onClose={onClose}
      size="md"
    >
      <dl className="space-y-3 text-[13px]">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Email</dt>
          <dd className="mt-1 text-sales-text-primary">{member.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Role</dt>
          <dd className="mt-1 text-sales-text-primary">{roleLabel(member)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Status</dt>
          <dd className="mt-1 text-sales-text-primary">{member.is_active ? "Active" : "Inactive"}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-2">
        {member.role === "SALESPERSON" ? (
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Promote ${member.name} to Company Manager?`)) return;
              void patch({ role: "CLIENT_MANAGER" }, "Role updated.");
            }}
          >
            Promote to manager
          </Button>
        ) : null}
        {member.role === "CLIENT_MANAGER" ? (
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() =>
              void patch(
                { also_sells: !member.also_sells },
                member.also_sells ? "Selling access removed." : "Manager can also sell."
              )
            }
          >
            {member.also_sells ? "Disable selling access" : "Allow this manager to sell"}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="md"
          disabled={busy || (isSelf && member.is_active) || (lastManager && member.is_active)}
          onClick={() => void patch({ is_active: !member.is_active }, member.is_active ? "Access deactivated." : "Access restored.")}
        >
          {member.is_active ? "Deactivate access" : "Reactivate access"}
        </Button>
        <Button variant="danger" size="md" disabled={busy || isSelf || lastManager} onClick={() => void removeAccess()}>
          Remove access
        </Button>
        {lastManager ? (
          <p className="text-[12px] text-sales-text-muted">At least one company manager is required.</p>
        ) : null}
      </div>
    </PremiumSheet>
  );
}
