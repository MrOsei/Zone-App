import { Suspense } from "react";
import { AppShell } from "@/components/zone/app-shell";
import { Messages } from "@/components/zone/messages";
import { Spinner } from "@/components/zone/ui";

export const metadata = { title: "Messages" };
export default function MessagesPage() { return <AppShell><Suspense fallback={<div className="center-loading"><Spinner /></div>}><Messages /></Suspense></AppShell>; }
