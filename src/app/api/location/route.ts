import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, now } from "@/lib/server/db";
import { requireUser, toSafeUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

const schema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().positive().max(100000).optional() });

export async function PUT(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const input = await body(request, schema);
    getDb().prepare("UPDATE users SET latitude=?,longitude=?,location_updated_at=? WHERE id=?").run(input.latitude, input.longitude, now(), user.id);
    const updated = getDb().prepare("SELECT * FROM users WHERE id=?").get(user.id) as Record<string, unknown>;
    return json({ user: toSafeUser(updated) });
  });
}

export async function DELETE(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    getDb().prepare("UPDATE users SET latitude=NULL,longitude=NULL,location_updated_at=NULL WHERE id=?").run(user.id);
    const updated = getDb().prepare("SELECT * FROM users WHERE id=?").get(user.id) as Record<string, unknown>;
    return json({ user: toSafeUser(updated) });
  });
}
