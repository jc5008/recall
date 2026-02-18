import { query } from "../../../../../lib/db/client";
import { requireAdminSession } from "../../../../../lib/admin/auth";
import { buildEmployeeProgressQuery } from "../../../../../lib/reports/queries";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireAdminSession(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const deckName = searchParams.get("deck") || null;
  const limit = searchParams.get("limit") || 100;

  try {
    const sql = buildEmployeeProgressQuery({ deckName, limit });
    const result = await query(sql.text, sql.values);
    return Response.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("employee-progress query failed:", error);
    return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
}
