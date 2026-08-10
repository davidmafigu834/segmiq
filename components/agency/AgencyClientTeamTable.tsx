"use client";

import { ImpersonateButton } from "@/components/agency/ImpersonateButton";
import { roleLabel } from "@/lib/auth/impersonation";
import type { UserRole } from "@/types";

type TeamMember = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
};

export function AgencyClientTeamTable({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return <p className="px-4 py-8 text-sm text-ink-secondary">No active team members.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-border bg-surface-card-alt font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-t border-border hover:bg-surface-card-alt">
              <td className="px-4 py-3 font-medium">{member.name}</td>
              <td className="px-4 py-3 font-mono text-[11px]">{roleLabel(member.role)}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{member.email}</td>
              <td className="px-4 py-3 text-right">
                <ImpersonateButton userId={member.id} userName={member.name} variant="link" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
