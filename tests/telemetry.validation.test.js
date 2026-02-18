import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_TYPES,
  validateTelemetryBatch,
  validateTelemetryEvent,
} from "../lib/telemetry/validation.js";

test("validateTelemetryEvent accepts valid event", () => {
  const event = {
    type: "quiz_attempt",
    session_id: "session_1",
    fingerprint_id: "fp_1",
  };
  const result = validateTelemetryEvent(event);
  assert.equal(result.ok, true);
});

test("validateTelemetryEvent rejects unsupported type", () => {
  const event = {
    type: "not_supported",
    session_id: "session_1",
    fingerprint_id: "fp_1",
  };
  const result = validateTelemetryEvent(event);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unsupported_type/);
});

test("validateTelemetryBatch rejects malformed batch payload", () => {
  const result = validateTelemetryBatch({ not: "array" });
  assert.equal(result.ok, false);
});

test("ALLOWED_TYPES includes session_abandon", () => {
  assert.equal(ALLOWED_TYPES.has("session_abandon"), true);
});
