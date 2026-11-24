import { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function GET(request: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const requestedRadius = Number(request.nextUrl.searchParams.get("radius") || user.discoveryRadius);
    const radius = Number.isFinite(requestedRadius) ? Math.max(1, Math.min(200, requestedRadius)) : user.discoveryRadius;
    const me = getDb().prepare("SELECT latitude,longitude,interests FROM users WHERE id=?").get(user.id) as { latitude: number | null; longitude: number | null; interests: string };
    const rows = getDb().prepare(`SELECT id,username,name,bio,avatar_url,interests,city,latitude,longitude,location_visible,show_distance,created_at FROM users
      WHERE id<>? AND profile_visible=1
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=users.id) OR (blocker_id=users.id AND blocked_id=?))`).all(user.id, user.id, user.id) as Record<string, unknown>[];
    const ownInterests = new Set(JSON.parse(me.interests || "[]") as string[]);
    const people = rows.map((row) => {
      const interests = JSON.parse(String(row.interests || "[]")) as string[];
      const hasDistance = Boolean(row.location_visible) && me.latitude != null && me.longitude != null && row.latitude != null && row.longitude != null;
      const distance = hasDistance ? distanceKm(me.latitude!, me.longitude!, Number(row.latitude), Number(row.longitude)) : null;
      const connection = getDb().prepare("SELECT status,sender_id FROM connections WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)")
        .get(user.id, row.id, row.id, user.id) as { status: string; sender_id: string } | undefined;
      return {
        id: row.id, username: row.username, name: row.name, bio: row.bio, avatarUrl: row.avatar_url,
        interests, city: row.city, sharedInterests: interests.filter((item) => ownInterests.has(item)),
        distanceKm: distance != null && row.show_distance ? Math.round(distance * 10) / 10 : null,
        rawDistance: distance, connectionStatus: connection?.status || null,
        connectionDirection: connection ? (connection.sender_id === user.id ? "outgoing" : "incoming") : null,
      };
    }).filter((person) => {
      const matchesQuery = !q || `${person.name} ${person.username} ${person.city} ${person.interests.join(" ")}`.toLowerCase().includes(q);
      const matchesDistance = q ? true : person.rawDistance != null && person.rawDistance <= radius;
      return matchesQuery && matchesDistance;
    }).sort((a, b) => b.sharedInterests.length - a.sharedInterests.length || (a.rawDistance ?? Infinity) - (b.rawDistance ?? Infinity))
      .slice(0, 60).map(({ rawDistance: _private, ...person }) => { void _private; return person; });
    return json({ people, needsLocation: !q && (me.latitude == null || me.longitude == null), radius });
  });
}
