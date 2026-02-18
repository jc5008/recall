import { query } from "../../../../../lib/db/client";
import { requireAdminSession } from "../../../../../lib/admin/auth";
import { buildTopDifficultCardsQuery } from "../../../../../lib/reports/queries";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireAdminSession(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const deckName = searchParams.get("deck") || null;
  const limit = searchParams.get("limit") || 20;
  const minAttempts = searchParams.get("minAttempts") || 3;

  try {
    const sql = buildTopDifficultCardsQuery({ deckName, limit, minAttempts });
    const result = await query(sql.text, sql.values);
    return Response.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("top-difficult-cards query failed:", error);
    return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
}
