"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, UsersRound } from "lucide-react";
import { api, Community, Post } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, EmptyState, ErrorBanner, Field, Modal, PageHeader, Spinner } from "./ui";
import { PostCard } from "./post-card";

export function Communities() {
  const { user } = useZone();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const selected = communities.find((item) => item.id === selectedId) || null;
  const load = useCallback(async () => {
    try { const data = await api<{ communities: Community[] }>("/api/communities"); setCommunities(data.communities); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load communities."); }
    finally { setLoading(false); }
  }, []);
  const loadPosts = useCallback(async () => {
    if (!selectedId) { setPosts([]); return; }
    try { const data = await api<{ posts: Post[] }>(`/api/posts?communityId=${selectedId}`); setPosts(data.posts); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load community posts."); }
  }, [selectedId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadPosts(); }, [loadPosts]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); const form = new FormData(event.currentTarget);
    try { const data = await api<{ community: Community }>("/api/communities", { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description") }) }); setCommunities((items) => [data.community, ...items]); setSelectedId(data.community.id); setCreateOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this community."); }
    finally { setPending(false); }
  };
  const toggleMembership = async (community: Community) => {
    setPending(true);
    try { await api(`/api/communities/${community.id}/${community.joined ? "leave" : "join"}`, { method: "POST", body: "{}" }); setCommunities((items) => items.map((item) => item.id === community.id ? { ...item, joined: !item.joined, memberCount: item.memberCount + (item.joined ? -1 : 1) } : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update membership."); }
    finally { setPending(false); }
  };
  const post = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedId) return; setPending(true);
    try { const data = await api<{ post: Post }>("/api/posts", { method: "POST", body: JSON.stringify({ body, communityId: selectedId }) }); setPosts((items) => [data.post, ...items]); setBody(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish your post."); }
    finally { setPending(false); }
  };
  return <div className="page-container"><PageHeader eyebrow="BELONG TO SOMETHING" title="Communities" description="Interest-led rooms for conversations that matter to your circle." action={<Button onClick={() => setCreateOpen(true)} aria-label="Create community"><Plus size={18} /> <span className="mobile-label-hidden">Create community</span></Button>} />
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="center-loading"><Spinner /></div> : <div className={`community-layout ${selected ? "community-selected" : ""}`}>
      <aside className="community-directory"><div className="directory-heading"><h2>Explore rooms</h2><span>{communities.length}</span></div>{communities.length ? communities.map((community) => <button key={community.id} className={selectedId === community.id ? "active" : ""} onClick={() => setSelectedId(community.id)}><span className="community-monogram">{community.name.slice(0, 2).toUpperCase()}</span><span><strong>{community.name}</strong><small>{community.memberCount} {community.memberCount === 1 ? "member" : "members"}</small></span><ArrowRight size={16} /></button>) : <p className="muted-copy">No communities yet. Create the first room around something you care about.</p>}</aside>
      <section className="community-content">{selected ? <><button className="community-back" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> All communities</button><header className="community-hero"><div><span className="community-monogram large">{selected.name.slice(0, 2).toUpperCase()}</span><div><h2>{selected.name}</h2><p>{selected.description}</p><span>Hosted by {selected.ownerName} · {selected.memberCount} {selected.memberCount === 1 ? "member" : "members"}</span></div></div>{selected.ownerId !== user?.id && <Button variant={selected.joined ? "secondary" : "primary"} disabled={pending} onClick={() => void toggleMembership(selected)}>{selected.joined ? "Leave community" : "Join community"}</Button>}</header>
        {selected.joined && user && <form onSubmit={post} className="community-composer"><Avatar person={user} /><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={2000} required placeholder={`Share with ${selected.name}…`} aria-label="Community post" /><Button type="submit" disabled={pending || !body.trim()}>Post <ArrowRight size={16} /></Button></form>}
        {!selected.joined && <p className="join-notice">This room’s posts are public to members. Join to contribute.</p>}
        {posts.length ? <div className="post-list">{posts.map((item) => <PostCard key={item.id} post={item} onChange={(next) => setPosts((items) => items.map((postItem) => postItem.id === next.id ? next : postItem))} onShared={loadPosts} />)}</div> : <EmptyState icon={<UsersRound size={27} />} title="Open the conversation" description={selected.joined ? "You’re a member. Share the first post and set the tone for this room." : "No one has posted yet. Join the room to start the first conversation."} />}
      </> : <div className="community-welcome"><UsersRound size={35} /><h2>A room for every interest</h2><p>Select a community to read its story, join the room, and take part in its feed.</p>{!communities.length && <Button onClick={() => setCreateOpen(true)}><Plus size={17} /> Create the first community</Button>}</div>}</section>
    </div>}
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a community"><form onSubmit={create} className="modal-form"><Field label="Community name"><input name="name" required minLength={3} maxLength={60} placeholder="Cape Coast Runners" /></Field><Field label="What brings this room together?" hint="Be specific so the right people can find their place."><textarea name="description" required minLength={10} maxLength={500} rows={5} placeholder="A welcoming group for local runners planning relaxed weekly routes." /></Field><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create community"}<ArrowRight size={17} /></Button></form></Modal>
  </div>;
}
