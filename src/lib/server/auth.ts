import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, now } from "./db";

export const SESSION_COOKIE = "zone_session";
const SESSION_DAYS = 30;

export type SafeUser = {
  id: string; email: string; username: string; name: string; bio: string;
  avatarUrl: string | null; interests: string[]; city: string;
  discoveryRadius: number; locationVisible: boolean; profileVisible: boolean;
  showDistance: boolean; hasLocation: boolean; createdAt: string;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function toSafeUser(row: Record<string, unknown>): SafeUser {
  return {
    id: String(row.id), email: String(row.email), username: String(row.username), name: String(row.name),
    bio: String(row.bio || ""), avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    interests: JSON.parse(String(row.interests || "[]")), city: String(row.city || ""),
    discoveryRadius: Number(row.discovery_radius), locationVisible: Boolean(row.location_visible),
    profileVisible: Boolean(row.profile_visible), showDistance: Boolean(row.show_distance),
    hasLocation: row.latitude != null && row.longitude != null, createdAt: String(row.created_at),
  };
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb().prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > ?`)
    .get(hashToken(token), now()) as Record<string, unknown> | undefined;
  return row ? toSafeUser(row) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  getDb().prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .run(hashToken(token), userId, expires.toISOString(), now());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires, priority: "high",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
