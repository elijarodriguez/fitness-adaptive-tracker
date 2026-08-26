"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  { href: "/log", label: "Train" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-10 border-b border-[var(--line)] bg-[#0d1110]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-5 sm:px-5 sm:py-4 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-[0.16em] text-[var(--foreground)]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-xs font-black text-[var(--accent-ink)]">O</span>
          OVERTONE
        </Link>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
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
        <Link href="/account" title="Open account" className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] sm:px-3">
          {user ? "Account" : "Sign in"}
        </Link>
      </div>
    </nav>
  );
}
