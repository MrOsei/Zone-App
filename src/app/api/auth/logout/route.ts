import { NextRequest } from "next/server";
import { destroySession } from "@/lib/server/auth";
import { guardOrigin, json, route } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  return route(async () => { guardOrigin(request); await destroySession(); return json({ ok: true }); });
}
