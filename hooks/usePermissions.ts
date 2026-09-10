"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  hasPermission,
  listPermissions,
  type Permission,
  type PermissionActor,
} from "@/lib/auth/rbac";

/**
 * UX-only permission helper. Backend remains authoritative.
 */
export function usePermissions() {
  const { data: session, status } = useSession();

  const actor: PermissionActor | null = useMemo(() => {
    if (!session?.userId) return null;
    return {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
      alsoSells: session.alsoSells,
      isImpersonating: Boolean(session.isImpersonating),
    };
  }, [session]);

  const permissions = useMemo(
    () => (actor ? listPermissions(actor) : []),
    [actor]
  );

  function can(permission: Permission | string): boolean {
    if (!actor) return false;
    return hasPermission(actor, permission);
  }

  return {
    status,
    actor,
    permissions,
    can,
    ready: status !== "loading",
  };
}
