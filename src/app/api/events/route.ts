import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, id, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const rows = getDb().prepare(`SELECT e.*,u.name creator_name,u.username creator_username,
      (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id AND r.status='going') going_count,
      (SELECT status FROM event_rsvps mine WHERE mine.event_id=e.id AND mine.user_id=?) my_status
      FROM events e JOIN users u ON u.id=e.creator_id WHERE e.starts_at >= ? ORDER BY e.starts_at LIMIT 100`).all(user.id, new Date(Date.now() - 86400000).toISOString()) as Record<string, unknown>[];
    return json({ events: rows.map((row) => ({ id: row.id, title: row.title, description: row.description, locationName: row.location_name,
      startsAt: row.starts_at, endsAt: row.ends_at, creatorName: row.creator_name, creatorUsername: row.creator_username,
      goingCount: Number(row.going_count), myStatus: row.my_status, creatorId: row.creator_id })) });
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const input = await body(request, z.object({ title: z.string().trim().min(3).max(100), description: z.string().trim().min(10).max(1000),
      locationName: z.string().trim().min(2).max(160), startsAt: z.string().datetime(), endsAt: z.string().datetime().optional().nullable() })
      .refine((value) => new Date(value.startsAt).getTime() > Date.now() - 300000, "Choose a current or future start time.")
      .refine((value) => !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt), "End time must be after the start time."));
    const eventId = id();
    getDb().prepare("INSERT INTO events (id,creator_id,title,description,location_name,starts_at,ends_at,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(eventId, user.id, input.title, input.description, input.locationName, input.startsAt, input.endsAt || null, now());
    getDb().prepare("INSERT INTO event_rsvps (event_id,user_id,status,created_at) VALUES (?,?,'going',?)").run(eventId, user.id, now());
    return json({ event: { id: eventId, ...input, creatorId: user.id, creatorName: user.name, creatorUsername: user.username, goingCount: 1, myStatus: "going" } }, 201);
  });
}
