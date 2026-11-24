import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { createSession, toSafeUser, verifyPassword } from "@/lib/server/auth";
import { body, guardOrigin, json, rateLimit, route } from "@/lib/server/http";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    rateLimit(request, "login", 12, 300000);
    const input = await body(request, schema);
    const row = getDb().prepare("SELECT * FROM users WHERE email=?").get(input.email) as Record<string, unknown> | undefined;
    if (!row || !verifyPassword(input.password, String(row.password_hash))) return json({ error: "Email or password is incorrect." }, 401);
    await createSession(String(row.id));
    return json({ user: toSafeUser(row) });
  });
}
