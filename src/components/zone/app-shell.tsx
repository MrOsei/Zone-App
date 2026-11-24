"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell, CalendarDays, Compass, Home, LogOut, MessageCircle, Settings, Users, UsersRound } from "lucide-react";
import { useZone } from "./zone-provider";
import { Avatar, Logo, Spinner } from "./ui";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/communities", label: "Communities", icon: UsersRound },
  { href: "/events", label: "Events", icon: CalendarDays },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useZone();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  if (loading || !user) return <main className="grid min-h-dvh place-items-center"><Spinner label="Loading your zone" /></main>;
  const signOut = async () => { await logout(); router.push("/"); };
  return <div className="app-frame">
    <aside className="desktop-sidebar">
      <Link href="/" aria-label="ZONE home" className="sidebar-logo"><Logo /></Link>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={21} strokeWidth={pathname === href ? 2.3 : 1.8} /><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-secondary">
        <Link href="/notifications" className={pathname === "/notifications" ? "active" : ""}><Bell size={21} /><span>Notifications</span></Link>
        <Link href="/settings" className={pathname === "/settings" ? "active" : ""}><Settings size={21} /><span>Settings & privacy</span></Link>
      </div>
      <div className="sidebar-profile">
        <Link href="/profile"><Avatar person={user} /><span><strong>{user.name}</strong><small>@{user.username}</small></span></Link>
        <button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </aside>
    <header className="mobile-app-header"><Link href="/" aria-label="ZONE home"><Logo /></Link><div><Link href="/notifications" className="icon-button" aria-label="Notifications"><Bell size={21} /></Link><Link href="/profile" aria-label="Your profile"><Avatar person={user} size="sm" /></Link></div></header>
    <main className="app-main">{children}</main>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-label={label}><Icon size={22} strokeWidth={pathname === href ? 2.4 : 1.8} /><span>{label === "Communities" ? "Groups" : label}</span></Link>)}
    </nav>
  </div>;
}

export function AuthPage({ children }: { children: React.ReactNode }) {
  const { user, loading } = useZone();
  const router = useRouter();
  useEffect(() => { if (!loading && user) router.replace("/"); }, [loading, user, router]);
  if (loading || user) return <main className="grid min-h-dvh place-items-center"><Spinner /></main>;
  return <>{children}</>;
}

export function UsersIcon() { return <Users />; }
