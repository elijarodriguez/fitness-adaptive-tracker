"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  { href: "/", label: "Today" },
  { href: "/checkin", label: "Check-in" },
  { href: "/log", label: "Train" },
  { href: "/meals", label: "Fuel" },
  { href: "/trends", label: "Review" },
];

const MOBILE_ITEMS = [
  { href: "/", label: "Today" },
  { href: "/log", label: "Train" },
  { href: "/meals", label: "Fuel" },
  { href: "/trends", label: "Review" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-10 border-b border-[var(--line)] bg-[#0d1110]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-5 sm:px-5 sm:py-4 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-[0.16em] text-[var(--foreground)]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-xs font-black text-[var(--accent-ink)]">O</span>
          OVERTONE
        </Link>
        <div className="hidden max-w-full gap-1 overflow-x-auto pb-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={`Open ${item.label}`}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/fatigue" title="Open fatigue overlay" className={`rounded-lg px-3 py-2 text-xs font-medium ${pathname.startsWith("/fatigue") ? "bg-[var(--surface-raised)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Fatigue</Link>
          <Link href="/account" title="Open account" className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] sm:px-3">
            {user ? "Account" : "Sign in"}
          </Link>
        </div>
        <span className="shrink-0 text-xs text-[var(--muted)] md:hidden">{user ? "Ready" : "Guest"}</span>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[#0d1110]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        {moreOpen && <div className="absolute bottom-full right-2 mb-2 grid min-w-36 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl"><Link href="/fatigue" onClick={() => setMoreOpen(false)} className="rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]">Fatigue</Link><Link href="/account" onClick={() => setMoreOpen(false)} className="rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]">{user ? "Account" : "Sign in"}</Link></div>}
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`grid min-h-11 place-items-center rounded-lg text-[11px] font-medium ${active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--muted)]"}`}>{item.label}</Link>;
          })}
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={`grid min-h-11 place-items-center rounded-lg text-[11px] font-medium ${moreOpen || pathname.startsWith("/fatigue") || pathname.startsWith("/account") ? "bg-[var(--surface-raised)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}>More</button>
        </div>
      </div>
    </nav>
  );
}
