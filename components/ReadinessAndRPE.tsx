"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { computeReadinessScore } from "@/lib/fitness-data-model";
import type { ReadinessCheckIn, SessionRPE } from "@/lib/fitness-data-model";
import { useAuth } from "@/components/AuthProvider";

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

type ReadinessInputs = Omit<ReadinessCheckIn, "id" | "date" | "readinessScore" | "ownerId">;

const READINESS_FIELDS: { key: keyof ReadinessInputs; label: string; hint: string }[] = [
  { key: "sleepQuality", label: "Sleep quality", hint: "1 = rough night, 5 = fully rested" },
  { key: "soreness", label: "Soreness", hint: "1 = very sore, 5 = fresh" },
  { key: "stress", label: "Stress", hint: "1 = high stress, 5 = calm" },
  { key: "motivation", label: "Motivation", hint: "1 = low, 5 = ready to go" },
  { key: "energy", label: "Energy", hint: "1 = drained, 5 = energized" },
];

const VALUE_LABELS = ["Low", "Below average", "Okay", "Good", "Great"];
const RPE_BANDS = [
  { range: "1-3", label: "Easy" },
  { range: "4-6", label: "Moderate" },
  { range: "7-8", label: "Hard" },
  { range: "9-10", label: "Max effort" },
];

