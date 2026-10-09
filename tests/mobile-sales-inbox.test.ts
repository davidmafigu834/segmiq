import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { whatsAppConnectionPresentation } from "../lib/inbox/connection-presentation";
import { mobileCourseDock } from "../lib/sales/training/mobile-coachmark-dock";

describe("WhatsApp connection presentation", () => {
  it("does not treat a missing status payload as offline", () => {
    assert.equal(whatsAppConnectionPresentation(null), "unknown");
  });

  it("keeps a live connection distinct from a pending or failed link", () => {
    assert.equal(
      whatsAppConnectionPresentation({ connected: true, status: "CONNECTED" }),
      "connected"
    );
    assert.equal(
      whatsAppConnectionPresentation({ connected: false, status: "RECONNECTING" }),
      "pending"
    );
    assert.equal(
      whatsAppConnectionPresentation({ connected: false, status: "DISCONNECTED" }),
      "offline"
    );
  });
});

describe("mobile course card placement", () => {
  it("docks above a lower target so the composer stays clear", () => {
    assert.equal(mobileCourseDock(700, 800), "top");
    assert.equal(mobileCourseDock(120, 800), "bottom");
    assert.equal(mobileCourseDock(null, 800), "top");
  });
});

describe("salesperson inbox mobile contract", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const inbox = readFileSync("components/inbox/TeamInbox.tsx", "utf8");
  const row = readFileSync("components/inbox/ConversationRow.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const thread = readFileSync("components/inbox/ChatThread.tsx", "utf8");
  const course = readFileSync("components/sales/training/CourseLayer.tsx", "utf8");

  it("asks the browser to resize layout when the keyboard opens", () => {
    assert.match(layout, /interactiveWidget:\s*"resizes-content"/);
  });

  it("opens lead intelligence as a sheet instead of replacing the chat", () => {
    assert.match(inbox, /setIntelSheetOpen/);
    assert.doesNotMatch(inbox, /setMobilePane\("intel"\)/);
    assert.match(css, /data-intel-sheet="open"/);
  });

  it("shows message age once on a salesperson row", () => {
    const timeCalls = row.match(/formatRelativeMessageTime\(/g) ?? [];
    assert.equal(timeCalls.length, 1);
    assert.doesNotMatch(row, /waitingLabel \|\| \(followUpDue/);
  });

  it("keeps the composer in the chat column and states when a send will not happen", () => {
    assert.match(thread, /WhatsApp is offline\. This message will not be sent\./);
    assert.match(thread, /max-\[1099px\]:max-h-\[46%\]/);
    assert.match(thread, /sticky top-0 z-20/);
    assert.match(css, /100svh/);
    assert.match(css, /100dvh/);
  });

  it("keeps the course banner off the WhatsApp sales hub", () => {
    assert.match(course, /pathname === "\/sales\/inbox"/);
    assert.match(course, /if \(!ready \|\| inboxWorkspace\) return null/);
  });
});
