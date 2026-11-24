import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";
import { ApiError } from "./auth";

const attempts = new Map<string, { count: number; reset: number }>();

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function body<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  return schema.parse(await request.json());
}

export function guardOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    throw new ApiError(403, "Cross-site request rejected.");
  }
}

export function rateLimit(request: NextRequest, bucket: string, limit = 30, windowMs = 60000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const time = Date.now();
  const current = attempts.get(key);
  if (!current || current.reset < time) attempts.set(key, { count: 1, reset: time + windowMs });
  else if (++current.count > limit) throw new ApiError(429, "Too many requests. Please try again shortly.");
  if (attempts.size > 10000) for (const [key, value] of attempts) if (value.reset < time) attempts.delete(key);
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message || "Invalid input.", fields: error.flatten().fieldErrors }, 400);
  if (error instanceof SyntaxError) return json({ error: "Invalid JSON request." }, 400);
  console.error("ZONE request failed", error);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export function route(handler: () => Promise<Response> | Response) {
  return Promise.resolve().then(handler).catch(handleError);
}
