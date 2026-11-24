import { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: communityId } = await context.params;
    const member = getDb().prepare("SELECT role FROM community_members WHERE community_id=? AND user_id=?").get(communityId, user.id) as { role: string } | undefined;
    if (!member) throw new ApiError(404, "Membership not found.");
    if (member.role === "owner") throw new ApiError(400, "Community owners cannot leave their own community.");
    getDb().prepare("DELETE FROM community_members WHERE community_id=? AND user_id=?").run(communityId, user.id);
    return json({ joined: false });
  });
}
