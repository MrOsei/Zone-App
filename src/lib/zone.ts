export type User = {
  id: string; email: string; username: string; name: string; bio: string;
  avatarUrl: string | null; interests: string[]; city: string; discoveryRadius: number;
  locationVisible: boolean; profileVisible: boolean; showDistance: boolean; hasLocation: boolean; createdAt: string;
};
export type Person = {
  id: string; name: string; username: string; bio?: string; avatarUrl: string | null;
  interests?: string[]; city?: string; sharedInterests?: string[]; distanceKm?: number | null;
  connectionStatus?: "pending" | "accepted" | "rejected" | null; connectionDirection?: "incoming" | "outgoing" | null;
};
export type Post = {
  id: string; body: string; createdAt: string; likeCount: number; commentCount: number; liked: boolean;
  communityId?: string | null; communityName?: string | null; author: Person;
  sharedPost: { id: string; body: string; createdAt: string; author: Person } | null;
};
export type Comment = { id: string; body: string; createdAt: string; author: Person };
export type Conversation = { id: string; person: Person; lastMessage: string | null; lastMessageAt: string | null; unread: number };
export type Message = { id: string; conversationId?: string; senderId: string; body: string; createdAt: string; readAt: string | null };
export type Community = { id: string; name: string; slug: string; description: string; ownerName: string; ownerId: string; memberCount: number; joined: boolean; createdAt: string };
export type ZoneEvent = { id: string; title: string; description: string; locationName: string; startsAt: string; endsAt: string | null; creatorId: string; creatorName: string; creatorUsername: string; goingCount: number; myStatus: "going" | "interested" | null };
export type Notification = { id: string; type: string; entityId: string | null; body: string; readAt: string | null; createdAt: string };

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data as T;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", options || { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
export function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
