import { NextRequest } from "next/server";
import { z } from "zod";
import { areConnected, getDb, id, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare(`SELECT c.*,u.id other_id,u.name,u.username,u.avatar_url,
      (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message,
      (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) unread
      FROM conversations c JOIN users u ON u.id=CASE WHEN c.user_low=? THEN c.user_high ELSE c.user_low END
      WHERE c.user_low=? OR c.user_high=? ORDER BY last_message_at DESC NULLS LAST`).all(user.id, user.id, user.id, user.id) as Record<string, unknown>[];
    return json({ conversations: rows.map((row) => ({ id: row.id, person: { id: row.other_id, name: row.name, username: row.username, avatarUrl: row.avatar_url },
      lastMessage: row.last_message, lastMessageAt: row.last_message_at, unread: Number(row.unread) })) });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { recipientId } = await body(request, z.object({ recipientId: z.string().uuid() }));
    if (recipientId === user.id || isBlocked(user.id, recipientId)) throw new ApiError(403, "This conversation is unavailable.");
    if (!areConnected(user.id, recipientId)) throw new ApiError(403, "Connect with each other before messaging.");
    const [low, high] = [user.id, recipientId].sort();
    let conversation = getDb().prepare("SELECT id FROM conversations WHERE user_low=? AND user_high=?").get(low, high) as { id: string } | undefined;
    if (!conversation) {
      conversation = { id: id() };
      getDb().prepare("INSERT INTO conversations (id,user_low,user_high,created_at) VALUES (?,?,?,?)").run(conversation.id, low, high, now());
    }
    return json({ conversationId: conversation.id });
  });
}
