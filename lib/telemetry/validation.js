const ALLOWED_TYPES = new Set([
  "session_log",
  "quiz_attempt",
  "quiz_timing",
  "search_log",
  "reference_view",
  "card_interaction",
  "phase_log",
  "quiz_result",
  "card_timing",
  "loop_metric",
  "mastery_log",
  "session_abandon",
]);

function hasString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateTelemetryEvent(event) {
  if (!event || typeof event !== "object") {
    return { ok: false, reason: "event_must_be_object" };
  }

  if (!ALLOWED_TYPES.has(event.type)) {
    return { ok: false, reason: "unsupported_type" };
  }

  if (!hasString(event.session_id)) {
    return { ok: false, reason: "missing_session_id" };
  }

  if (!hasString(event.fingerprint_id)) {
    return { ok: false, reason: "missing_fingerprint_id" };
  }

  return { ok: true };
}

export function validateTelemetryBatch(events) {
  if (!Array.isArray(events)) {
    return { ok: false, reason: "events_must_be_array" };
  }

  for (let i = 0; i < events.length; i += 1) {
    const result = validateTelemetryEvent(events[i]);
    if (!result.ok) {
      return { ok: false, reason: `${result.reason}_at_index_${i}` };
    }
  }

  return { ok: true };
}

export { ALLOWED_TYPES };
