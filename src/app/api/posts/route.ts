import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, id, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, rateLimit, route } from "@/lib/server/http";
import { listPosts } from "@/lib/server/posts";

export async function GET(request: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const communityId = request.nextUrl.searchParams.get("communityId") || undefined;
    return json({ posts: listPosts(user.id, communityId) });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    rateLimit(request, "post", 30, 60000);
    const user = await requireUser();
    const input = await body(request, z.object({ body: z.string().trim().min(1).max(2000), communityId: z.string().uuid().nullable().optional() }));
    if (input.communityId) {
      const member = getDb().prepare("SELECT 1 FROM community_members WHERE community_id=? AND user_id=?").get(input.communityId, user.id);
      if (!member) throw new ApiError(403, "Join this community before posting.");
    }
    const postId = id();
    getDb().prepare("INSERT INTO posts (id,author_id,community_id,body,created_at) VALUES (?,?,?,?,?)")
      .run(postId, user.id, input.communityId || null, input.body, now());
    return json({ post: listPosts(user.id, undefined, postId)[0] }, 201);
  });
}
