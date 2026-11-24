import { NextRequest } from "next/server";
import { z } from "zod";
import { addNotification, getDb, id, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

async function postForUser(postId: string, userId: string) {
  const post = getDb().prepare("SELECT id,author_id FROM posts WHERE id=?").get(postId) as { id: string; author_id: string } | undefined;
  if (!post || isBlocked(userId, post.author_id)) throw new ApiError(404, "Post not found.");
  return post;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { id: postId } = await context.params;
    await postForUser(postId, user.id);
    const comments = getDb().prepare(`SELECT c.*,u.name,u.username,u.avatar_url FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at`).all(postId) as Record<string, unknown>[];
    return json({ comments: comments.map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at, author: { id: row.author_id, name: row.name, username: row.username, avatarUrl: row.avatar_url } })) });
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: postId } = await context.params;
    const post = await postForUser(postId, user.id);
    const { body: text } = await body(request, z.object({ body: z.string().trim().min(1).max(1000) }));
    const commentId = id();
    getDb().prepare("INSERT INTO comments (id,post_id,author_id,body,created_at) VALUES (?,?,?,?,?)").run(commentId, postId, user.id, text, now());
    addNotification(post.author_id, user.id, "comment", postId, `${user.name} commented on your post.`);
    return json({ comment: { id: commentId, body: text, createdAt: now(), author: user } }, 201);
  });
}
