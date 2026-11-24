"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle, Send, Wifi, WifiOff } from "lucide-react";
import { api, Conversation, formatTime, Message } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Avatar, Button, EmptyState, ErrorBanner, Spinner } from "./ui";

export function Messages() {
  const { user } = useZone();
  const params = useSearchParams();
  const requested = params.get("conversation");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const selectedRef = useRef<string | null>(selectedId);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  const selected = conversations.find((item) => item.id === selectedId) || null;
  const loadConversations = useCallback(async () => {
    try { const data = await api<{ conversations: Conversation[] }>("/api/conversations"); setConversations(data.conversations); return data.conversations; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load conversations."); return []; }
    finally { setLoading(false); }
  }, []);
  const loadMessages = useCallback(async (conversationId: string) => {
    setChatLoading(true);
    try { const data = await api<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`); setMessages(data.messages); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load messages."); }
    finally { setChatLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadConversations().then(() => { if (requested) setSelectedId(requested); }); }, [loadConversations, requested]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadMessages(selectedId); else setMessages([]); }, [selectedId, loadMessages]);
  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | null = null, reconnect: ReturnType<typeof setTimeout> | undefined, closed = false;
    const connect = () => {
      socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      socket.onopen = () => setLive(true);
      socket.onclose = () => { setLive(false); if (!closed) reconnect = setTimeout(connect, 4000); };
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "message") {
          const incoming = payload.data as Message;
          if (incoming.conversationId === selectedRef.current) setMessages((items) => items.some((item) => item.id === incoming.id) ? items : [...items, incoming]);
          void loadConversations();
        }
      };
    };
    connect();
    return () => { closed = true; if (reconnect) clearTimeout(reconnect); socket?.close(); };
  }, [user, loadConversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages]);
  useEffect(() => { const timer = setInterval(() => { if (selectedRef.current) void loadMessages(selectedRef.current); }, 15000); return () => clearInterval(timer); }, [loadMessages]);
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedId) return;
    const form = event.currentTarget, body = String(new FormData(form).get("body") || "").trim();
    if (!body) return;
    setSending(true); setError("");
    try { const data = await api<{ message: Message }>(`/api/conversations/${selectedId}/messages`, { method: "POST", body: JSON.stringify({ body }) }); setMessages((items) => [...items, data.message]); form.reset(); void loadConversations(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Message could not be sent."); }
    finally { setSending(false); }
  };
  return <div className={`messages-page ${selectedId ? "chat-open" : ""}`}>
    <aside className="conversation-panel"><header><div><p className="eyebrow">PRIVATE & PERSISTENT</p><h1>Messages</h1></div><span className={`live-status ${live ? "online" : ""}`} title={live ? "Realtime connected" : "Reconnecting; 15-second refresh active"}>{live ? <Wifi size={15} /> : <WifiOff size={15} />}{live ? "Live" : "Syncing"}</span></header><div className="conversation-list">{loading ? <div className="center-loading"><Spinner /></div> : conversations.length ? conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={selectedId === conversation.id ? "active" : ""}><Avatar person={conversation.person} /><span><strong>{conversation.person.name}</strong><small>{conversation.lastMessage || "Start the conversation"}</small></span>{conversation.unread > 0 && <i aria-label={`${conversation.unread} unread messages`}>{conversation.unread}</i>}</button>) : <div className="conversation-empty"><MessageCircle size={25} /><p>Your conversations will live here.</p><span>Connect with someone first, then start a private chat.</span></div>}</div></aside>
    <section className="chat-panel">{selected ? <><header className="chat-header"><button className="icon-button chat-back" onClick={() => setSelectedId(null)} aria-label="Back to conversations"><ArrowLeft size={20} /></button><Avatar person={selected.person} /><div><strong>{selected.person.name}</strong><span>@{selected.person.username}</span></div></header><div className="message-history" aria-live="polite">{chatLoading && !messages.length ? <div className="center-loading"><Spinner /></div> : messages.length ? messages.map((message, index) => { const own = message.senderId === user?.id; const showDate = index === 0 || new Date(message.createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString(); return <div key={message.id}>{showDate && <div className="message-date">{new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(new Date(message.createdAt))}</div>}<div className={`message-bubble ${own ? "own" : ""}`}><p>{message.body}</p><time dateTime={message.createdAt}>{formatTime(message.createdAt)}{own && message.readAt ? " · Read" : ""}</time></div></div>; }) : <EmptyState icon={<MessageCircle size={26} />} title="Say something genuine" description={`This is the beginning of your conversation with ${selected.person.name}.`} />}<div ref={endRef} /></div><form className="message-composer" onSubmit={send}><textarea name="body" rows={1} maxLength={2000} required placeholder={`Message ${selected.person.name.split(" ")[0]}…`} aria-label="Message" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><Button type="submit" disabled={sending} aria-label="Send message"><Send size={19} /></Button></form></> : <div className="no-chat-selected"><MessageCircle size={32} /><h2>Your conversations, in one place</h2><p>Select a chat to read its history and continue the conversation.</p></div>}</section>
    {error && <div className="messages-error"><ErrorBanner message={error} retry={() => selectedId ? loadMessages(selectedId) : loadConversations().then(() => undefined)} /></div>}
  </div>;
}
