import { NextRequest } from "next/server";
import { addNotification, getDb, isBlocked, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: postId } = await context.params;
    const post = getDb().prepare("SELECT id,author_id FROM posts WHERE id=?").get(postId) as { id: string; author_id: string } | undefined;
    if (!post || isBlocked(user.id, post.author_id)) throw new ApiError(404, "Post not found.");
    const existing = getDb().prepare("SELECT 1 FROM likes WHERE post_id=? AND user_id=?").get(postId, user.id);
    if (existing) getDb().prepare("DELETE FROM likes WHERE post_id=? AND user_id=?").run(postId, user.id);
    else {
      getDb().prepare("INSERT INTO likes (post_id,user_id,created_at) VALUES (?,?,?)").run(postId, user.id, now());
      addNotification(post.author_id, user.id, "like", postId, `${user.name} liked your post.`);
    }
    const likeCount = Number((getDb().prepare("SELECT COUNT(*) count FROM likes WHERE post_id=?").get(postId) as { count: number }).count);
    return json({ liked: !existing, likeCount });
  });
}
