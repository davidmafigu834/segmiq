"use client";

import { ImpersonateButton } from "@/components/agency/ImpersonateButton";
import { EmptyNote, Panel, WorkRow } from "@/components/platform/workbench";
import { roleLabel } from "@/lib/auth/impersonation";
import type { UserRole } from "@/types";

type TeamMember = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
};

export function AgencyClientTeamTable({
  members,
  organisationId,
  organisationName,
}: {
  members: TeamMember[];
  organisationId: string;
  organisationName: string;
}) {
  return (
    <Panel title="People" count={members.length}>
      {members.length === 0 ? (
        <EmptyNote title="No one is on this team" detail="Active managers and salespeople appear here." />
      ) : (
        <ul>
          {members.map((member) => (
            <WorkRow
              key={member.id}
              name={member.name}
              meta={roleLabel(member.role)}
              detail={member.email}
              extra={
                <ImpersonateButton
                  userId={member.id}
                  userName={member.name}
                  organisationId={organisationId}
                  organisationName={organisationName}
                  variant="row"
                />
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
