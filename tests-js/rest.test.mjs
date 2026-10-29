import test from "node:test";
import assert from "node:assert/strict";
import {
  recommendedRestSeconds,
  remainingRestSeconds,
  formatRest,
} from "../docs/rest.js";

test("compound patterns default to two minutes", () => {
  assert.equal(recommendedRestSeconds({ pattern: "squat" }), 120);
  assert.equal(recommendedRestSeconds({ pattern: "horizontal_push" }), 120);
});

test("isolation patterns default to ninety seconds", () => {
  assert.equal(recommendedRestSeconds({ pattern: "isolation" }), 90);
  assert.equal(recommendedRestSeconds({ pattern: "core" }), 90);
});

test("remaining rest is derived from set completion timestamp", () => {
  const result = remainingRestSeconds({
    loggedAt: "2026-10-29T12:00:00.000Z",
    recommendedSeconds: 120,
    nowMs: Date.parse("2026-10-29T12:00:30.000Z"),
  });
  assert.equal(result, 90);
});

test("rest formatter is stable", () => {
  assert.equal(formatRest(120), "2:00");
  assert.equal(formatRest(89), "1:29");
});
