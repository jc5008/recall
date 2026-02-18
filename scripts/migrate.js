import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withTransaction } from "../lib/db/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "..", "db", "migrations");
const envLocalPath = path.join(__dirname, "..", ".env.local");

async function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;

  try {
    const envContents = await fs.readFile(envLocalPath, "utf8");
    const match = envContents.match(/^DATABASE_URL=(.*)$/m);
    if (!match?.[1]) return;
    process.env.DATABASE_URL = match[1].trim();
  } catch {
    // Ignore missing env file; normal error handling occurs in db client.
  }
}

async function runMigrations() {
  await ensureDatabaseUrl();
  const entries = await fs.readdir(migrationsDir);
  const migrationFiles = entries.filter((name) => name.endsWith(".sql")).sort();

  if (!migrationFiles.length) {
    console.log("No migrations found.");
    return;
  }

  await withTransaction(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const filename of migrationFiles) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (existing.rowCount > 0) {
        continue;
      }

      const fullPath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(fullPath, "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      console.log(`Applied migration: ${filename}`);
    }
  });
}

runMigrations()
  .then(() => {
    console.log("Migrations completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
