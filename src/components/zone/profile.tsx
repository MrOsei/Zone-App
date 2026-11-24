"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, MapPin, Settings } from "lucide-react";
import { api, Post, User } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, ErrorBanner, Field, PageHeader, Spinner } from "./ui";
import { PostCard } from "./post-card";

export function Profile() {
  const { user, setUser } = useZone();
  const fileRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [city, setCity] = useState(user?.city || "");
  const [interests, setInterests] = useState(user?.interests.join(", ") || "");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api<{ posts: Post[] }>("/api/posts").then((data) => setPosts(data.posts)).catch((cause) => setError(cause.message)); }, []);
  if (!user) return null;
  const save = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    try { const data = await api<{ user: User }>("/api/profile", { method: "PATCH", body: JSON.stringify({ name, bio, city, interests: interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8) }) }); setUser(data.user); setNotice("Profile updated."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your profile."); }
    finally { setPending(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Choose an image under 2 MB."); return; }
    setPending(true); const form = new FormData(); form.append("avatar", file);
    try { const data = await api<{ user: User }>("/api/profile/avatar", { method: "POST", body: form }); setUser(data.user); setNotice("Profile picture updated."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not upload your picture."); }
    finally { setPending(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const ownPosts = posts.filter((post) => post.author.id === user.id);
  return <div className="page-container narrow-page"><PageHeader eyebrow="YOUR CORNER OF ZONE" title="Profile" description="Give people something genuine to connect with." action={<Link href="/settings" className="button button-secondary" aria-label="Settings"><Settings size={17} /><span className="mobile-label-hidden">Settings</span></Link>} />
    <section className="profile-cover"><div className="profile-avatar-wrap"><Avatar person={user} size="xl" /><button onClick={() => fileRef.current?.click()} disabled={pending} aria-label="Change profile picture"><Camera size={18} /></button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="sr-only" /></div><div className="profile-identity"><h2>{user.name}</h2><p>@{user.username}</p><span><MapPin size={14} />{user.city || "Add your home base"}</span></div></section>
    {notice && <p className="success-banner" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></p>}{error && <ErrorBanner message={error} />}
    <form onSubmit={save} className="settings-form"><div className="form-two"><Field label="Full name"><input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={60} /></Field><Field label="Home base"><input value={city} onChange={(event) => setCity(event.target.value)} maxLength={80} placeholder="City, country" /></Field></div><Field label="About you" hint={`${bio.length}/280 characters`}><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} placeholder="What are you into, and what kind of people do you hope to meet?" /></Field><Field label="Interests" hint="Comma-separated, up to 8. These power shared-interest discovery."><input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Photography, books, football" /></Field><Button type="submit" disabled={pending}>{pending ? <Spinner label="Saving" /> : "Save profile"}</Button></form>
    <section className="profile-posts"><div className="section-heading"><h2>Your posts</h2><span>{ownPosts.length}</span></div>{ownPosts.length ? ownPosts.map((post) => <PostCard key={post.id} post={post} onChange={(next) => setPosts((items) => items.map((item) => item.id === next.id ? next : item))} />) : <p className="muted-copy">Your published posts and shares will appear here.</p>}</section>
  </div>;
}
