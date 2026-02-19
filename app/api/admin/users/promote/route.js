import { requireAdminSession } from "../../../../../lib/admin/auth";
import { promoteUserToAdmin } from "../../../../../lib/admin/users";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = requireAdminSession(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const email = body?.email;
    const result = await promoteUserToAdmin(email);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true, user: result.user });
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
