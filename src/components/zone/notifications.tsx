"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Bell, CheckCheck, Heart, MessageCircle, UserPlus } from "lucide-react";
import { api, Notification, relativeTime } from "@/lib/zone";
import { Button, EmptyState, ErrorBanner, PageHeader, Spinner } from "./ui";

function NotificationIcon({ type }: { type: string }) {
  if (type.includes("connection")) return <UserPlus size={20} />;
  if (type === "message") return <MessageCircle size={20} />;
  if (type === "like") return <Heart size={20} />;
  return <Bell size={20} />;
}

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const data = await api<{ notifications: Notification[] }>("/api/notifications"); setItems(data.notifications); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load notifications."); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const markAll = async () => {
    try { await api("/api/notifications", { method: "PATCH", body: "{}" }); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notifications."); }
  };
  const unread = items.filter((item) => !item.readAt).length;
  const hrefFor = (item: Notification) => item.type.includes("connection") ? "/connections" : item.type === "message" ? `/messages?conversation=${item.entityId}` : item.type.includes("community") ? "/communities" : item.type.includes("event") ? "/events" : "/";
  return <div className="page-container narrow-page"><PageHeader eyebrow="STAY IN THE LOOP" title="Notifications" description={unread ? `${unread} unread updates from your zone.` : "You’re all caught up."} action={<Button variant="secondary" onClick={markAll} disabled={!unread}><CheckCheck size={17} /> Mark all read</Button>} />
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="center-loading"><Spinner /></div> : items.length ? <div className="notification-list">{items.map((item) => <Link href={hrefFor(item)} key={item.id} className={`notification-row ${!item.readAt ? "unread" : ""}`}><span className="notification-icon"><NotificationIcon type={item.type} /></span><div><p>{item.body}</p><time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time></div><ArrowRight size={17} /></Link>)}</div> : <EmptyState icon={<Bell size={28} />} title="Quiet in here" description="New connection requests, messages, and activity on your posts will appear here." />}
  </div>;
}
