import { query, withTransaction } from "../../../lib/db/client";
import { validateTelemetryBatch } from "../../../lib/telemetry/validation";

export const runtime = "nodejs";

function toIsoOrNow(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

async function ensureSession(client, event) {
  await client.query(
    `
      INSERT INTO sessions (
        session_id, user_id, fingerprint_id, started_at,
        ip_address, user_agent, timezone, language,
        screen_width, screen_height, referrer_url,
        utm_source, utm_medium, utm_campaign
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (session_id) DO NOTHING
    `,
    [
      normalizeString(event.session_id),
      normalizeString(event.user_id),
      normalizeString(event.fingerprint_id) ?? "unknown",
      toIsoOrNow(event.session_started_at),
      normalizeString(event.ip_address),
      normalizeString(event.user_agent),
      normalizeString(event.timezone),
      normalizeString(event.language),
      event.screen_width ?? null,
      event.screen_height ?? null,
      normalizeString(event.referrer_url),
      normalizeString(event.utm_source),
      normalizeString(event.utm_medium),
      normalizeString(event.utm_campaign),
    ],
  );
}

async function insertEvent(client, event) {
  const type = normalizeString(event.type);

  if (!type) return;

  await ensureSession(client, event);

  if (type === "session_log") {
    await client.query(
      `
        INSERT INTO session_logs (
          session_id, user_id, fingerprint_id, deck_name, mode, duration_seconds, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.mode) ?? "unknown",
        Math.max(0, Number(event.duration_seconds ?? 0)),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "quiz_attempt") {
    await client.query(
      `
        INSERT INTO quiz_attempts (
          session_id, user_id, fingerprint_id, deck_name, card_id,
          is_correct, selected_answer_id, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        Boolean(event.is_correct),
        normalizeString(event.selected_answer_id),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "quiz_timing") {
    await client.query(
      `
        INSERT INTO quiz_timing (
          session_id, user_id, fingerprint_id, deck_name, card_id, time_to_answer_ms, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        Math.max(0, Number(event.time_to_answer_ms ?? 0)),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "search_log") {
    await client.query(
      `
        INSERT INTO search_logs (
          session_id, user_id, fingerprint_id, deck_name, mode, search_term, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.mode) ?? "unknown",
        normalizeString(event.search_term) ?? "",
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "reference_view") {
    await client.query(
      `
        INSERT INTO reference_views (
          session_id, user_id, fingerprint_id, deck_name, alpha_code, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.alpha_code),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "card_interaction") {
    await client.query(
      `
        INSERT INTO card_interactions (
          session_id, user_id, fingerprint_id, deck_name, card_id, interaction_type, phase, action, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        normalizeString(event.interaction_type) ?? "unknown",
        normalizeString(event.phase),
        normalizeString(event.action),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "phase_log") {
    await client.query(
      `
        INSERT INTO phase_logs (
          session_id, user_id, fingerprint_id, deck_name, batch_id, phase, duration_seconds, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.batch_id),
        normalizeString(event.phase) ?? "unknown",
        Math.max(0, Number(event.duration_seconds ?? 0)),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "quiz_result") {
    await client.query(
      `
        INSERT INTO quiz_results (
          session_id, user_id, fingerprint_id, deck_name, card_id, batch_id, is_correct, phase, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        normalizeString(event.batch_id),
        Boolean(event.is_correct),
        normalizeString(event.phase) ?? "unknown",
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "card_timing") {
    await client.query(
      `
        INSERT INTO card_timing (
          session_id, user_id, fingerprint_id, deck_name, card_id, time_to_flip_ms, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        Math.max(0, Number(event.time_to_flip_ms ?? 0)),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "loop_metric") {
    await client.query(
      `
        INSERT INTO loop_metrics (
          session_id, user_id, fingerprint_id, deck_name, card_id, batch_id, attempts_count, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        normalizeString(event.batch_id),
        Math.max(0, Number(event.attempts_count ?? 0)),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "mastery_log") {
    await client.query(
      `
        INSERT INTO mastery_logs (
          session_id, user_id, fingerprint_id, deck_name, card_id, marked_known, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.card_id) ?? "unknown",
        Boolean(event.marked_known),
        toIsoOrNow(event.timestamp),
      ],
    );
    return;
  }

  if (type === "session_abandon") {
    await client.query(
      `
        INSERT INTO session_abandons (
          session_id, user_id, fingerprint_id, deck_name, batch_id, phase, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        normalizeString(event.session_id),
        normalizeString(event.user_id),
        normalizeString(event.fingerprint_id) ?? "unknown",
        normalizeString(event.deck_name),
        normalizeString(event.batch_id),
        normalizeString(event.phase) ?? "unknown",
        toIsoOrNow(event.timestamp),
      ],
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const events = Array.isArray(body?.events) ? body.events : [];

    if (!events.length) {
      return Response.json({ ok: true, inserted: 0 });
    }

    const validation = validateTelemetryBatch(events);
    if (!validation.ok) {
      return Response.json({ ok: false, error: validation.reason }, { status: 400 });
    }

    await withTransaction(async (client) => {
      for (const event of events) {
        await insertEvent(client, event);
      }
    });

    return Response.json({ ok: true, inserted: events.length });
  } catch (error) {
    console.error("Telemetry insert failed:", error);
    return Response.json({ ok: false, error: "telemetry_insert_failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await query("SELECT NOW() AS now");
    return Response.json({ ok: true, now: result.rows[0]?.now ?? null });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
