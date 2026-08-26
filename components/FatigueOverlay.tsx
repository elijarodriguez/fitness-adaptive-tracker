"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import type {
  Exercise,
  MuscleGroup,
  ReadinessCheckIn,
  WorkoutSession,
} from "@/lib/fitness-data-model";

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

function buildSegmentedPath(
  dates: string[],
  valueByDate: Map<string, number>,
  xOf: (i: number) => number,
  yOf: (v: number) => number
) {
  let path = "";
  let drawing = false;
  dates.forEach((d, i) => {
    const v = valueByDate.get(d);
    if (v === undefined) {
      drawing = false;
      return;
    }
    const cmd = drawing ? "L" : "M";
    path += `${cmd} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)} `;
    drawing = true;
  });
  return path.trim();
}

export default function FatigueOverlay() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [readiness, setReadiness] = useState<ReadinessCheckIn[]>([]);
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
        const [exSnap, sessSnap, readSnap] = await Promise.all([
          getDocs(collection(db, "exercises")),
          getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "readinessCheckIns"), where("ownerId", "==", user.uid))),
        ]);
        setExercises(exSnap.docs.map((d) => d.data() as Exercise));
        setSessions(sessSnap.docs.map((d) => d.data() as WorkoutSession));
        setReadiness(readSnap.docs.map((d) => d.data() as ReadinessCheckIn));
      } catch (e) {
        console.error(e);
        setError("Couldn't load data. Check your connection and try again.");
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

  // RIR normalized to 0-100 so it overlays directly against readiness score
  const rirByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedExercise) return map;
    for (const session of sessions) {
      const setsForEx = (session.sets ?? []).filter(
        (s) => s.exerciseId === selectedExercise.id
      );
      if (setsForEx.length === 0) continue;
      const best = setsForEx.reduce((a, b) => {
        const aVal = a.weightKg ?? a.reps;
        const bVal = b.weightKg ?? b.reps;
        return bVal > aVal ? b : a;
      });
      map.set(session.date, (best.rir / 4) * 100);
    }
    return map;
  }, [sessions, selectedExercise]);

  const readinessByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of readiness) map.set(r.date, r.readinessScore);
    return map;
  }, [readiness]);

  const allDates = useMemo(() => {
    const set = new Set<string>([...rirByDate.keys(), ...readinessByDate.keys()]);
    return Array.from(set).sort();
  }, [rirByDate, readinessByDate]);

  // Simple non-AI pattern flag: over the trailing shared window, readiness stays
  // low (avg < 50) while RIR (normalized) has dropped — a candidate fatigue signal.
  const flag = useMemo(() => {
    const sharedDates = allDates.filter(
      (d) => rirByDate.has(d) && readinessByDate.has(d)
    );
    if (sharedDates.length < 2) return null;
    const window = sharedDates.slice(-3);
    const avgReadiness =
      window.reduce((sum, d) => sum + (readinessByDate.get(d) ?? 0), 0) / window.length;
    const rirTrend =
      (rirByDate.get(window[window.length - 1]) ?? 0) - (rirByDate.get(window[0]) ?? 0);
    if (avgReadiness < 50 && rirTrend < 0) {
      return "Readiness has stayed low while RIR has been dropping on this exercise — a possible fatigue signal. Consider an easier session or extra rest.";
    }
    return null;
  }, [allDates, rirByDate, readinessByDate]);

  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 32, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const x = (i: number) =>
    allDates.length <= 1 ? plotW / 2 : (i / (allDates.length - 1)) * plotW;
  const y = (v: number) => plotH - (v / 100) * plotH;

  const readinessPath = buildSegmentedPath(allDates, readinessByDate, x, y);
  const rirPath = buildSegmentedPath(allDates, rirByDate, x, y);

  if (loading) {
    return (
      <div className="min-h-screen text-[#ECEEF0] flex items-center justify-center">
        <p className="text-[#8B939B] text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#ECEEF0] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-[var(--line)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--warm)]">Overtone / Recovery</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Fatigue overlay</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Readiness score vs. RIR on one exercise, same axis
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

        <div className="rounded-lg border border-[#2A2F34] bg-[#1E2226] p-2">
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
            <p className="text-sm font-semibold text-[var(--foreground)]">Start with an exercise</p>
            <p className="mt-2 max-w-md mx-auto text-sm leading-6 text-[var(--muted)]">Choose one you train often. Recovery compares readiness with reps in reserve to help spot when your performance may be under pressure.</p>
          </div>
        )}

        {selectedExercise && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">{selectedExercise.name} vs. readiness</h2>
            </div>

            {allDates.length === 0 ? (
              <p className="text-sm text-[#565C63]">Not enough data yet.</p>
            ) : (
              <>
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                  <g transform={`translate(${padding.left},${padding.top})`}>
                    {[0, 25, 50, 75, 100].map((tv) => (
                      <g key={tv}>
                        <line x1={0} x2={plotW} y1={y(tv)} y2={y(tv)} stroke="#2A2F34" strokeWidth={1} />
                        <text x={-8} y={y(tv)} dy={4} textAnchor="end" fontSize={10} fill="#8B939B">
                          {tv}
                        </text>
                      </g>
                    ))}
                    <path d={readinessPath} fill="none" stroke="#5B8C7B" strokeWidth={2} />
                    <path d={rirPath} fill="none" stroke="#D6976B" strokeWidth={2} strokeDasharray="4 3" />
                    {allDates.map((d, i) => (
                      <text key={d} x={x(i)} y={plotH + 18} textAnchor="middle" fontSize={9} fill="#8B939B">
                        {d.slice(5)}
                      </text>
                    ))}
                  </g>
                </svg>
                <div className="mt-3 flex items-center justify-center gap-5 text-[11px] text-[#8B939B]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-3 rounded-sm bg-[#5B8C7B]" />
                    Readiness
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-3 rounded-sm bg-[#D6976B]" />
                    RIR (normalized)
                  </span>
                </div>
              </>
            )}

            {flag && (
              <div className="mt-5 rounded-xl border border-[#D6976B]/40 bg-[#D6976B]/10 px-4 py-4 text-sm text-[#E8C39F]">
                <p className="mb-1 font-semibold text-[#F2C49B]">Recovery signal</p>
                {flag}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