function Slider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {VALUE_LABELS.map((label, index) => {
        const option = index + 1;
        const active = value === option;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={`min-h-14 rounded-xl border px-1 py-2 text-center transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]" : "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--muted)] hover:border-[var(--accent)]/60 hover:text-[var(--foreground)]"}`}
          >
            <span className="block text-sm font-semibold">{option}</span>
            <span className="mt-1 block text-[10px] leading-3">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ReadinessAndRPE() {
  const [readiness, setReadiness] = useState<ReadinessInputs>({
    sleepQuality: 3,
    soreness: 3,
    stress: 3,
    motivation: 3,
    energy: 3,
  });
  const [readinessSaved, setReadinessSaved] = useState(false);
  const [readinessSaving, setReadinessSaving] = useState(false);

  const [rpe, setRpe] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [rpeSaved, setRpeSaved] = useState(false);
  const [rpeSaving, setRpeSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const score = computeReadinessScore(readiness);
  const trainingLoad = durationMinutes ? rpe * Number(durationMinutes) : null;

  useEffect(() => {
    async function loadExisting() {
      if (!user) return;
      try {
        const [readSnap, rpeSnap] = await Promise.all([
          getDoc(doc(db, "readinessCheckIns", todayId())),
          getDoc(doc(db, "sessionRPEs", todayId())),
        ]);
        if (readSnap.exists()) {
          const data = readSnap.data() as ReadinessCheckIn;
          setReadiness({
            sleepQuality: data.sleepQuality,
            soreness: data.soreness,
            stress: data.stress,
            motivation: data.motivation,
            energy: data.energy,
          });
          setReadinessSaved(true);
        }
        if (rpeSnap.exists()) {
          const data = rpeSnap.data() as SessionRPE & { durationMinutes?: number };
          setRpe(data.rpe);
          if (data.durationMinutes) setDurationMinutes(String(data.durationMinutes));
          setRpeSaved(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadExisting();
  }, [user]);

  async function saveReadiness() {
    if (!user) {
      setError("Sign in to save your check-in.");
      return;
    }
    setReadinessSaving(true);
    setError(null);
    try {
      const checkIn: ReadinessCheckIn = {
        id: todayId(),
        date: todayId(),
        ownerId: user.uid,
        ...readiness,
        readinessScore: score,
      };
      await setDoc(doc(db, "readinessCheckIns", todayId()), checkIn);
      setReadinessSaved(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't save your check-in. Try again.");
    } finally {
      setReadinessSaving(false);
    }
  }

  async function saveRpe() {
    if (!durationMinutes) return;
    if (!user) {
      setError("Sign in to save session effort.");
      return;
    }
    setRpeSaving(true);
    setError(null);
    try {
      const entry: SessionRPE & { durationMinutes: number } = {
        id: todayId(),
        workoutSessionId: todayId(),
        ownerId: user.uid,
        rpe,
        durationMinutes: Number(durationMinutes),
        trainingLoad: rpe * Number(durationMinutes),
      };
      await setDoc(doc(db, "sessionRPEs", todayId()), entry);
      setRpeSaved(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't save session RPE. Try again.");
    } finally {
      setRpeSaving(false);
    }
  }

  return (
    <div className="min-h-screen text-[#ECEEF0] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Check-in</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">How are you today?</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">A 60-second read on what your body is ready for.</p>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">{todayId()}</span>
        </header>

        {error && (
          <div className="rounded-md border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">
            {error}
          </div>
        )}

        {/* Readiness */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-7 flex flex-col gap-5 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Before you train</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Readiness check</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-full" style={{ background: `conic-gradient(var(--accent) ${score}%, var(--line) 0)` }}>
                <div className="grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full bg-[var(--surface)]"><span className="text-2xl font-semibold tracking-[-0.05em]">{score}</span></div>
              </div>
              <span className="max-w-20 text-xs leading-5 text-[var(--muted)]">{score >= 70 ? "Ready for a solid session" : "Consider a lighter session"}</span>
            </div>
          </div>

          <div className="space-y-5">
            {READINESS_FIELDS.map((field) => (
              <div key={field.key}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <label className="text-sm font-medium text-[#ECEEF0]">{field.label}</label>
                    <span className="text-right text-xs text-[var(--muted)]">{field.hint}</span>
                </div>
                <Slider
                  value={readiness[field.key]}
                  onChange={(v) =>
                    setReadiness((prev) => ({ ...prev, [field.key]: v }))
                  }
                />
              </div>
            ))}
          </div>

          <button
            onClick={saveReadiness}
            disabled={readinessSaving}
            className="mt-7 w-full rounded-xl bg-[var(--accent)] px-3 py-3 text-sm font-semibold text-[var(--accent-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            {readinessSaving ? "Saving…" : readinessSaved ? "Update check-in" : "Save check-in"}
          </button>
        </section>

        {/* Session RPE */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warm)]">After you train</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Session effort</h2><p className="mt-2 text-sm text-[var(--muted)]">Tell Overtone how the work actually felt.</p></div>
            <span className="rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-xs font-semibold text-[var(--warm)]">RPE</span>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-sm text-[#C5CAD0]">
                How hard did today&apos;s session feel?
              </label>
              <span className="font-mono text-sm tabular-nums text-[var(--accent)]">{rpe} / 10</span>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, index) => {
                const option = index + 1;
                const active = rpe === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRpe(option)}
                    aria-pressed={active}
                    className={`min-h-12 rounded-xl border text-sm font-semibold transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]" : "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--muted)] hover:border-[var(--accent)]/60 hover:text-[var(--foreground)]"}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] text-[var(--muted)]">
              {RPE_BANDS.map((band) => <span key={band.range}><strong className="block font-semibold text-[var(--foreground)]">{band.range}</strong>{band.label}</span>)}
            </div>
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm text-[#C5CAD0]">Session duration (minutes)</label>
            <input
              type="number"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="45"
              className="w-full rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 font-mono text-sm tabular-nums text-[#ECEEF0] placeholder:text-[#565C63] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {trainingLoad !== null && (
            <p className="mb-5 text-xs text-[#8B939B]">
              Training load: <span className="font-mono tabular-nums text-[#C5CAD0]">{trainingLoad}</span>
            </p>
          )}

          <button
            onClick={saveRpe}
            disabled={!durationMinutes || rpeSaving}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            {rpeSaving ? "Saving…" : rpeSaved ? "Update RPE" : "Save RPE"}
          </button>
        </section>
      </div>
    </div>
  );
}
