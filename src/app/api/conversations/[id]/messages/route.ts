import { NextRequest } from "next/server";
import { z } from "zod";
import { addNotification, getDb, id, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, rateLimit, route } from "@/lib/server/http";
import { sendToUser } from "@/lib/server/realtime";

async function participant(conversationId: string, userId: string) {
  const row = getDb().prepare("SELECT * FROM conversations WHERE id=? AND (user_low=? OR user_high=?)").get(conversationId, userId, userId) as { id: string; user_low: string; user_high: string } | undefined;
  if (!row) throw new ApiError(404, "Conversation not found.");
  const recipientId = row.user_low === userId ? row.user_high : row.user_low;
  if (isBlocked(userId, recipientId)) throw new ApiError(403, "This conversation is unavailable.");
  return { ...row, recipientId };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id: conversationId } = await context.params;
    await participant(conversationId, user.id);
    const rows = getDb().prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at LIMIT 300").all(conversationId) as Record<string, unknown>[];
    getDb().prepare("UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL").run(now(), conversationId, user.id);
    return json({ messages: rows.map((row) => ({ id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at, readAt: row.read_at })) });
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    rateLimit(request, "message", 80, 60000);
    const user = await requireUser();
    const { id: conversationId } = await context.params;
    const conversation = await participant(conversationId, user.id);
    const { body: text } = await body(request, z.object({ body: z.string().trim().min(1).max(2000) }));
    const message = { id: id(), conversationId, senderId: user.id, body: text, createdAt: now(), readAt: null };
    getDb().prepare("INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)")
      .run(message.id, conversationId, user.id, text, message.createdAt);
    sendToUser(conversation.recipientId, { type: "message", data: message });
    addNotification(conversation.recipientId, user.id, "message", conversationId, `${user.name} sent you a message.`);
    return json({ message }, 201);
  });
}
