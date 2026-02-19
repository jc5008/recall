import { query } from "../db/client.js";

export async function promoteUserToAdmin(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Email is required." };
  }

  const result = await query(
    `
      UPDATE users
      SET role = 'admin'
      WHERE email = $1
      RETURNING user_id, email, role
    `,
    [normalizedEmail],
  );

  if (!result.rowCount) {
    return { ok: false, error: "User not found." };
  }

  return { ok: true, user: result.rows[0] };
}
