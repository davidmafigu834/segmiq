import assert from "node:assert/strict";
import test from "node:test";
import { authUserByEmailQuery, fetchAuthFirstRow } from "../lib/supabase/auth-rest";

test("auth user query scopes lookup to one email", () => {
  assert.equal(
    authUserByEmailQuery("admin@leadstaq.com"),
    "select=id,name,email,password,role,client_id,is_active,session_version,also_sells&email=eq.admin%40leadstaq.com&limit=1"
  );
});

test("auth fetch reports missing env configuration", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const result = await fetchAuthFirstRow("users", "select=id&limit=1");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_env");
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});
