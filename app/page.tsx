"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import type { ReadinessCheckIn, WorkoutSession } from "@/lib/fitness-data-model";

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

function getStreak(dates: string[]) {
  const uniqueDates = [...new Set(dates)].sort().reverse();
  if (uniqueDates.length === 0) return 0;
  let streak = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00Z`);
    const current = new Date(`${uniqueDates[index]}T00:00:00Z`);
    const daysBetween = Math.round((previous.getTime() - current.getTime()) / 86400000);
    if (daysBetween !== 1) break;
    streak += 1;
  }
  return streak;
}

type DashboardMetrics = {
  readiness: number | null;
  weekSessions: number;
  streak: number;
  todaySets: number;
};

export default function Home() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    readiness: null,
    weekSessions: 0,
    streak: 0,
    todaySets: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    async function loadMetrics() {
      if (!user) return;
      try {
        const [readinessSnap, sessionsSnap] = await Promise.all([
          getDocs(query(collection(db, "readinessCheckIns"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", user.uid))),
        ]);
        const readiness = readinessSnap.docs.map((doc) => doc.data() as ReadinessCheckIn);
        const sessions = sessionsSnap.docs.map((doc) => doc.data() as WorkoutSession);
        const today = todayId();
        const weekStart = new Date();
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        const weekStartId = weekStart.toISOString().slice(0, 10);
        const sessionDates = sessions.map((session) => session.date);
        const todaySession = sessions.find((session) => session.date === today);
        const latestReadiness = [...readiness].sort((a, b) => b.date.localeCompare(a.date))[0];
        setMetrics({
          readiness: latestReadiness?.readinessScore ?? null,
          weekSessions: sessions.filter((session) => session.date >= weekStartId && session.date <= today).length,
          streak: getStreak(sessionDates),
          todaySets: todaySession?.sets?.length ?? 0,
        });
      } catch (error) {
        console.error("Couldn't load dashboard metrics", error);
      }
    }
    loadMetrics();
  }, [user]);

  const readinessLabel = metrics.readiness === null ? "No check-in yet" : metrics.readiness >= 70 ? "Good to go" : "Take it lighter";
  const readinessWidth = metrics.readiness ?? 0;
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-12 pt-8 lg:px-8 lg:pt-12">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative z-[1] max-w-2xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{dateLabel}</p>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
            Train with your body, not against it.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            Overtone adapts your training around readiness, recovery, and the work you want to do today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/log" className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)] transition-transform hover:-translate-y-0.5">
              Start today&apos;s session <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link href="/checkin" className="rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-raised)]">
              Check readiness
            </Link>
          </div>
        </div>
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[28px] border-[var(--accent)]/10 sm:h-96 sm:w-96" />
        <div className="absolute bottom-[-4.5rem] right-20 h-44 w-44 rounded-full bg-[var(--warm)]/10 blur-2xl" />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Readiness</p>
          <div className="mt-4 flex items-end justify-between"><strong className="text-4xl tracking-[-0.05em]">{metrics.readiness ?? "--"}</strong><span className="mb-1 text-right text-sm text-[var(--accent)]">{readinessLabel}</span></div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${readinessWidth}%` }} /></div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">This week</p>
          <div className="mt-4 flex items-end justify-between"><strong className="text-4xl tracking-[-0.05em]">{metrics.weekSessions} <span className="text-xl font-normal text-[var(--muted)]">/ 4</span></strong><span className="mb-1 text-sm text-[var(--warm)]">sessions</span></div>
          <div className="mt-5 flex gap-1.5">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < metrics.weekSessions ? "bg-[var(--warm)]" : "bg-[var(--line)]"}`} />)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Streak</p>
          <div className="mt-4 flex items-end justify-between"><strong className="text-4xl tracking-[-0.05em]">{metrics.streak || "--"}</strong><span className="mb-1 text-sm text-[var(--accent)]">{metrics.streak === 1 ? "day" : "days"}</span></div>
          <p className="mt-5 text-xs text-[var(--muted)]">Consecutive training days</p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Your plan</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Built for today</h2></div><Link href="/trends" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">View progress -&gt;</Link></div>
          <Link href="/log" className="group block rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)]">
            <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--warm)]">Upper body · 45 min</span><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Strength &amp; control</h3><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">A focused push and pull session, tuned to your current recovery level.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-lg text-[var(--accent-ink)] transition-transform group-hover:translate-x-1">-&gt;</span></div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">{metrics.todaySets} sets logged</span><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">Moderate effort</span><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">Gym access</span></div>
          </Link>
        </div>
        <div>
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Quick actions</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Keep your rhythm</h2></div>
          <div className="space-y-3">
            {[{ href: "/meals", label: "Log a meal", detail: "Fuel your next session", icon: "01" }, { href: "/wellness", label: "Daily wellness", detail: "Sleep, stress & energy", icon: "02" }, { href: "/fatigue", label: "Review recovery", detail: "Spot patterns early", icon: "03" }].map((item) => <Link href={item.href} key={item.href} className="flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-raised)] text-xs font-semibold text-[var(--accent)]">{item.icon}</span><span className="flex-1"><strong className="block text-sm font-semibold">{item.label}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.detail}</span></span><span className="text-[var(--muted)]">-&gt;</span></Link>)}
          </div>
        </div>
      </section>
      
      
      
      
      
      
      </main>
  );
}
