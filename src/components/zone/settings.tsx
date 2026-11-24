"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, LocateFixed, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { api, Person, User } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, ErrorBanner, PageHeader, Spinner } from "./ui";

export function Settings() {
  const { user, setUser, logout } = useZone();
  const router = useRouter();
  const [radius, setRadius] = useState(user?.discoveryRadius || 25);
  const [locationVisible, setLocationVisible] = useState(user?.locationVisible ?? true);
  const [profileVisible, setProfileVisible] = useState(user?.profileVisible ?? true);
  const [showDistance, setShowDistance] = useState(user?.showDistance ?? true);
  const [blocks, setBlocks] = useState<Person[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const loadBlocks = useCallback(async () => { try { const data = await api<{ blocks: Person[] }>("/api/blocks"); setBlocks(data.blocks); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load blocked accounts."); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadBlocks(); }, [loadBlocks]);
  if (!user) return null;
  const save = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setNotice(""); setError("");
    try { const data = await api<{ user: User }>("/api/settings", { method: "PATCH", body: JSON.stringify({ discoveryRadius: radius, locationVisible, profileVisible, showDistance }) }); setUser(data.user); setNotice("Privacy preferences saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setPending(false); }
  };
  const clearLocation = async () => {
    setPending(true);
    try { const data = await api<{ user: User }>("/api/location", { method: "DELETE" }); setUser(data.user); setNotice("Saved location removed from ZONE."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove your location."); }
    finally { setPending(false); }
  };
  const unblock = async (person: Person) => {
    try { await api("/api/blocks", { method: "DELETE", body: JSON.stringify({ userId: person.id }) }); setBlocks((items) => items.filter((item) => item.id !== person.id)); setNotice(`${person.name} has been unblocked.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not unblock this person."); }
  };
  return <div className="page-container narrow-page"><PageHeader eyebrow="YOUR DATA, YOUR CHOICE" title="Settings & privacy" description="Control how you appear, what you share, and who can reach you." />
    {notice && <p className="success-banner" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></p>}{error && <ErrorBanner message={error} />}
    <form onSubmit={save} className="settings-form"><section className="settings-section"><div className="settings-section-title"><ShieldCheck size={21} /><div><h2>Discovery & privacy</h2><p>Changes apply to future discovery requests immediately.</p></div></div><label className="range-setting"><span><strong>Maximum discovery distance</strong><small>People outside this distance won’t appear in nearby results.</small></span><b>{radius} km</b><input type="range" min="1" max="200" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label><Toggle checked={profileVisible} onChange={setProfileVisible} title="Visible in people search" description="Allow other members to find your public profile by name or interest." /><Toggle checked={locationVisible} onChange={setLocationVisible} title="Included in nearby discovery" description="Use your saved coordinates to calculate proximity without sharing them." /><Toggle checked={showDistance} onChange={setShowDistance} title="Show approximate distance" description="Let others see a rounded distance instead of only your city." /><Button type="submit" disabled={pending}>{pending ? <Spinner label="Saving" /> : "Save preferences"}</Button></section></form>
    <section className="settings-section"><div className="settings-section-title"><LocateFixed size={21} /><div><h2>Saved location</h2><p>{user.hasLocation ? "Coordinates are stored privately and never returned by discovery APIs." : "No coordinates are currently saved."}</p></div></div><Button variant="secondary" onClick={clearLocation} disabled={!user.hasLocation || pending}><Trash2 size={17} /> Remove saved location</Button></section>
    <section className="settings-section"><div className="settings-section-title"><Ban size={21} /><div><h2>Blocked accounts</h2><p>Blocked people cannot discover, connect, or message you.</p></div></div>{blocks.length ? <div className="blocked-list">{blocks.map((person) => <div key={person.id}><Avatar person={person} /><span><strong>{person.name}</strong><small>@{person.username}</small></span><Button variant="secondary" onClick={() => void unblock(person)}>Unblock</Button></div>)}</div> : <p className="muted-copy">You haven’t blocked anyone.</p>}</section>
    <section className="settings-section account-section"><div><h2>Account session</h2><p>Signed in as {user.email}</p></div><Button variant="secondary" onClick={async () => { await logout(); router.push("/"); }}><LogOut size={17} /> Sign out</Button></section>
  </div>;
}

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="toggle-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" /><i aria-hidden="true"><span /></i></label>;
}
