import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calls the atomic real estate Postgres functions from the final corrections migration.
 * When the function is not deployed yet the caller falls back to its sequential path.
 * Business errors are raised in SQL as "RE<status>: message".
 */

export type AtomicOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "missing" }
  | { kind: "error"; status: number; error: string };

type RpcError = { code?: string | null; message?: string | null } | null | undefined;

export function isMissingFunctionError(error: RpcError): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist/i.test(message)
  );
}

export function parseAtomicError(error: RpcError): { status: number; error: string } {
  const message = error?.message ?? "The change could not be saved.";
  const match = /RE(4\d\d):\s*([\s\S]+)$/.exec(message);
  if (match) return { status: Number(match[1]), error: match[2].trim() };
  if (error?.code === "23505") {
    return { status: 409, error: "Another change already holds this listing. Refresh and try again." };
  }
  if (error?.code === "40001" || error?.code === "40P01") {
    return { status: 409, error: "Another change happened at the same time. Try again." };
  }
  return { status: 500, error: message };
}

export async function callAtomic<T>(fn: string, args: Record<string, unknown>): Promise<AtomicOutcome<T>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (isMissingFunctionError(error)) return { kind: "missing" };
    return { kind: "error", ...parseAtomicError(error) };
  }
  return { kind: "ok", data: data as T };
}
