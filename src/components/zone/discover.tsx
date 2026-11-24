"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Compass, Flag, LocateFixed, MapPin, MessageCircle, Search, UserPlus } from "lucide-react";
import { api, Person } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner } from "./ui";

export function Discover() {
  const { user, setUser } = useZone();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [radius, setRadius] = useState(user?.discoveryRadius || 25);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try { const data = await api<{ people: Person[]; needsLocation: boolean }>(`/api/discovery?q=${encodeURIComponent(activeQuery)}&radius=${radius}`); setPeople(data.people); setNeedsLocation(data.needsLocation); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not discover people."); }
    finally { setLoading(false); }
  }, [activeQuery, radius]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const locate = () => {
    if (!navigator.geolocation) { setError("This browser does not support location. You can still search by name or interest."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const data = await api<{ user: NonNullable<typeof user> }>("/api/location", { method: "PUT", body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }) });
        setUser(data.user); setNeedsLocation(false); setNotice("Location saved. Only approximate distances are visible to others."); await load();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your location."); }
      finally { setLocating(false); }
    }, (cause) => { setError(cause.code === 1 ? "Location permission was declined. Search by name or interest instead." : "We couldn’t determine your location. Try again in a place with a stronger signal."); setLocating(false); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };
  const updateRadius = async (value: number) => {
    setRadius(value);
    if (user) try { const data = await api<{ user: NonNullable<typeof user> }>("/api/profile", { method: "PATCH", body: JSON.stringify({ discoveryRadius: value }) }); setUser(data.user); } catch { setNotice("Distance changed for this search, but your saved preference could not be updated."); }
  };
  const connect = async (person: Person) => {
    if (person.connectionStatus === "accepted") {
      const data = await api<{ conversationId: string }>("/api/conversations", { method: "POST", body: JSON.stringify({ recipientId: person.id }) }); router.push(`/messages?conversation=${data.conversationId}`); return;
    }
    try { const data = await api<{ status: string }>("/api/connections", { method: "POST", body: JSON.stringify({ recipientId: person.id }) }); setPeople((items) => items.map((item) => item.id === person.id ? { ...item, connectionStatus: data.status as Person["connectionStatus"], connectionDirection: "outgoing" } : item)); setNotice(data.status === "accepted" ? `You and ${person.name} are connected.` : `Connection request sent to ${person.name}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send the request."); }
  };
  const report = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return; setPending(true); const form = new FormData(event.currentTarget);
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ reportedUserId: selected.id, reason: form.get("reason"), details: form.get("details") }) }); setSelected(null); setNotice("Your confidential report was submitted for review."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit your report."); }
    finally { setPending(false); }
  };
  const block = async () => {
    if (!selected) return; setPending(true);
    try { await api("/api/blocks", { method: "POST", body: JSON.stringify({ userId: selected.id }) }); setPeople((items) => items.filter((item) => item.id !== selected.id)); setNotice(`${selected.name} has been blocked.`); setSelected(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not block this person."); }
    finally { setPending(false); }
  };
  return <div className="page-container">
    <PageHeader eyebrow="PEOPLE, NOT PROFILES" title="Find your kind of people" description="Search shared interests or discover who’s nearby. Exact locations always stay private." />
    <section className="discovery-controls">
      <form onSubmit={(event) => { event.preventDefault(); setLoading(true); setActiveQuery(query.trim()); }} className="discovery-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a name, username, city, or interest" aria-label="Search people" />{query && <button type="button" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear</button>}<Button type="submit">Search</Button></form>
      <div className="radius-control"><div><span><MapPin size={17} /> Within <strong>{radius} km</strong></span><small>Applies to nearby discovery</small></div><input type="range" min="1" max="200" value={radius} onChange={(event) => void updateRadius(Number(event.target.value))} aria-label="Discovery distance in kilometers" /></div>
    </section>
    {notice && <p className="success-banner" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></p>}
    {error && <ErrorBanner message={error} retry={load} />}
    {needsLocation && !activeQuery && <section className="location-gate"><div className="location-graphic"><LocateFixed size={32} /></div><div><h2>Put yourself on your own map</h2><p>Allow location access once to calculate nearby distances. Other members never receive your coordinates.</p></div><Button onClick={locate} disabled={locating}>{locating ? <Spinner label="Locating" /> : <><LocateFixed size={18} /> Use my location</>}</Button></section>}
    <div className="results-heading"><h2>{activeQuery ? `Results for “${activeQuery}”` : user?.hasLocation ? "People in your zone" : "Search beyond your location"}</h2><span>{loading ? "Searching…" : `${people.length} ${people.length === 1 ? "person" : "people"}`}</span></div>
    {loading ? <div className="center-loading"><Spinner label="Finding people" /></div> : people.length ? <div className="people-grid">{people.map((person) => <article className="person-card" key={person.id}>
      <div className="person-card-heading"><Avatar person={person} size="lg" /><div><h3>{person.name}</h3><p>@{person.username}</p></div><button className="icon-button ml-auto" onClick={() => setSelected(person)} aria-label={`Safety actions for ${person.name}`}><Flag size={17} /></button></div>
      <div className="person-meta">{person.city && <span><MapPin size={14} />{person.city}</span>}{person.distanceKm != null && <span>{person.distanceKm < 1 ? "Less than 1" : person.distanceKm} km away</span>}</div>
      {person.bio ? <p className="person-bio">{person.bio}</p> : <p className="person-bio muted-copy">Here to find their people on ZONE.</p>}
      {!!person.interests?.length && <div className="interest-list">{person.interests.slice(0, 4).map((interest) => <span className={person.sharedInterests?.includes(interest) ? "shared" : ""} key={interest}>{interest}</span>)}</div>}
      {!!person.sharedInterests?.length && <p className="shared-note">{person.sharedInterests.length} shared {person.sharedInterests.length === 1 ? "interest" : "interests"}</p>}
      <div className="person-actions">{person.connectionStatus === "pending" && person.connectionDirection === "incoming" ? <Link href="/connections" className="button button-primary">Respond <ArrowRight size={16} /></Link> : <Button onClick={() => void connect(person)} disabled={person.connectionStatus === "pending"} variant={person.connectionStatus === "accepted" ? "secondary" : "primary"}>{person.connectionStatus === "accepted" ? <><MessageCircle size={17} /> Message</> : person.connectionStatus === "pending" ? "Request sent" : <><UserPlus size={17} /> Connect</>}</Button>}</div>
    </article>)}</div> : !loading && !needsLocation && <EmptyState icon={<Compass size={28} />} title={activeQuery ? "No people matched that search" : "No one in this zone yet"} description={activeQuery ? "Try a broader name, city, or another interest." : "Try a wider distance or check back as your local community grows."} action={activeQuery ? <Button variant="secondary" onClick={() => { setQuery(""); setActiveQuery(""); }}>Clear search</Button> : <Button variant="secondary" onClick={() => void updateRadius(Math.min(200, radius + 25))}>Widen to {Math.min(200, radius + 25)} km</Button>} />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={`Safety options for ${selected?.name || "person"}`}><form onSubmit={report} className="modal-form"><Field label="Report reason"><select name="reason" defaultValue="harassment"><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="hate">Hate speech</option><option value="unsafe">Unsafe behavior</option><option value="impersonation">Impersonation</option><option value="other">Something else</option></select></Field><Field label="Details for the moderation team"><textarea name="details" rows={4} maxLength={1000} placeholder="What happened?" /></Field><Button type="submit" variant="danger" disabled={pending}>Submit confidential report</Button><div className="modal-divider" /><Button type="button" variant="secondary" onClick={block} disabled={pending}><Ban size={17} /> Block {selected?.name}</Button><p className="field-note">Blocking removes existing connections and prevents discovery and messaging between both accounts.</p></form></Modal>
  </div>;
}
