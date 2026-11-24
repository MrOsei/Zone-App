import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare("SELECT u.id,u.name,u.username,u.avatar_url,b.created_at FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC").all(user.id) as Record<string, unknown>[];
    return json({ blocks: rows.map((row) => ({ id: row.id, name: row.name, username: row.username, avatarUrl: row.avatar_url, createdAt: row.created_at })) });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { userId } = await body(request, z.object({ userId: z.string().uuid() }));
    if (userId === user.id) throw new ApiError(400, "You cannot block yourself.");
    if (!getDb().prepare("SELECT 1 FROM users WHERE id=?").get(userId)) throw new ApiError(404, "Person not found.");
    const db = getDb();
    db.transaction(() => {
      db.prepare("INSERT OR IGNORE INTO blocks (blocker_id,blocked_id,created_at) VALUES (?,?,?)").run(user.id, userId, now());
      db.prepare("DELETE FROM connections WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)").run(user.id, userId, userId, user.id);
    })();
    return json({ blocked: true });
  });
}

export async function DELETE(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { userId } = await body(request, z.object({ userId: z.string().uuid() }));
    getDb().prepare("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?").run(user.id, userId);
    return json({ blocked: false });
  });
}
