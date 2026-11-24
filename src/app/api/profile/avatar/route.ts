import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { dataDir, getDb } from "@/lib/server/db";
import { requireUser, toSafeUser } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

const types: Record<string, { extension: string; magic: number[] }> = {
  "image/jpeg": { extension: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { extension: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};

export async function POST(request: NextRequest) {
  return route(async () => {
    guardOrigin(request);
    const user = await requireUser();
    const file = (await request.formData()).get("avatar");
    if (!(file instanceof File) || !types[file.type] || file.size > 2 * 1024 * 1024 || file.size < 32) return json({ error: "Choose a PNG, JPEG, or WebP image under 2 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { magic, extension } = types[file.type];
    if (!magic.every((byte, index) => bytes[index] === byte)) return json({ error: "The image content does not match its file type." }, 400);
    const directory = path.join(dataDir, "uploads");
    mkdirSync(directory, { recursive: true });
    const filename = `${randomBytes(24).toString("hex")}.${extension}`;
    writeFileSync(path.join(directory, filename), bytes, { flag: "wx" });
    const avatarUrl = `/api/avatars/${filename}`;
    getDb().prepare("UPDATE users SET avatar_url=? WHERE id=?").run(avatarUrl, user.id);
    const updated = getDb().prepare("SELECT * FROM users WHERE id=?").get(user.id) as Record<string, unknown>;
    return json({ user: toSafeUser(updated) });
  });
}
