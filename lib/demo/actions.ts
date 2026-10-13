import { getGuestContext } from "@/lib/demo/context";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { demoId } from "@/lib/demo/ids";
import { clearDemoSnapshotCache } from "@/lib/demo/provider";
import { appendSessionMutation } from "@/lib/demo/session-store";
import { readDemoMutations, resetDemoMutations, writeDemoMutations } from "@/lib/demo/store";
import type { DemoMutation } from "@/lib/demo/types";

/** `Omit` does not distribute over unions, which collapses every mutation shape into one object. */
type DemoMutationInput = DemoMutation extends infer T ? (T extends unknown ? Omit<T, "id"> : never) : never;

export async function appendDemoMutation(clientId: string, mutation: DemoMutationInput & { id?: string }): Promise<void> {
  const guest = getGuestContext();
  const next: DemoMutation = {
    ...mutation,
    id: mutation.id ?? demoId(`mut:${guest?.sessionId ?? clientId}:${mutation.type}:${Date.now()}`),
  } as DemoMutation;
  if (guest) {
    if (guest.clientId !== clientId) throw new DemoAccessDenied();
    await appendSessionMutation(guest.sessionId, next);
    clearDemoSnapshotCache();
    return;
  }
  const current = await readDemoMutations(clientId);
  await writeDemoMutations(clientId, [...current, next]);
  clearDemoSnapshotCache();
}

export async function resetDemoWorkspace(clientId: string): Promise<void> {
  await resetDemoMutations(clientId);
  clearDemoSnapshotCache();
}
