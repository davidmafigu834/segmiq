import assert from "node:assert/strict";
import test from "node:test";
import { withBlogFetchTimeout } from "../lib/blog";

test("blog fetch timeout rejects a hung read so the build can fall back", async () => {
  await assert.rejects(
    () => withBlogFetchTimeout(new Promise(() => {}), 20),
    /blog fetch timeout/
  );
});

test("blog fetch timeout returns the value when the read finishes in time", async () => {
  assert.equal(await withBlogFetchTimeout(Promise.resolve("ok"), 50), "ok");
});
