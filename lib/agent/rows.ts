/** Cast untyped Supabase rows for tables not yet in generated Database types. */
export function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export function asRow<T>(data: unknown): T | null {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as T) : null;
}
