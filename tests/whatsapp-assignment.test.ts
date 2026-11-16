import assert from "node:assert/strict";
import test from "node:test";
import { roundRobinSlot } from "../lib/whatsapp/assignment";

test("round robin walks the rep list in order and wraps", () => {
  assert.deepEqual(roundRobinSlot(0, 3), { slot: 0, nextIndex: 1 });
  assert.deepEqual(roundRobinSlot(1, 3), { slot: 1, nextIndex: 2 });
  assert.deepEqual(roundRobinSlot(2, 3), { slot: 2, nextIndex: 3 });
  assert.deepEqual(roundRobinSlot(3, 3), { slot: 0, nextIndex: 4 });
});

test("round robin ignores how many open leads a rep already has", () => {
  const reps = ["a", "b", "c"];
  const turns = [0, 1, 2, 3, 4].map((index) => reps[roundRobinSlot(index, reps.length).slot]);
  assert.deepEqual(turns, ["a", "b", "c", "a", "b"]);
});
