import { AsyncLocalStorage } from "async_hooks";
import type { DemoActorKey } from "@/lib/demo/actors";
import type { UserRole } from "@/types";

/**
 * Server-only guest context for the current request.
 * `enterWith` keeps the context visible to later awaits in the same request
 * after `getOperationalSession` / `resolveApiAuth` return.
 */
export type DemoGuestContext = {
  kind: "demo-guest";
  sessionId: string;
  clientId: string;
  personaKey: DemoActorKey;
  userId: string;
  role: Extract<UserRole, "CLIENT_MANAGER" | "SALESPERSON">;
  name: string;
};

const storage = new AsyncLocalStorage<DemoGuestContext>();

export function getGuestContext(): DemoGuestContext | null {
  return storage.getStore() ?? null;
}

export function enterGuestContext(context: DemoGuestContext): void {
  if (context.role !== "CLIENT_MANAGER" && context.role !== "SALESPERSON") {
    throw new Error("Demo guests cannot assume a platform role.");
  }
  storage.enterWith(context);
}

export function runAsGuest<T>(context: DemoGuestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Test helper. */
export function clearGuestContextForTests(): void {
  storage.enterWith(undefined as unknown as DemoGuestContext);
}
