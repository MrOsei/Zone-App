import { getCurrentUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

export async function GET() {
  return route(async () => json({ user: await getCurrentUser() }));
}
