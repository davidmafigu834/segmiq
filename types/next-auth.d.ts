import type { DefaultSession } from "next-auth";
import type { ClientMode, UserRole } from "@/types";

declare module "next-auth" {
  interface Session extends DefaultSession {
    userId: string;
    role: UserRole;
    clientId: string | null;
    clientMode: ClientMode;
    user: DefaultSession["user"] & {
      id: string;
    };
  }
  interface User {
    id: string;
    role: UserRole;
    clientId: string | null;
    clientMode?: ClientMode;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: UserRole;
    clientId: string | null;
    clientMode?: ClientMode;
    sessionVersion?: number;
    email?: string | null;
  }
}
