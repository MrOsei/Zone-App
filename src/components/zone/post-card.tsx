"use client";

import { FormEvent, useState } from "react";
import { Flag, Heart, MessageCircle, Send, Share2 } from "lucide-react";
import { api, Comment, Post, relativeTime } from "@/lib/zone";
import { Avatar, Button, Field, Modal } from "./ui";

export function PostCard({ post, onChange, onShared }: { post: Post; onChange?: (post: Post) => void; onShared?: () => void }) {
  const [current, setCurrent] = useState(post);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const update = (next: Post) => { setCurrent(next); onChange?.(next); };
  const like = async () => {
    try { const data = await api<{ liked: boolean; likeCount: number }>(`/api/posts/${current.id}/like`, { method: "POST", body: "{}" }); update({ ...current, ...data }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not like this post."); }
  };
  const toggleComments = async () => {
    const open = !commentsOpen; setCommentsOpen(open);
    if (!open || comments.length) return;
    setCommentsLoading(true);
    try { const data = await api<{ comments: Comment[] }>(`/api/posts/${current.id}/comments`); setComments(data.comments); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load comments."); }
    finally { setCommentsLoading(false); }
  };
  const comment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const input = new FormData(form).get("body");
    setPending(true);
    try {
      const data = await api<{ comment: Comment }>(`/api/posts/${current.id}/comments`, { method: "POST", body: JSON.stringify({ body: input }) });
      setComments((items) => [...items, data.comment]); update({ ...current, commentCount: current.commentCount + 1 }); form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add your comment."); }
    finally { setPending(false); }
  };
  const share = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const text = new FormData(event.currentTarget).get("body"); setPending(true);
    try { await api(`/api/posts/${current.id}/share`, { method: "POST", body: JSON.stringify({ body: text }) }); setShareOpen(false); setMessage("Post shared to your feed."); onShared?.(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not share this post."); }
    finally { setPending(false); }
  };
  const report = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true);
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ postId: current.id, reportedUserId: current.author.id, reason: data.get("reason"), details: data.get("details") }) }); setReportOpen(false); setMessage("Report submitted for review."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit your report."); }
    finally { setPending(false); }
  };
  return <article className="post-card">
    <header className="post-author"><Avatar person={current.author} /><div><strong>{current.author.name}</strong><span>@{current.author.username} · <time dateTime={current.createdAt}>{relativeTime(current.createdAt)}</time></span></div>{current.communityName && <span className="post-community">{current.communityName}</span>}<button className="icon-button ml-auto" onClick={() => setReportOpen(true)} aria-label={`Report post by ${current.author.name}`}><Flag size={17} /></button></header>
    {current.body && <p className="post-body">{current.body}</p>}
    {current.sharedPost && <div className="shared-post"><div><Avatar person={current.sharedPost.author} size="sm" /><strong>{current.sharedPost.author.name}</strong><span>@{current.sharedPost.author.username}</span></div><p>{current.sharedPost.body}</p></div>}
    <footer className="post-actions"><button onClick={like} className={current.liked ? "liked" : ""} aria-pressed={current.liked} aria-label={current.liked ? "Unlike post" : "Like post"}><Heart size={19} fill={current.liked ? "currentColor" : "none"} /><span>{current.likeCount || "Like"}</span></button><button onClick={toggleComments} aria-expanded={commentsOpen} aria-label={current.commentCount ? `${current.commentCount} comments` : "Comment"}><MessageCircle size={19} /><span>{current.commentCount || "Comment"}</span></button><button onClick={() => setShareOpen(true)}><Share2 size={19} /><span>Share</span></button></footer>
    {message && <p className="inline-notice" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss notification">×</button></p>}
    {commentsOpen && <section className="comments" aria-label="Comments">
      {commentsLoading ? <p className="muted-copy">Loading comments…</p> : comments.map((item) => <div className="comment" key={item.id}><Avatar person={item.author} size="sm" /><div><p><strong>{item.author.name}</strong> <time>{relativeTime(item.createdAt)}</time></p><span>{item.body}</span></div></div>)}
      {!commentsLoading && !comments.length && <p className="muted-copy">No comments yet. Start the conversation.</p>}
      <form onSubmit={comment} className="comment-form"><input name="body" required maxLength={1000} placeholder="Add a thoughtful comment…" aria-label="Comment" /><Button type="submit" disabled={pending} aria-label="Post comment"><Send size={17} /></Button></form>
    </section>}
    <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share with your zone"><form onSubmit={share} className="modal-form"><div className="share-source"><strong>{current.author.name}</strong><p>{current.body}</p></div><Field label="Add your perspective (optional)"><textarea name="body" maxLength={280} rows={4} placeholder="Why should your circle see this?" /></Field><Button type="submit" disabled={pending}>{pending ? "Sharing…" : "Share post"}<Share2 size={17} /></Button></form></Modal>
    <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this post"><form onSubmit={report} className="modal-form"><p className="muted-copy">Reports are confidential and stored for moderation review.</p><Field label="What’s wrong?"><select name="reason" required defaultValue="spam"><option value="spam">Spam or misleading</option><option value="harassment">Harassment</option><option value="hate">Hate speech</option><option value="unsafe">Unsafe content</option><option value="impersonation">Impersonation</option><option value="other">Something else</option></select></Field><Field label="Additional details (optional)"><textarea name="details" rows={4} maxLength={1000} /></Field><Button type="submit" variant="danger" disabled={pending}>{pending ? "Submitting…" : "Submit report"}</Button></form></Modal>
  </article>;
}
