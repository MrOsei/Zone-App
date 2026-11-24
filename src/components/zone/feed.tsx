"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Edit3, MapPin, Plus, Users } from "lucide-react";
import { api, Post, ZoneEvent } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, EmptyState, ErrorBanner, Spinner } from "./ui";
import { PostCard } from "./post-card";

export function Feed() {
  const { user } = useZone();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [body, setBody] = useState("");
  const [connections, setConnections] = useState(0);
  const [nextEvent, setNextEvent] = useState<ZoneEvent | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const [feedData, connectionData, eventData] = await Promise.all([
        api<{ posts: Post[] }>("/api/posts"), api<{ connections: { status: string }[] }>("/api/connections"), api<{ events: ZoneEvent[] }>("/api/events"),
      ]);
      setPosts(feedData.posts); setConnections(connectionData.connections.filter((item) => item.status === "accepted").length); setNextEvent(eventData.events[0] || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your feed."); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const createPost = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError("");
    try { const data = await api<{ post: Post }>("/api/posts", { method: "POST", body: JSON.stringify({ body }) }); setPosts((items) => [data.post, ...items]); setBody(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish your post."); }
    finally { setPending(false); }
  };
  if (!user) return null;
  return <div className="feed-layout">
    <section className="feed-column">
      <header className="feed-heading"><div><p className="eyebrow">YOUR ZONE</p><h1>Good to see you, {user.name.split(" ")[0]}.</h1></div><Link href="/discover" className="desktop-only"><Plus size={17} /> Add people</Link></header>
      <form className="composer" onSubmit={createPost}><Avatar person={user} /><div><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required rows={3} placeholder={`What’s happening in your world, ${user.name.split(" ")[0]}?`} aria-label="Create a post" /><div className="composer-footer"><span>{body.length ? `${body.length}/2000` : "Share something real with your circle."}</span><Button type="submit" disabled={pending || !body.trim()}>{pending ? <Spinner label="Posting" /> : <>Post <ArrowRight size={17} /></>}</Button></div></div></form>
      {error && <ErrorBanner message={error} retry={load} />}
      {loading ? <div className="center-loading"><Spinner label="Loading feed" /></div> : posts.length ? <div className="post-list">{posts.map((post) => <PostCard key={post.id} post={post} onChange={(next) => setPosts((items) => items.map((item) => item.id === next.id ? next : item))} onShared={load} />)}</div> : <EmptyState icon={<Edit3 size={28} />} title="Your feed starts with you" description="Share an update above, or discover people and communities to bring more voices into your zone." action={<Link className="text-link" href="/discover">Discover your people <ArrowRight size={16} /></Link>} />}
    </section>
    <aside className="feed-rail">
      <section className="rail-profile"><div className="rail-profile-top"><Avatar person={user} size="lg" /><div><strong>{user.name}</strong><span>@{user.username}</span></div><Link href="/profile" className="icon-button" aria-label="Edit profile"><Edit3 size={17} /></Link></div><div className="profile-stats"><Link href="/connections"><strong>{connections}</strong><span>Connections</span></Link><div><strong>{posts.filter((post) => post.author.id === user.id).length}</strong><span>Posts in feed</span></div></div>{user.interests.length > 0 && <div className="interest-list">{user.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}</section>
      <section className="rail-section"><div className="rail-title"><h2>Your location</h2><MapPin size={18} /></div><p>{user.hasLocation ? `${user.city || "Location saved"}. Your exact coordinates are private.` : "Add your location to find people within your preferred distance."}</p><Link href={user.hasLocation ? "/settings" : "/discover"}>{user.hasLocation ? "Manage privacy" : "Enable discovery"}<ArrowRight size={15} /></Link></section>
      <section className="rail-section"><div className="rail-title"><h2>Next hangout</h2><CalendarDays size={18} /></div>{nextEvent ? <><strong>{nextEvent.title}</strong><p>{nextEvent.locationName}</p><Link href="/events">View event <ArrowRight size={15} /></Link></> : <><p>No upcoming events yet. Create a reason to meet up.</p><Link href="/events">Plan a hangout <ArrowRight size={15} /></Link></>}</section>
      <Link href="/communities" className="rail-community"><Users size={21} /><span><strong>Find your kind of room</strong><small>Join an interest-based community</small></span><ArrowRight size={17} /></Link>
    </aside>
  </div>;
}
