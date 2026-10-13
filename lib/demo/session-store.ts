import type { DemoMutation } from "@/lib/demo/types";
import { DemoAccessDenied } from "@/lib/demo/errors";

export type SessionMutationRow = {
  mutations: DemoMutation[];
  version: number;
};

export type SessionMutationRepo = {
  read(sessionId: string): Promise<SessionMutationRow | null>;
  compareAndSwap(
    sessionId: string,
    expectedVersion: number,
    mutations: DemoMutation[],
    nextVersion: number
  ): Promise<boolean>;
};

const MAX_ATTEMPTS = 5;

export async function appendSessionMutationWithRepo(
  repo: SessionMutationRepo,
  sessionId: string,
  mutation: DemoMutation
): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await repo.read(sessionId);
    if (!current) throw new DemoAccessDenied();
    const next = [...current.mutations, mutation];
    const wrote = await repo.compareAndSwap(sessionId, current.version, next, current.version + 1);
    if (wrote) return;
  }
  throw new Error("Demo session mutation conflicted with a concurrent write.");
}

export async function readSessionMutations(sessionId: string): Promise<DemoMutation[]> {
  const row = await defaultRepo().read(sessionId);
  if (!row) throw new DemoAccessDenied();
  return row.mutations;
}

export async function appendSessionMutation(sessionId: string, mutation: DemoMutation): Promise<void> {
  await appendSessionMutationWithRepo(defaultRepo(), sessionId, mutation);
}

export async function resetSessionMutations(sessionId: string): Promise<void> {
  const repo = defaultRepo();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await repo.read(sessionId);
    if (!current) throw new DemoAccessDenied();
    const wrote = await repo.compareAndSwap(sessionId, current.version, [], current.version + 1);
    if (wrote) return;
  }
  throw new Error("Demo session reset conflicted with a concurrent write.");
}

function defaultRepo(): SessionMutationRepo {
  return {
    async read(sessionId) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("demo_session_mutations")
        .select("mutations, version")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) throw new Error("Demo session state could not be read.");
      if (!data) return null;
      const mutations = Array.isArray((data as { mutations?: unknown }).mutations)
        ? ((data as { mutations: DemoMutation[] }).mutations)
        : [];
      const version = Number((data as { version?: unknown }).version ?? 0);
      return { mutations, version };
    },
    async compareAndSwap(sessionId, expectedVersion, mutations, nextVersion) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("demo_session_mutations")
        .update({
          mutations,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("version", expectedVersion)
        .select("session_id");
      if (error) throw new Error("Demo session state could not be saved.");
      return Array.isArray(data) && data.length > 0;
    },
  };
}
