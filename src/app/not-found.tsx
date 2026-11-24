import Link from "next/link";
import { Logo } from "@/components/zone/ui";

export default function NotFound() {
  return <main className="not-found"><div><Logo /><h1>This isn’t in your zone.</h1><p>The page may have moved, or the link is no longer available.</p><Link className="button button-primary" href="/">Return home</Link></div></main>;
}
