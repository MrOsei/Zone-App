import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, id, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, rateLimit, route } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    rateLimit(request, "report", 10, 3600000);
    const user = await requireUser();
    const input = await body(request, z.object({ reportedUserId: z.string().uuid().optional(), postId: z.string().uuid().optional(),
      reason: z.enum(["harassment", "spam", "hate", "unsafe", "impersonation", "other"]), details: z.string().trim().max(1000).default("") })
      .refine((value) => value.reportedUserId || value.postId, "Choose a person or post to report."));
    if (input.reportedUserId === user.id) throw new ApiError(400, "You cannot report yourself.");
    if (input.reportedUserId && !getDb().prepare("SELECT 1 FROM users WHERE id=?").get(input.reportedUserId)) throw new ApiError(404, "Person not found.");
    if (input.postId && !getDb().prepare("SELECT 1 FROM posts WHERE id=?").get(input.postId)) throw new ApiError(404, "Post not found.");
    const reportId = id();
    getDb().prepare("INSERT INTO reports (id,reporter_id,reported_user_id,post_id,reason,details,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(reportId, user.id, input.reportedUserId || null, input.postId || null, input.reason, input.details, now());
    return json({ report: { id: reportId, status: "open" } }, 201);
  });
}
