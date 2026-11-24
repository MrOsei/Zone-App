import { getDb } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    getDb().prepare("SELECT 1").get();
    const migration = getDb().prepare("SELECT version,applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1").get() as { version: string; applied_at: string };
    return json({ status: "ok", database: "connected", migration: migration.version, timestamp: new Date().toISOString() });
  });
}
