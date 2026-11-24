import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { Logo } from "./ui";

export function Landing() {
  return <main className="landing">
    <header className="landing-header"><Link href="/" aria-label="ZONE home"><Logo /></Link><nav aria-label="Welcome navigation"><Link href="/login">Sign in</Link><Link className="landing-join" href="/signup">Join ZONE <ArrowRight size={16} /></Link></nav></header>
    <section className="landing-hero">
      <div className="landing-copy"><p className="eyebrow">YOUR CITY. YOUR INTERESTS. YOUR PEOPLE.</p><h1>Life is better<br />in your <em>zone.</em></h1><p>Meet people nearby who get what you’re into. Build your circle, find your next hangout, and turn shared interests into real connection.</p><div className="landing-actions"><Link href="/signup">Find your people <ArrowRight size={19} /></Link><Link href="/login">I already have an account</Link></div><span className="landing-privacy"><ShieldCheck size={17} /> Your precise location is never shared.</span></div>
      <div className="landing-scene" aria-label="A network built around shared interests">
        <div className="scene-rings" aria-hidden="true"><span /><span /><span /><i /><i /><i /></div>
        <div className="scene-center"><Logo compact /><strong>Your zone</strong><span>Made by you</span></div>
        <div className="scene-label scene-one"><UsersRound size={20} /><span><strong>Shared interests</strong><small>Start with something in common</small></span></div>
        <div className="scene-label scene-two"><CalendarDays size={20} /><span><strong>Local happenings</strong><small>Make plans beyond the screen</small></span></div>
        <div className="scene-label scene-three"><MessageCircle size={20} /><span><strong>Real conversations</strong><small>Private, persistent, and live</small></span></div>
      </div>
    </section>
    <section className="landing-strip"><div><MapPin size={22} /><span><strong>Discovery with boundaries</strong><small>You control distance, visibility, and access.</small></span></div><p>Not another numbers game. A place to belong.</p></section>
  </main>;
}
