import { NextRequest } from "next/server";
import { z } from "zod";
import { addNotification, getDb, id, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";
import { listPosts } from "@/lib/server/posts";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: originalId } = await context.params;
    const original = getDb().prepare("SELECT id,author_id,shared_post_id FROM posts WHERE id=?").get(originalId) as { id: string; author_id: string; shared_post_id: string | null } | undefined;
    if (!original || isBlocked(user.id, original.author_id)) throw new ApiError(404, "Post not found.");
    const { body: text } = await body(request, z.object({ body: z.string().trim().max(280).default("") }));
    const postId = id();
    const sharedId = original.shared_post_id || original.id;
    getDb().prepare("INSERT INTO posts (id,author_id,shared_post_id,body,created_at) VALUES (?,?,?,?,?)").run(postId, user.id, sharedId, text, now());
    addNotification(original.author_id, user.id, "share", postId, `${user.name} shared your post.`);
    return json({ post: listPosts(user.id, undefined, postId)[0] }, 201);
  });
}
