import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

/**
 * Runs only against an explicitly configured local database.
 * It never reads NEXT_PUBLIC_SUPABASE_URL and never connects to a Supabase host.
 */
const databaseUrl = process.env.SEGMQ_DEMO_TEST_DATABASE_URL?.trim() ?? "";

function localDatabaseUrl(value: string): boolean {
  if (!value || value.includes("supabase.co")) return false;
  try {
    const host = new URL(value).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

const enabled = localDatabaseUrl(databaseUrl);
const skip = enabled
  ? false
  : "BLOCKED: set SEGMQ_DEMO_TEST_DATABASE_URL to a localhost Postgres URL. This test does not use the production database.";

describe("guest session database", { skip }, () => {
  it("rolls back the guest migration after concurrent session writes", async () => {
    type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };
    type PgClient = {
      connect(): Promise<void>;
      query(sql: string, params?: unknown[]): Promise<QueryResult>;
      end(): Promise<void>;
    };
    const specifier = "pg";
    const loaded = (await import(specifier)) as {
      Client: new (config: { connectionString: string }) => PgClient;
    };
    const client = new loaded.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query("begin");
      const sql = readFileSync(
        resolve(process.cwd(), "supabase/migrations/20261012194500_demo_guest_sessions.sql"),
        "utf8"
      );
      await client.query(sql);
      const clientId = "00000000-0000-4000-a000-000000000001";
      const userId = "00000000-0000-4000-a000-000000000002";
      await client.query(
        `insert into public.clients (id, name, industry, slug) values ($1, 'Isolation Check', 'Tyres', $2)
         on conflict (id) do nothing`,
        [clientId, `isolation-${Date.now()}`]
      );
      await client.query(
        `insert into public.users (id, name, email, password, role, client_id)
         values ($1, 'Checker', $2, 'not-a-login', 'CLIENT_MANAGER', $3)
         on conflict (id) do nothing`,
        [userId, `checker-${Date.now()}@example.test`, clientId]
      );
      const invite = await client.query(
        `insert into public.demo_invitations (client_id, token_hash, expires_at, created_by)
         values ($1, $2, now() + interval '1 day', $3) returning id`,
        [clientId, `hash-${Date.now()}`, userId]
      );
      const invitationId = (invite.rows[0] as { id: string }).id;
      const first = await client.query(
        `insert into public.demo_sessions (invitation_id, client_id, persona_key, secret_hash, expires_at)
         values ($1, $2, 'tinashe', $3, now() + interval '1 hour') returning id`,
        [invitationId, clientId, `secret-a-${Date.now()}`]
      );
      const second = await client.query(
        `insert into public.demo_sessions (invitation_id, client_id, persona_key, secret_hash, expires_at)
         values ($1, $2, 'tinashe', $3, now() + interval '1 hour') returning id`,
        [invitationId, clientId, `secret-b-${Date.now()}`]
      );
      const sessionA = (first.rows[0] as { id: string }).id;
      const sessionB = (second.rows[0] as { id: string }).id;
      await client.query(
        `insert into public.demo_session_mutations (session_id, mutations, version) values ($1, '[]'::jsonb, 0), ($2, '[]'::jsonb, 0)`,
        [sessionA, sessionB]
      );
      const won = await client.query(
        `update public.demo_session_mutations
         set mutations = '[{"id":"a","type":"deal.stage"}]'::jsonb, version = 1
         where session_id = $1 and version = 0
         returning session_id`,
        [sessionA]
      );
      const lost = await client.query(
        `update public.demo_session_mutations
         set version = 1
         where session_id = $1 and version = 0
         returning session_id`,
        [sessionA]
      );
      const other = await client.query(
        `select version from public.demo_session_mutations where session_id = $1`,
        [sessionB]
      );
      assert.equal(won.rowCount, 1);
      assert.equal(lost.rowCount, 0);
      assert.equal((other.rows[0] as { version: number }).version, 0);
      await client.query(
        `update public.demo_invitations set revoked_at = now() where id = $1`,
        [invitationId]
      );
      const revoked = await client.query(
        `select revoked_at from public.demo_sessions s
         join public.demo_invitations i on i.id = s.invitation_id
         where s.id = $1`,
        [sessionA]
      );
      assert.ok((revoked.rows[0] as { revoked_at: string | null }).revoked_at);
    } finally {
      await client.query("rollback");
      await client.end();
    }
  });
});
