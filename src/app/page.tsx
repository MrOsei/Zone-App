"use client";

import { AppShell } from "@/components/zone/app-shell";
import { Feed } from "@/components/zone/feed";
import { Landing } from "@/components/zone/landing";
import { Spinner } from "@/components/zone/ui";
import { useZone } from "@/components/zone/zone-provider";

export default function HomePage() {
  const { user, loading } = useZone();
  if (loading) return <main className="grid min-h-dvh place-items-center"><Spinner label="Opening ZONE" /></main>;
  return user ? <AppShell><Feed /></AppShell> : <Landing />;
}
