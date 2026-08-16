import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PRELOADER_COPY } from "../components/loading/preloader-copy";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("SegmiQ workspace preloader", () => {
  const component = read("components/loading/SegmiQPreloader.tsx");
  const styles = read("components/loading/SegmiQPreloader.module.css");
  const login = read("app/login/LoginForm.tsx");

  it("keeps a small controlled copy system", () => {
    assert.deepEqual(Object.keys(PRELOADER_COPY), [
      "workspace",
      "pipeline",
      "salesHub",
      "company",
    ]);
    assert.equal(PRELOADER_COPY.workspace.title, "Preparing your workspace...");
    assert.equal(
      PRELOADER_COPY.workspace.description,
      "Loading your sales data and priorities."
    );
  });

  it("uses official theme-specific wordmark assets", () => {
    assert.ok(component.includes('src="/segmiq-wordmark-black.png"'));
    assert.ok(component.includes('src="/segmiq-wordmark.png"'));
    assert.equal(component.includes("filter: invert"), false);
  });

  it("renders the branded five-stage journey without fake progress", () => {
    for (const stage of ["Capture", "Qualify", "Deal", "Follow up", "Close"]) {
      assert.ok(component.includes(stage), `missing ${stage} stage`);
    }
    assert.ok(component.includes("heartbeat"));
    assert.ok(component.includes("pulseRing"));
    assert.equal(component.includes('type="range"'), false);
    assert.equal(component.includes("%"), false);
  });

  it("exposes one stable accessible status", () => {
    assert.ok(component.includes('role="status"'));
    assert.ok(component.includes('aria-live="polite"'));
    assert.ok(component.includes("aria-busy={isLoading}"));
    assert.ok(component.includes('aria-hidden="true"'));
  });

  it("provides reduced-motion and responsive fallbacks", () => {
    assert.ok(styles.includes("@media (prefers-reduced-motion: reduce)"));
    assert.ok(styles.includes("@media (max-width: 389px)"));
    assert.ok(styles.includes("(orientation: landscape)"));
    assert.ok(styles.includes(".heartbeat"));
    assert.ok(styles.includes(".pulseRing"));
  });

  it("is driven by real auth resolution and has an error escape", () => {
    assert.ok(login.includes('fetch(`/api/auth/home${qs}`'));
    assert.ok(login.includes("window.location.assign(data.home)"));
    assert.ok(login.includes('setWorkspaceState(navigator.onLine ? "error" : "offline")'));
    assert.ok(login.includes("retryWorkspace"));
    assert.ok(login.includes("leaveWorkspace"));
    assert.equal(login.includes("3000"), false);
  });
});
