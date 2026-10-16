export type PageError = { message?: string; code?: string } | null;

export type PageFetcher = (
  from: number,
  to: number
) => PromiseLike<{ data: unknown[] | null; error: PageError }>;

export type PagedRows = {
  rows: Record<string, unknown>[];
  /** True when the ceiling stopped the scan or a page failed. Never silently capped. */
  incomplete: boolean;
  error: PageError;
};

export async function readAllPages(
  fetchPage: PageFetcher,
  options: { pageSize?: number; ceiling?: number } = {}
): Promise<PagedRows> {
  const pageSize = options.pageSize ?? 500;
  const ceiling = options.ceiling ?? 10000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < ceiling; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, incomplete: true, error };
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) return { rows, incomplete: false, error: null };
  }
  return { rows, incomplete: true, error: null };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}
