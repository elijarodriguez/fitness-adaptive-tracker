"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import type { MealLog, PortionSize } from "@/lib/fitness-data-model";
import { useAuth } from "@/components/AuthProvider";

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_TYPES: MealLog["mealType"][] = ["breakfast", "lunch", "dinner", "snack"];
const PORTIONS: PortionSize[] = ["small", "medium", "large"];

const PORTION_ROWS: { key: "proteinPortion" | "vegPortion" | "carbPortion"; label: string }[] = [
  { key: "proteinPortion", label: "Protein" },
  { key: "vegPortion", label: "Vegetables" },
  { key: "carbPortion", label: "Carbs" },
];

function PortionPicker({
  value,
  onChange,
}: {
  value: PortionSize;
  onChange: (v: PortionSize) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {PORTIONS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
            value === p
              ? "bg-[#5B8C7B] text-[#14171A]"
              : "bg-[#14171A] text-[#8B939B] hover:text-[#ECEEF0]"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export default function MealLogger() {
  const [mealType, setMealType] = useState<MealLog["mealType"]>("lunch");
  const [proteinPortion, setProteinPortion] = useState<PortionSize>("medium");
  const [vegPortion, setVegPortion] = useState<PortionSize>("medium");
  const [carbPortion, setCarbPortion] = useState<PortionSize>("medium");

  const [todaysMeals, setTodaysMeals] = useState<MealLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const q = query(collection(db, "mealLogs"), where("ownerId", "==", user.uid));
        const snap = await getDocs(q);
        setTodaysMeals(snap.docs.map((d) => d.data() as MealLog).filter((meal) => meal.date === todayId()));
      } catch (e) {
        console.error(e);
        setError("Couldn't load today's meals.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function addMeal() {
    if (!user) {
      setError("Sign in to save meals.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry: MealLog = {
        id: `meal_${Date.now()}`,
        date: todayId(),
        ownerId: user.uid,
        mealType,
        proteinPortion,
        vegPortion,
        carbPortion,
      };
      await setDoc(doc(db, "mealLogs", entry.id), entry);
      setTodaysMeals((prev) => [...prev, entry]);
      // reset portions to medium for the next entry, keep meal type as-is
      setProteinPortion("medium");
      setVegPortion("medium");
      setCarbPortion("medium");
    } catch (e) {
      console.error(e);
      setError("That meal didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen text-[#ECEEF0] flex items-center justify-center">
        <p className="text-[#8B939B] text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#ECEEF0] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-[var(--line)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Fuel</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Fuel your training</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{todayId()} · portion-based, no counting</p>
        </header>

        {error && (
          <div className="rounded-md border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap gap-2">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                onClick={() => setMealType(mt)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors ${
                  mealType === mt
                    ? "bg-[#5B8C7B] text-[#14171A]"
                    : "bg-[#14171A] text-[#8B939B] hover:text-[#ECEEF0]"
                }`}
              >
                {mt}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {PORTION_ROWS.map((row) => (
              <div key={row.key}>
                <label className="mb-1.5 block text-sm text-[#C5CAD0]">{row.label}</label>
                <PortionPicker
                  value={
                    row.key === "proteinPortion"
                      ? proteinPortion
                      : row.key === "vegPortion"
                      ? vegPortion
                      : carbPortion
                  }
                  onChange={
                    row.key === "proteinPortion"
                      ? setProteinPortion
                      : row.key === "vegPortion"
                      ? setVegPortion
                      : setCarbPortion
                  }
                />
              </div>
            ))}
          </div>

          <button
            onClick={addMeal}
            disabled={saving}
            className="mt-6 w-full rounded-md bg-[#5B8C7B] px-3 py-2 text-sm font-medium text-[#14171A] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Log meal"}
          </button>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-[#8B939B] uppercase tracking-wider">
            Today&apos;s meals
          </h2>
          {todaysMeals.length === 0 ? (
            <p className="text-sm text-[#565C63]">Nothing logged yet today.</p>
          ) : (
            <ul className="space-y-2">
              {todaysMeals.map((meal) => (
                <li
                  key={meal.id}
                  className="rounded-md border border-[#2A2F34] bg-[#1E2226] px-4 py-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-[#ECEEF0]">
                      {meal.mealType}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B939B]">
                    Protein: <span className="capitalize text-[#C5CAD0]">{meal.proteinPortion}</span>
                    {"  ·  "}
                    Veg: <span className="capitalize text-[#C5CAD0]">{meal.vegPortion}</span>
                    {"  ·  "}
                    Carbs: <span className="capitalize text-[#C5CAD0]">{meal.carbPortion}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
