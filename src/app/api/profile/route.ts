import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { requireUser, toSafeUser } from "@/lib/server/auth";
import { body, guardOrigin, json, route } from "@/lib/server/http";

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(280).optional(),
  city: z.string().trim().max(80).optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  discoveryRadius: z.number().int().min(1).max(200).optional(),
  locationVisible: z.boolean().optional(),
  profileVisible: z.boolean().optional(),
  showDistance: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export async function PATCH(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const input = await body(request, schema);
    const mapping: Record<string, string> = { name: "name", bio: "bio", city: "city", discoveryRadius: "discovery_radius", locationVisible: "location_visible", profileVisible: "profile_visible", showDistance: "show_distance" };
    const fields: string[] = [];
    const values: (string | number)[] = [];
    for (const [key, column] of Object.entries(mapping)) if (key in input) {
      fields.push(`${column}=?`);
      const value = input[key as keyof typeof input];
      values.push(typeof value === "boolean" ? Number(value) : value as string | number);
    }
    if (input.interests) { fields.push("interests=?"); values.push(JSON.stringify([...new Set(input.interests)])); }
    getDb().prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).run(...values, user.id);
    const updated = getDb().prepare("SELECT * FROM users WHERE id=?").get(user.id) as Record<string, unknown>;
    return json({ user: toSafeUser(updated) });
  });
}
