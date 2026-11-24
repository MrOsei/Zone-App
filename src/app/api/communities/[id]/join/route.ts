import { NextRequest } from "next/server";
import { addNotification, getDb, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: communityId } = await context.params;
    const community = getDb().prepare("SELECT id,name,owner_id FROM communities WHERE id=?").get(communityId) as { id: string; name: string; owner_id: string } | undefined;
    if (!community) throw new ApiError(404, "Community not found.");
    getDb().prepare("INSERT OR IGNORE INTO community_members (community_id,user_id,role,created_at) VALUES (?,?,'member',?)").run(communityId, user.id, now());
    addNotification(community.owner_id, user.id, "community_join", communityId, `${user.name} joined ${community.name}.`);
    return json({ joined: true });
  });
}
