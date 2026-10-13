import type { DemoActorKey } from "@/lib/demo/actors";
import type { UserRole } from "@/types";

type GuestStorage = {
  getStore(): DemoGuestContext | undefined;
  enterWith(value: DemoGuestContext | undefined): void;
  run<T>(value: DemoGuestContext, fn: () => T): T;
};

function createGuestStorage(): GuestStorage | null {
  if (typeof window !== "undefined") return null;
  try {
    const { AsyncLocalStorage } = require(/* webpackIgnore: true */ "async_hooks") as {
      AsyncLocalStorage: new () => GuestStorage;
    };
    return new AsyncLocalStorage();
  } catch {
    return null;
  }
}

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

/** Browser bundles have no Node async_hooks, so guest context stays empty there. */
const storage = createGuestStorage();

function requireStorage(): GuestStorage {
  if (!storage) throw new Error("Demo guest context is only available on the server.");
  return storage;
}

export function getGuestContext(): DemoGuestContext | null {
  return storage?.getStore() ?? null;
}

export function enterGuestContext(context: DemoGuestContext): void {
  if (context.role !== "CLIENT_MANAGER" && context.role !== "SALESPERSON") {
    throw new Error("Demo guests cannot assume a platform role.");
  }
  requireStorage().enterWith(context);
}

export function runAsGuest<T>(context: DemoGuestContext, fn: () => T): T {
  return requireStorage().run(context, fn);
}

/** Test helper. */
export function clearGuestContextForTests(): void {
  requireStorage().enterWith(undefined as unknown as DemoGuestContext);
}
