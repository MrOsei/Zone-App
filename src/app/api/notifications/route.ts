import { NextRequest } from "next/server";
import { getDb, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").all(user.id) as Record<string, unknown>[];
    return json({ notifications: rows.map((row) => ({ id: row.id, type: row.type, entityId: row.entity_id, body: row.body, readAt: row.read_at, createdAt: row.created_at })) });
  });
}

export async function PATCH(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    getDb().prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").run(now(), user.id);
    return json({ ok: true });
  });
}
