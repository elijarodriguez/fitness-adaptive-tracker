"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import type { MuscleGroup, WorkoutSession } from "@/lib/fitness-data-model";

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
  weekSessions: number;
  streak: number;
  todaySets: number;
  readinessScore: number | null;
  hasRpe: boolean;
  hasFuel: boolean;
  fatigueSignal: boolean;
  program: string | null;
  muscleGroupSets: Partial<Record<MuscleGroup, number>>;
};

export default function Home() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    weekSessions: 0,
    streak: 0,
    todaySets: 0,
    readinessScore: null,
    hasRpe: false,
    hasFuel: false,
    fatigueSignal: false,
    program: null,
    muscleGroupSets: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    async function loadMetrics() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [sessionsSnap, readinessSnap, rpeSnap, mealsSnap, exercisesSnap] = await Promise.all([
          getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "readinessCheckIns"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "sessionRPEs"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "mealLogs"), where("ownerId", "==", user.uid))),
          getDocs(collection(db, "exercises")),
        ]);
        const sessions = sessionsSnap.docs.map((doc) => doc.data() as WorkoutSession);
        const muscleByExercise = new Map(exercisesSnap.docs.map((doc) => [doc.id, (doc.data() as { muscleGroup?: MuscleGroup }).muscleGroup]));
        const today = todayId();
        const weekStart = new Date();
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        const weekStartId = weekStart.toISOString().slice(0, 10);
        const sessionDates = sessions.map((session) => session.date);
        const todaySession = sessions.find((session) => session.date === today);
        const readiness = readinessSnap.docs.map((doc) => doc.data() as { date: string; readinessScore: number }).sort((a, b) => b.date.localeCompare(a.date));
        const todayReadiness = readiness.find((item) => item.date === today)?.readinessScore ?? null;
        const recentReadiness = readiness.slice(0, 3);
        const fatigueSignal = recentReadiness.length >= 2 && recentReadiness.every((item) => item.readinessScore < 50);
        const muscleGroupSets: Partial<Record<MuscleGroup, number>> = {};
        for (const set of todaySession?.sets ?? []) {
          const group = muscleByExercise.get(set.exerciseId);
          if (group) muscleGroupSets[group] = (muscleGroupSets[group] ?? 0) + 1;
        }
        setMetrics({
          weekSessions: sessions.filter((session) => session.date >= weekStartId && session.date <= today).length,
          streak: getStreak(sessionDates),
          todaySets: todaySession?.sets?.length ?? 0,
          readinessScore: todayReadiness,
          hasRpe: rpeSnap.docs.some((doc) => (doc.data() as { id?: string }).id === today),
          hasFuel: mealsSnap.docs.some((doc) => (doc.data() as { date?: string }).date === today),
          fatigueSignal,
          program: todaySession?.program ?? null,
          muscleGroupSets,
        });
      } catch (error) {
        console.error("Couldn't load dashboard metrics", error);
        setError("We couldn't refresh today’s signal.");
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [user, reloadToken]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const completedSteps = [metrics.readinessScore !== null, metrics.todaySets > 0, metrics.hasRpe, metrics.hasFuel, metrics.weekSessions > 0].filter(Boolean).length;
  const guidance = metrics.fatigueSignal
    ? { eyebrow: "Recovery first", title: "Keep today lighter and deliberate.", body: "Your recent readiness has stayed low. Choose a lower-stress session or take more recovery before pushing volume." }
    : metrics.readinessScore === null
    ? { eyebrow: "First signal of the day", title: "Start with how you feel.", body: "A quick check-in gives your training plan useful context before you choose exercises and load." }
    : metrics.readinessScore < 60
    ? { eyebrow: "Adjust the dose", title: "Make room for a steady session.", body: "Your readiness is below your stronger days. Keep effort controlled and let the session earn its intensity." }
    : { eyebrow: "You have a clear signal", title: "Train with intent today.", body: "Your readiness supports a focused session. Keep the work honest, then capture how it felt." };
  const planLabel = metrics.program ? metrics.program.replace("_", " ").toUpperCase() : "Choose a program";

  if (loading) {
    return <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-12 pt-8 lg:px-8 lg:pt-12"><div className="animate-pulse space-y-6"><div className="h-72 rounded-3xl bg-[var(--surface)]" /><div className="grid gap-4 sm:grid-cols-2"><div className="h-32 rounded-2xl bg-[var(--surface)]" /><div className="h-32 rounded-2xl bg-[var(--surface)]" /></div><div className="h-48 rounded-2xl bg-[var(--surface)]" /></div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-12 pt-8 lg:px-8 lg:pt-12">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative z-[1] max-w-2xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{dateLabel} · {guidance.eyebrow}</p>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">{guidance.title}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            {guidance.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={metrics.readinessScore === null ? "/checkin" : "/log"} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)] transition-transform hover:-translate-y-0.5">
              {metrics.readinessScore === null ? "Start with a check-in" : "Continue today"} <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link href="/log" className="rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
              Log a session
            </Link>
          </div>
        </div>
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[28px] border-[var(--accent)]/10 sm:h-96 sm:w-96" />
        <div className="absolute bottom-[-4.5rem] right-20 h-44 w-44 rounded-full bg-[var(--warm)]/10 blur-2xl" />
      </section>

      {error && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]"><span>{error}</span><button type="button" onClick={() => setReloadToken((token) => token + 1)} className="font-semibold text-[var(--foreground)] underline">Retry</button></div>}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Today&apos;s loop</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{completedSteps} of 5 steps complete</h2></div><span className="text-xs text-[var(--muted)]">Check in · Train · Reflect · Fuel · Review</span></div>
        <div className="mt-5 flex gap-1.5">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < completedSteps ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} />)}</div>
      </section>

      {metrics.fatigueSignal && <Link href="/fatigue" className="mt-6 block rounded-2xl border border-[var(--warm)]/40 bg-[var(--warm)]/10 p-5 transition-colors hover:border-[var(--warm)]"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--warm)]">Recovery signal</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Recent readiness is trending low.</h2><p className="mt-1 text-sm text-[var(--muted)]">Open fatigue overlay to compare readiness with your training effort.</p></Link>}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Training balance</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Today by muscle group</h2></div><Link href="/trends" className="text-xs font-semibold text-[var(--accent)] hover:underline">Open review</Link></div>
        {Object.keys(metrics.muscleGroupSets).length === 0 ? <Link href="/log" className="mt-4 block rounded-xl bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Log your first set to see muscle-group volume here. <span className="font-semibold text-[var(--accent)]">Start training -&gt;</span></Link> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{(["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "calves", "core"] as MuscleGroup[]).map((group) => <div key={group} className="rounded-xl bg-[var(--surface-raised)] px-3 py-3"><p className="text-xs capitalize text-[var(--muted)]">{group}</p><strong className="mt-1 block text-2xl tracking-[-0.04em]">{metrics.muscleGroupSets[group] ?? 0}</strong><span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">sets</span></div>)}</div>}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Your plan</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Built for today</h2><p className="mt-2 text-sm text-[var(--muted)]">A simple loop: check in, train, then reflect.</p></div>
          <Link href="/log" className="group block rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-raised)]">
            <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--warm)]">{planLabel} · {metrics.readinessScore === null ? "readiness needed" : `${metrics.readinessScore} readiness`}</span><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metrics.todaySets > 0 ? "Session in progress" : "Ready when you are"}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{metrics.todaySets > 0 ? "Pick up where you left off and finish with an honest effort rating." : "Choose your split, set your targets, and make today's work measurable."}</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-lg text-[var(--accent-ink)] transition-transform group-hover:translate-x-1">-&gt;</span></div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">{metrics.todaySets} sets logged</span><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">Moderate effort</span><span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">Gym access</span></div>
          </Link>
        </div>
        <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warm)]">Daily rhythm</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Keep the signal clear</h2>
          <div className="mt-5 space-y-3">
            <Link href="/checkin" className="group flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-4 py-3 transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]">
              <span><strong className="block text-sm">01 · Check in</strong><span className="text-xs text-[var(--muted)] group-hover:text-[var(--accent-ink)]/70">Readiness in 60 seconds</span></span><span aria-hidden="true">-&gt;</span>
            </Link>
            <Link href="/meals" className="group flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-4 py-3 transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]">
              <span><strong className="block text-sm">02 · Fuel</strong><span className="text-xs text-[var(--muted)] group-hover:text-[var(--accent-ink)]/70">Log what supports you</span></span><span aria-hidden="true">-&gt;</span>
            </Link>
            <Link href="/trends" className="group flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-4 py-3 transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]">
              <span><strong className="block text-sm">03 · Review</strong><span className="text-xs text-[var(--muted)] group-hover:text-[var(--accent-ink)]/70">Notice patterns over time</span></span><span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
        </aside>
      </section>
      
      
      
      
      
      
      </main>
  );
}
