import assert from "node:assert/strict";
import test from "node:test";
import { withTimeout } from "../lib/with-timeout";

test("withTimeout rejects a hung promise so login cannot wait forever", async () => {
  await assert.rejects(() => withTimeout(new Promise(() => {}), 20, "user lookup timed out"), /user lookup timed out/);
});

test("withTimeout returns the value when the work finishes in time", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
});
