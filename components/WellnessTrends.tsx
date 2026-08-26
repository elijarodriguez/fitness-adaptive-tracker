"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import type { ReadinessCheckIn, SessionRPE } from "@/lib/fitness-data-model";

function SimpleLineChart({
  points,
  color,
  unitLabel,
}: {
  points: { date: string; value: number }[];
  color: string;
  unitLabel: string;
}) {
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 32, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (points.length === 0) {
    return <p className="text-sm text-[#565C63]">No data logged yet.</p>;
  }

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yPad = range * 0.2;

  const x = (i: number) =>
    points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW;
  const y = (v: number) =>
    plotH - ((v - (minV - yPad)) / (range + yPad * 2)) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");

  const yTicks = 3;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(minV - yPad + ((range + yPad * 2) / yTicks) * i)
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <g transform={`translate(${padding.left},${padding.top})`}>
        {tickValues.map((tv, i) => (
          <g key={i}>
            <line x1={0} x2={plotW} y1={y(tv)} y2={y(tv)} stroke="#2A2F34" strokeWidth={1} />
            <text x={-8} y={y(tv)} dy={4} textAnchor="end" fontSize={10} fill="#8B939B">
              {tv}
            </text>
          </g>
        ))}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={4} fill={color} />
            <text x={x(i)} y={plotH + 18} textAnchor="middle" fontSize={9} fill="#8B939B">
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </g>
      <text x={width - padding.right} y={14} textAnchor="end" fontSize={10} fill="#565C63">
        {unitLabel}
      </text>
    </svg>
  );
}

export default function WellnessTrends() {
  const [readiness, setReadiness] = useState<ReadinessCheckIn[]>([]);
  const [rpes, setRpes] = useState<(SessionRPE & { durationMinutes?: number })[]>([]);
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
        const [readSnap, rpeSnap] = await Promise.all([
          getDocs(query(collection(db, "readinessCheckIns"), where("ownerId", "==", user.uid))),
          getDocs(query(collection(db, "sessionRPEs"), where("ownerId", "==", user.uid))),
        ]);
        setReadiness(
          readSnap.docs
            .map((d) => d.data() as ReadinessCheckIn)
            .sort((a, b) => a.date.localeCompare(b.date))
        );
        setRpes(
          rpeSnap.docs
            .map((d) => d.data() as SessionRPE & { durationMinutes?: number })
            .sort((a, b) => a.id.localeCompare(b.id))
        );
      } catch (e) {
        console.error(e);
        setError("Couldn't load trend data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const readinessPoints = useMemo(
    () => readiness.map((r) => ({ date: r.date, value: r.readinessScore })),
    [readiness]
  );

  const loadPoints = useMemo(
    () => rpes.map((r) => ({ date: r.workoutSessionId, value: r.trainingLoad })),
    [rpes]
  );

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Wellness</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Wellness trends</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Readiness and training load over time</p>
        </header>

        {error && (
          <div className="rounded-md border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Readiness score</h2>
            <span className="text-xs text-[#8B939B]">
              {readinessPoints.length} check-in{readinessPoints.length === 1 ? "" : "s"}
            </span>
          </div>
          <SimpleLineChart points={readinessPoints} color="#5B8C7B" unitLabel="score / 100" />
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Training load</h2>
            <span className="text-xs text-[#8B939B]">
              {loadPoints.length} session{loadPoints.length === 1 ? "" : "s"}
            </span>
          </div>
          <SimpleLineChart points={loadPoints} color="#D6976B" unitLabel="RPE × minutes" />
        </section>
      </div>
    </div>
  );
}
