import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/server/db";
import { route } from "@/lib/server/http";

const mime: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  return route(async () => {
    const { filename } = await context.params;
    if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(filename)) return new Response("Not found", { status: 404 });
    const extension = filename.split(".").pop()!;
    try {
      const bytes = readFileSync(path.join(dataDir, "uploads", filename));
      return new Response(bytes, { headers: { "Content-Type": mime[extension], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    } catch { return new Response("Not found", { status: 404 }); }
  });
}
