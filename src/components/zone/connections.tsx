"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, UserPlus, Users, X } from "lucide-react";
import { api, Person } from "@/lib/zone";
import { Avatar, Button, EmptyState, ErrorBanner, PageHeader, Spinner } from "./ui";

type Connection = { id: string; status: "pending" | "accepted" | "rejected"; direction: "incoming" | "outgoing"; person: Person; updatedAt: string };

export function Connections() {
  const router = useRouter();
  const [items, setItems] = useState<Connection[]>([]);
  const [tab, setTab] = useState<"requests" | "connections" | "sent">("requests");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const data = await api<{ connections: Connection[] }>("/api/connections"); setItems(data.connections); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load connections."); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const update = async (item: Connection, action: "accept" | "reject" | "cancel") => {
    setPendingId(item.id);
    try { await api("/api/connections", { method: "PATCH", body: JSON.stringify({ id: item.id, action }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this request."); }
    finally { setPendingId(""); }
  };
  const message = async (item: Connection) => {
    setPendingId(item.id);
    try { const data = await api<{ conversationId: string }>("/api/conversations", { method: "POST", body: JSON.stringify({ recipientId: item.person.id }) }); router.push(`/messages?conversation=${data.conversationId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open this conversation."); }
    finally { setPendingId(""); }
  };
  const incoming = items.filter((item) => item.status === "pending" && item.direction === "incoming");
  const accepted = items.filter((item) => item.status === "accepted");
  const sent = items.filter((item) => item.status === "pending" && item.direction === "outgoing");
  const visible = tab === "requests" ? incoming : tab === "connections" ? accepted : sent;
  return <div className="page-container narrow-page"><PageHeader eyebrow="YOUR CIRCLE" title="Connections" description="Build trust first. One-to-one messaging opens when both people connect." />
    <div className="segmented-tabs" role="tablist" aria-label="Connection views"><button role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Requests <span>{incoming.length}</span></button><button role="tab" aria-selected={tab === "connections"} className={tab === "connections" ? "active" : ""} onClick={() => setTab("connections")}>Connections <span>{accepted.length}</span></button><button role="tab" aria-selected={tab === "sent"} className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>Sent <span>{sent.length}</span></button></div>
    {error && <ErrorBanner message={error} retry={load} />}
    {loading ? <div className="center-loading"><Spinner /></div> : visible.length ? <div className="connection-list">{visible.map((item) => <article className="connection-row" key={item.id}><Avatar person={item.person} size="lg" /><div className="connection-person"><h2>{item.person.name}</h2><p>@{item.person.username}</p></div><div className="connection-actions">{tab === "requests" && <><Button onClick={() => void update(item, "accept")} disabled={pendingId === item.id}><Check size={17} /> Accept</Button><Button variant="secondary" onClick={() => void update(item, "reject")} disabled={pendingId === item.id}><X size={17} /> Decline</Button></>}{tab === "connections" && <Button variant="secondary" onClick={() => void message(item)} disabled={pendingId === item.id}><MessageCircle size={17} /> Message</Button>}{tab === "sent" && <Button variant="secondary" onClick={() => void update(item, "cancel")} disabled={pendingId === item.id}>Cancel request</Button>}</div></article>)}</div> : <EmptyState icon={tab === "connections" ? <Users size={28} /> : <UserPlus size={28} />} title={tab === "requests" ? "No pending requests" : tab === "connections" ? "Your circle is ready to grow" : "No sent requests"} description={tab === "requests" ? "When someone wants to connect, their request will appear here." : tab === "connections" ? "Discover people nearby or through shared interests and send a request." : "Requests you send will appear here until the other person responds."} />}
  </div>;
}
