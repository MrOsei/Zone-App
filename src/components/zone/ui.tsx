"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { Person } from "@/lib/zone";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex items-center gap-2.5 font-bold tracking-[-0.04em]">
    <span className="zone-mark" aria-hidden="true"><span /></span>
    {!compact && <span className="text-[25px]">ZONE</span>}
  </span>;
}

export function Avatar({ person, size = "md" }: { person: Pick<Person, "name" | "avatarUrl">; size?: "sm" | "md" | "lg" | "xl" }) {
  const initials = person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`avatar avatar-${size}`} aria-label={`${person.name}'s profile picture`}>
    {person.avatarUrl ? <Image src={person.avatarUrl} alt="" width={104} height={104} unoptimized /> : <span>{initials}</span>}
  </span>;
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-header">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>
    {action && <div className="shrink-0">{action}</div>}
  </header>;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state">{icon}<h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-banner" role="alert"><span>{message}</span>{retry && <button onClick={retry}>Try again <ArrowUpRight size={15} /></button>}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>("button,input,textarea,select,a[href]");
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input,textarea,button")?.focus());
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
      {children}
    </div>
  </div>, document.body);
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status"><span className="sr-only">{label}</span></span>;
}
