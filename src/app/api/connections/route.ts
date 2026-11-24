import { NextRequest } from "next/server";
import { z } from "zod";
import { addNotification, getDb, id, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare(`SELECT c.*, sender.name sender_name,sender.username sender_username,sender.avatar_url sender_avatar,
      recipient.name recipient_name,recipient.username recipient_username,recipient.avatar_url recipient_avatar
      FROM connections c JOIN users sender ON sender.id=c.sender_id JOIN users recipient ON recipient.id=c.recipient_id
      WHERE c.sender_id=? OR c.recipient_id=? ORDER BY c.updated_at DESC`).all(user.id, user.id) as Record<string, unknown>[];
    const connections = rows.map((row) => {
      const incoming = row.recipient_id === user.id;
      return { id: row.id, status: row.status, direction: incoming ? "incoming" : "outgoing", person: {
        id: incoming ? row.sender_id : row.recipient_id, name: incoming ? row.sender_name : row.recipient_name,
        username: incoming ? row.sender_username : row.recipient_username, avatarUrl: incoming ? row.sender_avatar : row.recipient_avatar,
      }, updatedAt: row.updated_at };
    });
    return json({ connections });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { recipientId } = await body(request, z.object({ recipientId: z.string().uuid() }));
    if (recipientId === user.id) throw new ApiError(400, "You cannot connect with yourself.");
    if (isBlocked(user.id, recipientId)) throw new ApiError(403, "This connection is unavailable.");
    const target = getDb().prepare("SELECT id,name FROM users WHERE id=? AND profile_visible=1").get(recipientId) as { id: string; name: string } | undefined;
    if (!target) throw new ApiError(404, "Person not found.");
    const reverse = getDb().prepare("SELECT id FROM connections WHERE sender_id=? AND recipient_id=? AND status='pending'").get(recipientId, user.id) as { id: string } | undefined;
    if (reverse) {
      getDb().prepare("UPDATE connections SET status='accepted',updated_at=? WHERE id=?").run(now(), reverse.id);
      addNotification(recipientId, user.id, "connection_accepted", reverse.id, `${user.name} accepted your connection request.`);
      return json({ status: "accepted" });
    }
    const existing = getDb().prepare("SELECT id,status FROM connections WHERE sender_id=? AND recipient_id=?").get(user.id, recipientId) as { id: string; status: string } | undefined;
    if (existing?.status === "accepted") return json({ status: "accepted" });
    if (existing?.status === "pending") return json({ status: "pending" });
    const connectionId = existing?.id || id();
    if (existing) getDb().prepare("UPDATE connections SET status='pending',updated_at=? WHERE id=?").run(now(), connectionId);
    else getDb().prepare("INSERT INTO connections (id,sender_id,recipient_id,status,created_at,updated_at) VALUES (?,?,?,'pending',?,?)").run(connectionId, user.id, recipientId, now(), now());
    addNotification(recipientId, user.id, "connection_request", connectionId, `${user.name} sent you a connection request.`);
    return json({ status: "pending", id: connectionId }, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: connectionId, action } = await body(request, z.object({ id: z.string().uuid(), action: z.enum(["accept", "reject", "cancel"]) }));
    const connection = getDb().prepare("SELECT * FROM connections WHERE id=?").get(connectionId) as Record<string, string> | undefined;
    if (!connection) throw new ApiError(404, "Connection request not found.");
    if (action === "cancel") {
      if (connection.sender_id !== user.id) throw new ApiError(403, "Only the sender can cancel this request.");
      getDb().prepare("DELETE FROM connections WHERE id=?").run(connectionId);
      return json({ status: "cancelled" });
    }
    if (connection.recipient_id !== user.id || connection.status !== "pending") throw new ApiError(403, "You cannot update this request.");
    const status = action === "accept" ? "accepted" : "rejected";
    getDb().prepare("UPDATE connections SET status=?,updated_at=? WHERE id=?").run(status, now(), connectionId);
    if (status === "accepted") addNotification(connection.sender_id, user.id, "connection_accepted", connectionId, `${user.name} accepted your connection request.`);
    return json({ status });
  });
}
