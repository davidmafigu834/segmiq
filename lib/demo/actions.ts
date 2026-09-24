import { demoId } from "@/lib/demo/ids";
import { clearDemoSnapshotCache } from "@/lib/demo/provider";
import { readDemoMutations, resetDemoMutations, writeDemoMutations } from "@/lib/demo/store";
import type { DemoMutation } from "@/lib/demo/types";

/** `Omit` does not distribute over unions, which collapses every mutation shape into one object. */
type DemoMutationInput = DemoMutation extends infer T ? (T extends unknown ? Omit<T, "id"> : never) : never;

export async function appendDemoMutation(clientId: string, mutation: DemoMutationInput & { id?: string }): Promise<void> {
  const current = await readDemoMutations(clientId);
  const next: DemoMutation = { ...mutation, id: mutation.id ?? demoId(`rossi:mut:${current.length}:${mutation.type}:${Date.now()}`) } as DemoMutation;
  await writeDemoMutations(clientId, [...current, next]);
  clearDemoSnapshotCache();
}

export async function resetDemoWorkspace(clientId: string): Promise<void> {
  await resetDemoMutations(clientId);
  clearDemoSnapshotCache();
}
