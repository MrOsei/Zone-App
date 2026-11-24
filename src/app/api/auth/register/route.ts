import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb, id, now } from "@/lib/server/db";
import { createSession, hashPassword, toSafeUser } from "@/lib/server/auth";
import { body, guardOrigin, json, rateLimit, route } from "@/lib/server/http";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letters, numbers, or underscores."),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  city: z.string().trim().max(80).default(""),
  interests: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
});

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    rateLimit(request, "register", 8, 3600000);
    const input = await body(request, schema);
    const db = getDb();
    const existing = db.prepare("SELECT email,username FROM users WHERE email=? OR username=?").get(input.email, input.username) as { email: string; username: string } | undefined;
    if (existing) return json({ error: existing.email === input.email ? "An account already uses this email." : "That username is already taken." }, 409);
    const userId = id();
    db.prepare(`INSERT INTO users (id,email,username,password_hash,name,city,interests,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(userId, input.email, input.username, hashPassword(input.password), input.name, input.city, JSON.stringify([...new Set(input.interests)]), now());
    await createSession(userId);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId) as Record<string, unknown>;
    return json({ user: toSafeUser(user) }, 201);
  });
}
