import { NextRequest } from "next/server";
import { z } from "zod";
import { addNotification, getDb, now } from "@/lib/server/db";
import { ApiError, requireUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const { id: eventId } = await context.params;
    const event = getDb().prepare("SELECT id,title,creator_id FROM events WHERE id=?").get(eventId) as { id: string; title: string; creator_id: string } | undefined;
    if (!event) throw new ApiError(404, "Event not found.");
    const { status } = await body(request, z.object({ status: z.enum(["going", "interested", "none"]) }));
    if (status === "none") getDb().prepare("DELETE FROM event_rsvps WHERE event_id=? AND user_id=?").run(eventId, user.id);
    else {
      getDb().prepare("INSERT INTO event_rsvps (event_id,user_id,status,created_at) VALUES (?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status")
        .run(eventId, user.id, status, now());
      if (status === "going") addNotification(event.creator_id, user.id, "event_rsvp", eventId, `${user.name} is going to ${event.title}.`);
    }
    const goingCount = Number((getDb().prepare("SELECT COUNT(*) count FROM event_rsvps WHERE event_id=? AND status='going'").get(eventId) as { count: number }).count);
    return json({ myStatus: status === "none" ? null : status, goingCount });
  });
}
