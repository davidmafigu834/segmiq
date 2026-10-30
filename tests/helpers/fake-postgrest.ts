/**
 * In-memory PostgREST stand-in for route-level tests. Install it as
 * globalThis.fetch; supabase-js and the raw REST helpers resolve fetch at call
 * time. Supports the filters the auth code paths use (eq, neq, is, in, gt/gte/lt/lte)
 * and ignores anything else. Never contacts a network host.
 */

export type Row = Record<string, unknown>;

export type FakeRequest = {
  method: string;
  table: string;
  url: URL;
  body: unknown;
};

export type FakePostgrest = {
  tables: Record<string, Row[]>;
  requests: FakeRequest[];
  /** Tables whose reads/writes answer HTTP 503, to simulate an outage. */
  failingTables: Set<string>;
  fetch: typeof fetch;
  inserted(table: string): Row[];
};

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);

function coerce(raw: string): string | number | boolean | null {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function compare(a: unknown, b: string): number {
  const na = typeof a === "number" ? a : Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a ?? "").localeCompare(b);
}

function matches(row: Row, column: string, expr: string): boolean {
  const negate = expr.startsWith("not.");
  const body = negate ? expr.slice(4) : expr;
  const dot = body.indexOf(".");
  if (dot < 0) return true;
  const op = body.slice(0, dot);
  const value = body.slice(dot + 1);
  const cell = row[column];
  let result: boolean;
  switch (op) {
    case "eq":
      result = cell !== undefined && cell !== null && String(cell) === value;
      break;
    case "neq":
      result = String(cell ?? "") !== value;
      break;
    case "is": {
      const want = coerce(value);
      result = want === null ? cell === null || cell === undefined : cell === want;
      break;
    }
    case "in": {
      const list = value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      result = list.includes(String(cell));
      break;
    }
    case "gt":
      result = cell != null && compare(cell, value) > 0;
      break;
    case "gte":
      result = cell != null && compare(cell, value) >= 0;
      break;
    case "lt":
      result = cell != null && compare(cell, value) < 0;
      break;
    case "lte":
      result = cell != null && compare(cell, value) <= 0;
      break;
    default:
      result = true;
  }
  return negate ? !result : result;
}

function filterRows(rows: Row[], url: URL): Row[] {
  let out = rows;
  url.searchParams.forEach((expr, column) => {
    if (RESERVED_PARAMS.has(column)) return;
    out = out.filter((row) => matches(row, column, expr));
  });
  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
  return out;
}

function respond(rows: Row[], init: { accept: string; prefer: string; status?: number }): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  const countMatch = init.prefer.match(/count=(exact|planned|estimated)/);
  if (countMatch) headers.set("Content-Range", `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
  if (init.accept.includes("application/vnd.pgrst.object+json")) {
    if (rows.length !== 1) {
      return new Response(
        JSON.stringify({
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        }),
        { status: 406, headers }
      );
    }
    return new Response(JSON.stringify(rows[0]), { status: init.status ?? 200, headers });
  }
  return new Response(JSON.stringify(rows), { status: init.status ?? 200, headers });
}

export function createFakePostgrest(
  supabaseUrl: string,
  seed: Record<string, Row[]> = {}
): FakePostgrest {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const requests: FakeRequest[] = [];
  const failingTables = new Set<string>();
  const base = new URL(supabaseUrl);

  const fake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    if (url.host !== base.host || !url.pathname.startsWith("/rest/v1/")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const headers = new Headers(init?.headers ?? request?.headers ?? {});
    const accept = headers.get("accept") ?? "";
    const prefer = headers.get("prefer") ?? "";
    const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
    let body: unknown = null;
    const rawBody = init?.body ?? null;
    if (typeof rawBody === "string" && rawBody) body = JSON.parse(rawBody);
    requests.push({ method, table, url, body });

    if (failingTables.has(table)) {
      return new Response(JSON.stringify({ message: "service unavailable" }), { status: 503 });
    }
    if (table.startsWith("rpc/")) {
      return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const rows = (tables[table] ??= []);
    const wantsRepresentation = prefer.includes("return=representation");

    if (method === "GET" || method === "HEAD") {
      return respond(filterRows(rows, url), { accept, prefer });
    }
    if (method === "POST") {
      const items = (Array.isArray(body) ? body : [body]) as Row[];
      const created = items.map((item) => {
        const row: Row = { id: item.id ?? crypto.randomUUID(), ...item };
        const existing = rows.findIndex((r) => r.id === row.id);
        if (existing >= 0) rows[existing] = { ...rows[existing], ...row };
        else rows.push(row);
        return row;
      });
      return wantsRepresentation
        ? respond(created, { accept, prefer, status: 201 })
        : new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      const target = filterRows(rows, url);
      for (const row of target) Object.assign(row, body as Row);
      return wantsRepresentation ? respond(target, { accept, prefer }) : new Response(null, { status: 204 });
    }
    if (method === "DELETE") {
      const target = new Set(filterRows(rows, url));
      tables[table] = rows.filter((r) => !target.has(r));
      return wantsRepresentation ? respond([...target], { accept, prefer }) : new Response(null, { status: 204 });
    }
    return new Response("unsupported", { status: 405 });
  };

  return {
    tables,
    requests,
    failingTables,
    fetch: fake as typeof fetch,
    inserted(table: string) {
      return requests
        .filter((r) => r.method === "POST" && r.table === table)
        .flatMap((r) => (Array.isArray(r.body) ? (r.body as Row[]) : [r.body as Row]));
    },
  };
}
