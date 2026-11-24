"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, MapPin, Plus, Search, Star, Users } from "lucide-react";
import { api, formatDate, formatTime, ZoneEvent } from "@/lib/zone";
import { Button, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner } from "./ui";

export function Events() {
  const [events, setEvents] = useState<ZoneEvent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try { const data = await api<{ events: ZoneEvent[] }>("/api/events"); setEvents(data.events); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load events."); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => events.filter((event) => `${event.title} ${event.locationName} ${event.description}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt"))).toISOString();
    const endValue = String(form.get("endsAt") || "");
    try { const data = await api<{ event: ZoneEvent }>("/api/events", { method: "POST", body: JSON.stringify({ title: form.get("title"), description: form.get("description"), locationName: form.get("locationName"), startsAt, endsAt: endValue ? new Date(endValue).toISOString() : null }) }); setEvents((items) => [...items, data.event].sort((a, b) => a.startsAt.localeCompare(b.startsAt))); setCreateOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this event."); }
    finally { setPending(false); }
  };
  const rsvp = async (event: ZoneEvent, status: "going" | "interested" | "none") => {
    setPending(true);
    try { const data = await api<{ myStatus: ZoneEvent["myStatus"]; goingCount: number }>(`/api/events/${event.id}/rsvp`, { method: "POST", body: JSON.stringify({ status }) }); setEvents((items) => items.map((item) => item.id === event.id ? { ...item, ...data } : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update your RSVP."); }
    finally { setPending(false); }
  };
  return <div className="page-container"><PageHeader eyebrow="FROM ONLINE TO OUT THERE" title="Make plans. Meet up." description="Discover real-world hangouts or create something your zone will show up for." action={<Button onClick={() => setCreateOpen(true)} aria-label="Create event"><Plus size={18} /><span className="mobile-label-hidden">Create event</span></Button>} />
    <div className="event-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events or places" aria-label="Search events" />{query && <button onClick={() => setQuery("")}>Clear</button>}</div>
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="center-loading"><Spinner /></div> : filtered.length ? <div className="events-grid">{filtered.map((event) => { const date = new Date(event.startsAt); return <article className="event-card" key={event.id}><div className="event-date"><span>{new Intl.DateTimeFormat("en", { month: "short" }).format(date).toUpperCase()}</span><strong>{date.getDate()}</strong><small>{new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}</small></div><div className="event-main"><div className="event-heading"><div><h2>{event.title}</h2><p>Hosted by {event.creatorName}</p></div>{event.myStatus === "going" && <span className="going-badge"><Check size={14} /> Going</span>}</div><div className="event-meta"><span><CalendarDays size={16} />{formatDate(event.startsAt, { weekday: "long", month: "long", day: "numeric" })} at {formatTime(event.startsAt)}</span><span><MapPin size={16} />{event.locationName}</span><span><Users size={16} />{event.goingCount} going</span></div><p className="event-description">{event.description}</p><div className="event-actions"><Button variant={event.myStatus === "going" ? "secondary" : "primary"} disabled={pending} onClick={() => void rsvp(event, event.myStatus === "going" ? "none" : "going")}>{event.myStatus === "going" ? "Cancel RSVP" : "I’m going"}</Button><Button variant={event.myStatus === "interested" ? "secondary" : "ghost"} disabled={pending} onClick={() => void rsvp(event, event.myStatus === "interested" ? "none" : "interested")}><Star size={16} fill={event.myStatus === "interested" ? "currentColor" : "none"} />{event.myStatus === "interested" ? "Interested" : "Save interest"}</Button></div></div></article>; })}</div> : <EmptyState icon={<CalendarDays size={29} />} title={query ? "No hangouts matched" : "Nothing on the calendar yet"} description={query ? "Try another event name or place, or clear your search." : "Create the first hangout and give people a reason to step out together."} action={query ? <Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button> : <Button onClick={() => setCreateOpen(true)}><Plus size={17} /> Plan a hangout</Button>} />}
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a real-world hangout"><form onSubmit={create} className="modal-form"><Field label="Event name"><input name="title" required minLength={3} maxLength={100} placeholder="Saturday morning coastal walk" /></Field><Field label="Meeting place"><input name="locationName" required minLength={2} maxLength={160} placeholder="Cape Coast Castle entrance" /></Field><div className="form-two"><Field label="Starts"><input name="startsAt" type="datetime-local" required /></Field><Field label="Ends (optional)"><input name="endsAt" type="datetime-local" /></Field></div><Field label="What should people expect?"><textarea name="description" required minLength={10} maxLength={1000} rows={4} placeholder="An easy-paced walk open to everyone. Bring water and meet by the main entrance." /></Field><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Publish event"}</Button></form></Modal>
  </div>;
}
