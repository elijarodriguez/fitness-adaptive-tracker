"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import type { Exercise, MuscleGroup, WorkoutSession } from "@/lib/fitness-data-model";

const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "core",
  "calves",
];

const RIR_COLORS: Record<number, string> = {
  0: "#C97064", // hardest — red-clay
  1: "#D6976B",
  2: "#D6C26B",
  3: "#9BBF8C",
  4: "#5B8C7B", // most reserve — sage
};

type TrendPoint = {
  date: string;
  value: number;
  rir: number;
  isBodyweight: boolean;
};

function Chart({ points }: { points: TrendPoint[] }) {
  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 32, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yPad = range * 0.15;

  const x = (i: number) =>
    points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW;
  const y = (v: number) =>
    plotH - ((v - (minV - yPad)) / (range + yPad * 2)) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(minV - yPad + ((range + yPad * 2) / yTicks) * i)
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <g transform={`translate(${padding.left},${padding.top})`}>
        {tickValues.map((tv, i) => (
          <g key={i}>
            <line
              x1={0}
              x2={plotW}
              y1={y(tv)}
              y2={y(tv)}
              stroke="#2A2F34"
              strokeWidth={1}
            />
            <text x={-8} y={y(tv)} dy={4} textAnchor="end" fontSize={10} fill="#8B939B">
              {tv}
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke="#3A4A44" strokeWidth={2} />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={5} fill={RIR_COLORS[p.rir] ?? "#8B939B"} />
            <text
              x={x(i)}
              y={plotH + 18}
              textAnchor="middle"
              fontSize={9}
              fill="#8B939B"
            >
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function TrendDashboard() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "all">("all");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [exSnap, sessSnap] = await Promise.all([
          getDocs(collection(db, "exercises")),
          getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", user.uid))),
        ]);
        setExercises(exSnap.docs.map((d) => d.data() as Exercise));
        setSessions(sessSnap.docs.map((d) => d.data() as WorkoutSession));
      } catch (e) {
        console.error(e);
        setError("Couldn't load trend data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const filteredExercises = useMemo(
    () =>
      muscleFilter === "all"
        ? exercises
        : exercises.filter((e) => e.muscleGroup === muscleFilter),
    [exercises, muscleFilter]
  );

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) ?? null;

  const points = useMemo<TrendPoint[]>(() => {
    if (!selectedExercise) return [];
    const rows: TrendPoint[] = [];
    for (const session of sessions) {
      const setsForEx = (session.sets ?? []).filter(
        (s) => s.exerciseId === selectedExercise.id
      );
      if (setsForEx.length === 0) continue;
      // representative set for the day: heaviest by weight, or highest reps for bodyweight
      const best = setsForEx.reduce((a, b) => {
        const aVal = a.weightKg ?? a.reps;
        const bVal = b.weightKg ?? b.reps;
        return bVal > aVal ? b : a;
      });
      rows.push({
        date: session.date,
        value: best.weightKg ?? best.reps,
        rir: best.rir,
        isBodyweight: best.weightKg === undefined,
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, selectedExercise]);

  const trendSummary = useMemo(() => {
    if (points.length === 0) return null;
    const first = points[0].value;
    const latest = points[points.length - 1].value;
    const change = latest - first;
    const averageRir = points.reduce((sum, point) => sum + point.rir, 0) / points.length;
    return { latest, change, averageRir, isBodyweight: points[points.length - 1].isBodyweight };
  }, [points]);

  if (loading) {
    return (
      <div className="min-h-screen text-[#ECEEF0] flex items-center justify-center">
        <p className="text-[#8B939B] text-sm tracking-wide">Loading trend data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#ECEEF0] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-[var(--line)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Progress</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Exercise trends</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Weight/reps over time · dot color = RIR that session
          </p>
        </header>

        {error && (
          <div className="rounded-md border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMuscleFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
              muscleFilter === "all"
                ? "bg-[#5B8C7B] text-[#14171A]"
                : "bg-[#1E2226] text-[#8B939B] hover:text-[#ECEEF0]"
            }`}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(mg)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors ${
                muscleFilter === mg
                  ? "bg-[#5B8C7B] text-[#14171A]"
                  : "bg-[#1E2226] text-[#8B939B] hover:text-[#ECEEF0]"
              }`}
            >
              {mg}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="max-h-48 overflow-y-auto">
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedExerciseId(ex.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedExerciseId === ex.id
                    ? "bg-[#5B8C7B]/15 text-[#ECEEF0]"
                    : "text-[#C5CAD0] hover:bg-[#2A2F34]"
                }`}
              >
                <span>{ex.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-[#8B939B]">
                  {ex.equipmentTier}
                </span>
              </button>
            ))}
          </div>
        </div>

        {!selectedExercise && (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm font-semibold text-[var(--foreground)]">Pick an exercise to see its story</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Overtone compares your best set from each logged session.</p>
          </div>
        )}

        {selectedExercise && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">{selectedExercise.name}</h2>
              <span className="text-xs text-[#8B939B]">
                {points.length} session{points.length === 1 ? "" : "s"} logged
              </span>
            </div>

            {trendSummary && (
              <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Latest</p><p className="mt-2 text-xl font-semibold">{trendSummary.latest}<span className="ml-1 text-xs font-normal text-[var(--muted)]">{trendSummary.isBodyweight ? "reps" : "kg"}</span></p></div>
                <div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Change</p><p className={`mt-2 text-xl font-semibold ${trendSummary.change >= 0 ? "text-[var(--accent)]" : "text-[var(--warm)]"}`}>{trendSummary.change > 0 ? "+" : ""}{trendSummary.change}</p></div>
                <div className="rounded-xl bg-[var(--surface-raised)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Avg RIR</p><p className="mt-2 text-xl font-semibold">{trendSummary.averageRir.toFixed(1)}</p></div>
              </div>
            )}

            {points.length === 0 ? (
              <p className="text-sm text-[#565C63]">
                No sets logged for this exercise yet.
              </p>
            ) : (
              <>
                {trendSummary && <p className="mb-4 text-sm text-[var(--muted)]">{trendSummary.change > 0 ? "Your latest best set is trending up." : trendSummary.change < 0 ? "Your latest best set is below your first logged session." : "Your best set is holding steady across sessions."}</p>}
                <Chart points={points} />
                <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-[#8B939B]">
                  <span>RIR:</span>
                  {[0, 1, 2, 3, 4].map((r) => (
                    <span key={r} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: RIR_COLORS[r] }}
                      />
                      {r}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
