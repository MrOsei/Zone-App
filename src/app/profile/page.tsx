import { AppShell } from "@/components/zone/app-shell";
import { Profile } from "@/components/zone/profile";

export const metadata = { title: "Your profile" };
export default function ProfilePage() { return <AppShell><Profile /></AppShell>; }
