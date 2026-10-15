import type { DemoActorKey } from "@/lib/demo/actors";
import type { UserRole } from "@/types";

type GuestStorage = {
  getStore(): DemoGuestContext | undefined;
  enterWith(value: DemoGuestContext | undefined): void;
  run<T>(value: DemoGuestContext, fn: () => T): T;
};

/** Browser bundles have no Node async_hooks, so guest context stays empty there. */
const GUEST_STORAGE = Symbol.for("segmiq.demoGuestStorage");

function createGuestStorage(): GuestStorage | null {
  if (typeof window !== "undefined") return null;
  const root = globalThis as typeof globalThis & { [GUEST_STORAGE]?: GuestStorage };
  if (root[GUEST_STORAGE]) return root[GUEST_STORAGE];
  try {
    // Server-only. A static import is pulled into client components that share this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require(/* webpackIgnore: true */ "async_hooks") as {
      AsyncLocalStorage: new () => GuestStorage;
    };
    const created = new AsyncLocalStorage();
    root[GUEST_STORAGE] = created;
    return created;
  } catch {
    return null;
  }
}

const storage = createGuestStorage();

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
