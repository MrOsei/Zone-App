import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, id, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare(`SELECT c.*,u.name owner_name,(SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) member_count,
      EXISTS(SELECT 1 FROM community_members mine WHERE mine.community_id=c.id AND mine.user_id=?) joined
      FROM communities c JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC`).all(user.id) as Record<string, unknown>[];
    return json({ communities: rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description,
      ownerName: row.owner_name, memberCount: Number(row.member_count), joined: Boolean(row.joined), ownerId: row.owner_id, createdAt: row.created_at })) });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const input = await body(request, z.object({ name: z.string().trim().min(3).max(60), description: z.string().trim().min(10).max(500) }));
    const communityId = id();
    const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "zone";
    let slug = baseSlug;
    if (getDb().prepare("SELECT 1 FROM communities WHERE slug=?").get(slug)) slug = `${baseSlug}-${communityId.slice(0, 6)}`;
    const db = getDb();
    db.transaction(() => {
      db.prepare("INSERT INTO communities (id,owner_id,name,slug,description,created_at) VALUES (?,?,?,?,?,?)").run(communityId, user.id, input.name, slug, input.description, now());
      db.prepare("INSERT INTO community_members (community_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(communityId, user.id, now());
    })();
    return json({ community: { id: communityId, name: input.name, slug, description: input.description, ownerName: user.name, memberCount: 1, joined: true, ownerId: user.id } }, 201);
  });
}
