import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promoteUserToAdmin } from "../lib/admin/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envLocalPath = path.join(__dirname, "..", ".env.local");

async function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;

  try {
    const envContents = await fs.readFile(envLocalPath, "utf8");
    const match = envContents.match(/^DATABASE_URL=(.*)$/m);
    if (!match?.[1]) return;
    process.env.DATABASE_URL = match[1].trim();
  } catch {
    // ignore missing env local here
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage: npm run admin:promote -- user@example.com");
  }

  await ensureDatabaseUrl();
  const result = await promoteUserToAdmin(email);

  if (!result.ok) {
    throw new Error(result.error || "Failed to promote user.");
  }

  console.log(`Promoted user to admin: ${result.user.email} (${result.user.user_id})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
