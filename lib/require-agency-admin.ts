import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export type SuperAdminOk = { session: Session };
export type SuperAdminErr = { error: string; status: number };

/** @deprecated Use SuperAdminOk */
export type AgencyAdminOk = SuperAdminOk;
/** @deprecated Use SuperAdminErr */
export type AgencyAdminErr = SuperAdminErr;

export async function requireSuperAdmin(): Promise<SuperAdminOk | SuperAdminErr> {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return { error: "Unauthorized", status: 401 };
  }
  return { session };
}

/** @deprecated Use requireSuperAdmin */
export const requireAgencyAdmin = requireSuperAdmin;
