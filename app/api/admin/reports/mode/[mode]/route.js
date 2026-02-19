import { query } from "../../../../../../lib/db/client";
import { requireAdminSession } from "../../../../../../lib/admin/auth";

export const runtime = "nodejs";

function sanitizeMode(mode) {
  const allowed = new Set(["reference", "grid", "quiz", "exposure", "recall", "loop"]);
  return allowed.has(mode) ? mode : null;
}

function sanitizeLimit(value) {
  return Math.max(1, Math.min(200, Number(value) || 25));
}

async function runReferenceReport(deck, limit) {
  const [searchTerms, alphaCodes, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          search_term,
          COUNT(*)::int AS searches,
          COUNT(DISTINCT COALESCE(user_id, fingerprint_id))::int AS users
        FROM search_logs
        WHERE mode = 'reference'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY search_term
        ORDER BY searches DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          alpha_code,
          COUNT(*)::int AS views,
          COUNT(DISTINCT COALESCE(user_id, fingerprint_id))::int AS users
        FROM reference_views
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY alpha_code
        ORDER BY views DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'reference'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "search_terms", title: "Top Reference Search Terms", rows: searchTerms.rows },
    { key: "alpha_codes", title: "Reference Filter Usage (Alpha Codes)", rows: alphaCodes.rows },
    {
      key: "session_duration",
      title: "Reference Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

async function runGridReport(deck, limit) {
  const [flips, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          card_id,
          COUNT(*)::int AS flip_count,
          COUNT(DISTINCT COALESCE(user_id, fingerprint_id))::int AS users
        FROM card_interactions
        WHERE interaction_type = 'flip'
          AND phase = 'grid'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY flip_count DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'grid'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "grid_flips", title: "Grid Card Flips", rows: flips.rows },
    {
      key: "grid_session_duration",
      title: "Grid Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

async function runQuizReport(deck, limit) {
  const [difficulty, timing, mastery, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          card_id,
          COUNT(*)::int AS attempts,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_count,
          ROUND(
            100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
            2
          ) AS accuracy_pct
        FROM quiz_attempts
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        HAVING COUNT(*) >= 2
        ORDER BY accuracy_pct ASC, attempts DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          card_id,
          ROUND(AVG(time_to_answer_ms)::numeric, 2) AS avg_time_to_answer_ms,
          COUNT(*)::int AS attempts
        FROM quiz_timing
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY avg_time_to_answer_ms DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COALESCE(user_id, 'anonymous') AS user_id,
          COUNT(DISTINCT card_id)::int AS mastered_cards,
          MAX(timestamp) AS last_mastered_at
        FROM mastery_logs
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY COALESCE(user_id, 'anonymous')
        ORDER BY mastered_cards DESC, last_mastered_at DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'quiz'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "quiz_difficulty", title: "Quiz Difficulty by Card", rows: difficulty.rows },
    { key: "quiz_timing", title: "Quiz Response Time by Card", rows: timing.rows },
    { key: "quiz_mastery", title: "Quiz Mastery by User", rows: mastery.rows },
    {
      key: "quiz_session_duration",
      title: "Quiz Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

async function runExposureReport(deck, limit) {
  const [batchDuration, passiveFlips, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          batch_id,
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM phase_logs
        WHERE phase = 'exposure'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY batch_id
        ORDER BY avg_duration_seconds DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          card_id,
          COUNT(*)::int AS passive_flip_count,
          COUNT(DISTINCT COALESCE(user_id, fingerprint_id))::int AS users
        FROM card_interactions
        WHERE phase = 'exposure'
          AND interaction_type = 'flip'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY passive_flip_count DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'exposure'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "exposure_batch_duration", title: "Exposure Batch Duration", rows: batchDuration.rows },
    { key: "exposure_passive_flips", title: "Exposure Passive Flips", rows: passiveFlips.rows },
    {
      key: "exposure_session_duration",
      title: "Exposure Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

async function runRecallReport(deck, limit) {
  const [firstPass, flipTiming, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          card_id,
          COUNT(*)::int AS attempts,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_count,
          ROUND(
            100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
            2
          ) AS first_pass_accuracy_pct
        FROM quiz_results
        WHERE phase = 'recall'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY first_pass_accuracy_pct ASC, attempts DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          card_id,
          ROUND(AVG(time_to_flip_ms)::numeric, 2) AS avg_time_to_flip_ms,
          COUNT(*)::int AS attempts
        FROM card_timing
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY avg_time_to_flip_ms DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'recall'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "recall_first_pass", title: "Recall First-Attempt Accuracy", rows: firstPass.rows },
    { key: "recall_flip_timing", title: "Recall Time-to-Flip", rows: flipTiming.rows },
    {
      key: "recall_session_duration",
      title: "Recall Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

async function runLoopReport(deck, limit) {
  const [iterations, abandons, sessionDuration] = await Promise.all([
    query(
      `
        SELECT
          card_id,
          ROUND(AVG(attempts_count)::numeric, 2) AS avg_attempts_count,
          MAX(attempts_count)::int AS max_attempts_count,
          COUNT(*)::int AS records
        FROM loop_metrics
        WHERE ($1::text IS NULL OR deck_name = $1)
        GROUP BY card_id
        ORDER BY avg_attempts_count DESC, records DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          batch_id,
          COUNT(*)::int AS abandon_count
        FROM session_abandons
        WHERE phase = 'loop'
          AND ($1::text IS NULL OR deck_name = $1)
        GROUP BY batch_id
        ORDER BY abandon_count DESC
        LIMIT $2
      `,
      [deck, limit],
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS sessions,
          ROUND(AVG(duration_seconds)::numeric, 2) AS avg_duration_seconds,
          MAX(duration_seconds)::int AS max_duration_seconds
        FROM session_logs
        WHERE mode = 'loop'
          AND ($1::text IS NULL OR deck_name = $1)
      `,
      [deck],
    ),
  ]);

  return [
    { key: "loop_iterations", title: "Loop Iterations by Card", rows: iterations.rows },
    { key: "loop_abandons", title: "Loop Drop-off by Batch", rows: abandons.rows },
    {
      key: "loop_session_duration",
      title: "Loop Session Duration",
      rows: sessionDuration.rows,
    },
  ];
}

export async function GET(request, context) {
  const auth = requireAdminSession(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const params = await context?.params;
  const mode = sanitizeMode(params?.mode);
  if (!mode) {
    return Response.json({ ok: false, error: "Unsupported report mode." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const deck = searchParams.get("deck") || null;
  const limit = sanitizeLimit(searchParams.get("limit"));

  try {
    let sections = [];
    if (mode === "reference") sections = await runReferenceReport(deck, limit);
    if (mode === "grid") sections = await runGridReport(deck, limit);
    if (mode === "quiz") sections = await runQuizReport(deck, limit);
    if (mode === "exposure") sections = await runExposureReport(deck, limit);
    if (mode === "recall") sections = await runRecallReport(deck, limit);
    if (mode === "loop") sections = await runLoopReport(deck, limit);

    return Response.json({
      ok: true,
      mode,
      filters: { deck, limit },
      sections,
    });
  } catch (error) {
    console.error(`mode report query failed for ${mode}:`, error);
    return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
}
