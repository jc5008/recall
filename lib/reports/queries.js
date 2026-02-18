export function buildTopDifficultCardsQuery({
  deckName = null,
  limit = 20,
  minAttempts = 3,
} = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  const safeMinAttempts = Math.max(1, Number(minAttempts) || 3);
  const values = [safeMinAttempts, safeLimit];

  let whereClause = "";
  if (deckName) {
    values.unshift(deckName);
    whereClause = "WHERE deck_name = $1";
  }

  const attemptsParam = deckName ? "$2" : "$1";
  const limitParam = deckName ? "$3" : "$2";

  const text = `
    SELECT
      deck_name,
      card_id,
      COUNT(*)::int AS attempts,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_count,
      ROUND(
        100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        2
      ) AS accuracy_pct
    FROM quiz_attempts
    ${whereClause}
    GROUP BY deck_name, card_id
    HAVING COUNT(*) >= ${attemptsParam}
    ORDER BY accuracy_pct ASC, attempts DESC
    LIMIT ${limitParam}
  `;

  return { text, values };
}

export function buildEmployeeProgressQuery({
  deckName = null,
  limit = 100,
} = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [safeLimit];
  let whereClause = "";

  if (deckName) {
    values.unshift(deckName);
    whereClause = "WHERE m.deck_name = $1";
  }

  const limitParam = deckName ? "$2" : "$1";

  const text = `
    SELECT
      COALESCE(m.user_id, 'anonymous') AS user_id,
      m.deck_name,
      COUNT(DISTINCT m.card_id)::int AS mastered_cards,
      MAX(m.timestamp) AS last_mastered_at
    FROM mastery_logs m
    ${whereClause}
    GROUP BY COALESCE(m.user_id, 'anonymous'), m.deck_name
    ORDER BY mastered_cards DESC, last_mastered_at DESC
    LIMIT ${limitParam}
  `;

  return { text, values };
}
