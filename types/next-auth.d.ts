import type { DefaultSession } from "next-auth";
import type { ClientMode, UserRole } from "@/types";

declare module "next-auth" {
  interface Session extends DefaultSession {
    userId: string;
    role: UserRole;
    clientId: string | null;
    clientMode: ClientMode;
    sessionVersion?: number;
    /** Server-side user_sessions.id */
    sessionId?: string | null;
    /** True when a CLIENT_MANAGER has salesperson capabilities enabled. */
    alsoSells?: boolean;
    /** Restricted session — MFA enrolment still required before CRM APIs. */
    mfaEnrolmentRequired?: boolean;
    /** Set when a super admin is impersonating a client team member. */
    realUserId?: string | null;
    realUserName?: string | null;
    isImpersonating?: boolean;
    user: DefaultSession["user"] & {
      id: string;
    };
  }
  interface User {
    id: string;
    role: UserRole;
    clientId: string | null;
    clientMode?: ClientMode;
    alsoSells?: boolean;
    sessionVersion?: number;
    sessionId?: string;
    mfaEnrolmentRequired?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: UserRole;
    clientId: string | null;
    clientMode?: ClientMode;
    alsoSells?: boolean;
    sessionVersion?: number;
    sessionId?: string | null;
    mfaEnrolmentRequired?: boolean;
    email?: string | null;
    name?: string | null;
    realUserId?: string | null;
    realUserName?: string | null;
  }
}
