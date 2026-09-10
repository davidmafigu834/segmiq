"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/auth/rbac";

/** UX gate — never the sole authorization boundary. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, ready } = usePermissions();
  if (!ready) return null;
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
