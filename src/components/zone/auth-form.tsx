"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck } from "lucide-react";
import { api, User } from "@/lib/zone";
import { useZone } from "./zone-provider";
import { Button, Field, Logo, Spinner } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { setUser } = useZone();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = signup ? {
      name: form.get("name"), username: form.get("username"), email: form.get("email"), password: form.get("password"),
      city: form.get("city"), interests: String(form.get("interests") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    } : { email: form.get("email"), password: form.get("password") };
    try {
      const data = await api<{ user: User }>(`/api/auth/${signup ? "register" : "login"}`, { method: "POST", body: JSON.stringify(payload) });
      setUser(data.user); router.push("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to continue."); }
    finally { setPending(false); }
  };
  return <main className="auth-layout">
    <section className="auth-form-side">
      <div className="auth-top"><Link href="/" aria-label="ZONE home"><Logo /></Link><span>{signup ? "Already in the zone?" : "New to ZONE?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link></span></div>
      <div className="auth-form-wrap">
        <p className="eyebrow">{signup ? "YOUR PEOPLE ARE CLOSER THAN YOU THINK" : "WELCOME BACK"}</p>
        <h1>{signup ? "Start with who you are." : "Pick up where you left off."}</h1>
        <p className="auth-intro">{signup ? "Create your profile, choose your interests, and discover people who share your world." : "Sign in to your conversations, communities, and local circle."}</p>
        <form onSubmit={submit} className="auth-form">
          {signup && <div className="form-two"><Field label="Full name"><input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Ama Mensah" /></Field><Field label="Username"><div className="input-prefix"><span>@</span><input name="username" autoComplete="username" required pattern="[a-z0-9_]{3,24}" placeholder="ama_m" /></div></Field></div>}
          <Field label="Email address"><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></Field>
          <Field label="Password" hint={signup ? "At least 8 characters." : undefined}><div className="password-input"><input name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : 1} maxLength={128} placeholder="••••••••" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field>
          {signup && <><Field label="Home base"><div className="input-prefix"><MapPin size={17} /><input name="city" maxLength={80} placeholder="Cape Coast, Ghana" /></div></Field><Field label="Interests" hint="Separate up to 8 interests with commas."><input name="interests" placeholder="Live music, hiking, design" /></Field></>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? <Spinner label="Submitting" /> : <>{signup ? "Create my ZONE" : "Sign in"}<ArrowRight size={18} /></>}</Button>
        </form>
        <p className="auth-legal">By continuing, you agree to use ZONE respectfully and follow our <Link href="/terms">community terms</Link> and <Link href="/privacy">privacy policy</Link>.</p>
      </div>
    </section>
    <aside className="auth-art" aria-label="ZONE privacy promise">
      <div className="constellation" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><i className="node node-a" /><i className="node node-b" /><i className="node node-c" /><i className="node node-d" /><span className="art-logo"><Logo compact /></span></div>
      <div className="auth-art-copy"><ShieldCheck size={25} /><h2>Nearby, without being exposed.</h2><p>Your exact coordinates stay private. You choose whether to share distance and who can discover your profile.</p></div>
    </aside>
  </main>;
}
