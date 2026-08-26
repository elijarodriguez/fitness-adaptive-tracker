"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  query,
  where,
} from "firebase/firestore";
import type {
  Exercise,
  ExerciseSubstitutionGroup,
  MuscleGroup,
  SetLog,
} from "@/lib/fitness-data-model";
import { useAuth } from "@/components/AuthProvider";

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

const RIR_OPTIONS = [0, 1, 2, 3, 4] as const;

function todayId() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, doubles as "one session per day"
}

export default function WorkoutLogger() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [subGroups, setSubGroups] = useState<ExerciseSubstitutionGroup[]>([]);
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | "all">("all");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(false);

  const [weightKg, setWeightKg] = useState("");
  const [variation, setVariation] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState<number>(2);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const [loggedSets, setLoggedSets] = useState<SetLog[]>([]);
  const [previousSets, setPreviousSets] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCustomExercise, setShowCustomExercise] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>("chest");
  const [customPattern, setCustomPattern] = useState<Exercise["movementPattern"]>("push");
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const [exSnap, subSnap, sessionsSnap] = await Promise.all([
          getDocs(collection(db, "exercises")),
          getDocs(collection(db, "substitutionGroups")),
          user ? getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", user.uid))) : Promise.resolve({ docs: [] }),
        ]);
        setExercises(exSnap.docs.map((d) => d.data() as Exercise));
        setSubGroups(subSnap.docs.map((d) => d.data() as ExerciseSubstitutionGroup));
        const previousSession = sessionsSnap.docs
          .map((session) => session.data() as { date: string; sets?: SetLog[] })
          .find((session) => session.date === todayId());
        setLoggedSets((previousSession?.sets ?? []) as SetLog[]);
        const priorSession = sessionsSnap.docs
          .map((session) => session.data() as { date: string; sets?: SetLog[] })
          .filter((session) => session.date < todayId())
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        setPreviousSets(priorSession?.sets ?? []);
        if (user) {
          const customSnap = await getDocs(collection(db, "users", user.uid, "customExercises"));
          setCustomExercises(customSnap.docs.map((item) => ({ ...(item.data() as Exercise), id: item.id })));
        }
      } catch (e) {
        console.error(e);
        const code = typeof e === "object" && e !== null && "code" in e ? String(e.code) : "";
        setError(
          code === "permission-denied"
            ? "Firebase denied access. Deploy the current Firestore rules and check your signed-in account."
            : "Couldn't load your exercises. Check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const filteredExercises = useMemo(
    () =>
      (muscleFilter === "all"
        ? [...exercises, ...customExercises]
        : [...exercises, ...customExercises].filter((e) => e.muscleGroup === muscleFilter)
      ).filter((e) => e.name.toLowerCase().includes(exerciseSearch.toLowerCase())),
    [exercises, customExercises, muscleFilter, exerciseSearch]
  );

  const allExercises = useMemo(() => [...exercises, ...customExercises], [exercises, customExercises]);
  const selectedExercise = allExercises.find((e) => e.id === selectedExerciseId) ?? null;

  const previousSet = useMemo(() => {
    if (!selectedExercise) return null;
    return [...previousSets].reverse().find((set) => set.exerciseId === selectedExercise.id) ?? null;
  }, [previousSets, selectedExercise]);

  const sessionSummary = useMemo(() => ({
    exercises: new Set(loggedSets.map((set) => set.exerciseId)).size,
    reps: loggedSets.reduce((total, set) => total + set.reps, 0),
    volume: loggedSets.reduce((total, set) => total + (set.weightKg ?? 0) * set.reps, 0),
  }), [loggedSets]);

  const alternatives = useMemo(() => {
    if (!selectedExercise) return [];
    const group = subGroups.find((g) => g.exerciseIds.includes(selectedExercise.id));
    if (!group) return [];
    return group.exerciseIds
      .filter((id) => id !== selectedExercise.id)
      .map((id) => allExercises.find((e) => e.id === id))
      .filter((e): e is Exercise => Boolean(e));
  }, [selectedExercise, subGroups, allExercises]);

  async function createCustomExercise() {
    if (!user || !customName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const customExercise: Omit<Exercise, "id"> = {
        name: customName.trim(),
        muscleGroup: customMuscle,
        movementPattern: customPattern,
        equipmentTier: "machine",
      };
      const reference = await addDoc(collection(db, "users", user.uid, "customExercises"), customExercise);
      setCustomExercises((previous) => [...previous, { ...customExercise, id: reference.id }]);
      setCustomName("");
      setShowCustomExercise(false);
      setNotice("Custom exercise added");
    } catch (error) {
      console.error(error);
      setError("That custom exercise couldn't be saved. Check your account permissions and try again.");
    } finally {
      setSaving(false);
    }
  }

  function selectExercise(id: string) {
    setSelectedExerciseId(id);
    setShowAlternatives(false);
    setWeightKg("");
    setVariation("");
    setReps("");
    setRir(2);
    setNotice(null);
  }

  function editSet(set: SetLog) {
    selectExercise(set.exerciseId);
    setEditingSetId(set.id);
    setWeightKg(set.weightKg === undefined ? "" : String(set.weightKg));
    setVariation(set.bodyweightVariation ?? "");
    setReps(String(set.reps));
    setRir(set.rir);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addSet() {
    if (!selectedExercise || !reps) return;

    if (!user) {
      setError("Sign in to save workout data.");
      return;
    }

    const newSet: SetLog = {
      id: `set_${Date.now()}`,
      exerciseId: selectedExercise.id,
      reps: Number(reps),
      rir: rir as SetLog["rir"],
      ...(selectedExercise.equipmentTier === "bodyweight"
        ? { bodyweightVariation: variation || "standard" }
        : weightKg
        ? { weightKg: Number(weightKg) }
        : {}),
    };

    setSaving(true);
    setError(null);
    try {
      const sessionRef = doc(db, "workoutSessions", todayId());
      if (editingSetId) {
        const snap = await getDoc(sessionRef);
        if (!snap.exists()) throw new Error("Workout session not found");
        const existingSets = (snap.data().sets ?? []) as SetLog[];
        const updatedSets = existingSets.map((set) =>
          set.id === editingSetId ? { ...newSet, id: editingSetId } : set
        );
        await setDoc(sessionRef, { ownerId: user.uid, sets: updatedSets }, { merge: true });
        setLoggedSets(updatedSets);
      } else {
        await setDoc(
          sessionRef,
          { id: todayId(), date: todayId(), ownerId: user.uid, sets: arrayUnion(newSet) },
          { merge: true }
        );
        setLoggedSets((prev) => [...prev, newSet]);
      }
      setReps("");
      setWeightKg("");
      setVariation("");
      setRir(2);
      setEditingSetId(null);
      setNotice(editingSetId ? "Set updated" : "Set logged");
    } catch (e) {
      console.error(e);
      setError("That set didn't save — it's not logged yet. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSet(setId: string) {
    if (!user) {
      setError("Sign in to manage workout data.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sessionRef = doc(db, "workoutSessions", todayId());
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      const updatedSets = ((snap.data().sets ?? []) as SetLog[]).filter((set) => set.id !== setId);
      await setDoc(sessionRef, { ownerId: user.uid, sets: updatedSets }, { merge: true });
      setLoggedSets(updatedSets);
      if (editingSetId === setId) {
        setEditingSetId(null);
        setReps("");
      }
      setNotice("Set deleted");
    } catch (e) {
      console.error(e);
      setError("That set couldn't be deleted. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function exerciseName(id: string) {
    return exercises.find((e) => e.id === id)?.name ?? id;
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 text-[#ECEEF0] sm:px-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5">
          <div className="h-28 rounded-2xl bg-[var(--surface)]" />
          <div className="h-12 rounded-xl bg-[var(--surface)]" />
          <div className="h-64 rounded-2xl bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#ECEEF0] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Train</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Today&apos;s session</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Choose an exercise, log the work, and keep your rhythm.</p>
          </div>
          <div className="flex items-center gap-2" aria-label={`${loggedSets.length} sets logged today`}>
              <span className="font-mono text-3xl tabular-nums text-[var(--accent)]">
              {loggedSets.length}
            </span>
            <span className="text-xs text-[#8B939B] uppercase tracking-wider">sets</span>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-6 flex items-center justify-between rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
            <span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Dismiss</button>
          </div>
        )}

        {/* Muscle group filter */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Choose an exercise</p>
          <input
            type="search"
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none sm:w-52"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
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

        {user ? (
          <button type="button" onClick={() => setShowCustomExercise((visible) => !visible)} className="mb-4 text-sm font-semibold text-[var(--accent)] hover:underline">
            {showCustomExercise ? "Close custom exercise" : "+ Add custom exercise"}
          </button>
        ) : (
          <p className="mb-4 text-xs text-[var(--muted)]">Sign in to add a personal exercise.</p>
        )}
        {showCustomExercise && user && (
          <div className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold">Add to your library</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Exercise name" aria-label="Exercise name" className="rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 text-sm outline-none focus:border-[var(--accent)] sm:col-span-3" />
              <select value={customMuscle} onChange={(event) => setCustomMuscle(event.target.value as MuscleGroup)} aria-label="Muscle group" className="rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 text-sm"><option value="chest">Chest</option><option value="back">Back</option><option value="shoulders">Shoulders</option><option value="biceps">Biceps</option><option value="triceps">Triceps</option><option value="quads">Quads</option><option value="hamstrings">Hamstrings</option><option value="core">Core</option><option value="calves">Calves</option></select>
              <select value={customPattern} onChange={(event) => setCustomPattern(event.target.value as Exercise["movementPattern"])} aria-label="Movement pattern" className="rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 text-sm"><option value="push">Push</option><option value="pull">Pull</option><option value="hinge">Hinge</option><option value="squat">Squat</option><option value="isolation">Isolation</option></select>
              <button type="button" onClick={createCustomExercise} disabled={!customName.trim() || saving} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{saving ? "Saving…" : "Add exercise"}</button>
            </div>
          </div>
        )}

        {/* Exercise picker */}
        <div className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="max-h-56 overflow-y-auto">
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => selectExercise(ex.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedExerciseId === ex.id
                    ? "bg-[#5B8C7B]/15 text-[#ECEEF0]"
                    : "text-[#C5CAD0] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <span>{ex.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-[#8B939B]">
                  {ex.equipmentTier}
                </span>
              </button>
            ))}
            {filteredExercises.length === 0 && (
              <p className="px-3 py-4 text-sm text-[#8B939B]">No exercises in this group yet.</p>
            )}
          </div>
        </div>

        {/* Set entry form */}
        {selectedExercise && (
          <div className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{editingSetId ? "Editing set" : "Add a set"}</p><h2 className="mt-1 font-medium">{selectedExercise.name}</h2></div>
              {alternatives.length > 0 && (
                <button
                  onClick={() => setShowAlternatives((v) => !v)}
                  className="text-xs text-[#5B8C7B] underline decoration-dotted underline-offset-4 hover:text-[#77A895]"
                >
                  {showAlternatives ? "Hide alternatives" : "Show alternatives"}
                </button>
              )}
            </div>

            {previousSet && !editingSetId && (
              <div className="mb-5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Last logged set</p>
                <p className="mt-1 text-[var(--muted)]">{previousSet.weightKg !== undefined ? `${previousSet.weightKg} kg` : previousSet.bodyweightVariation ?? "Bodyweight"} × {previousSet.reps} reps · RIR {previousSet.rir}</p>
              </div>
            )}

            {showAlternatives && (
              <div className="mb-4 flex flex-wrap gap-2">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => selectExercise(alt.id)}
                    className="rounded-md border border-[#2A2F34] bg-[#14171A] px-3 py-1.5 text-xs text-[#C5CAD0] hover:border-[#5B8C7B]/50 hover:text-[#ECEEF0]"
                  >
                    {alt.name} · {alt.equipmentTier}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedExercise.equipmentTier === "bodyweight" ? (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-[#8B939B]">Variation</label>
                  <input
                    type="text"
                    value={variation}
                    onChange={(e) => setVariation(e.target.value)}
                    placeholder="standard"
                    className="w-full rounded-md border border-[#2A2F34] bg-[#14171A] px-3 py-2 text-sm text-[#ECEEF0] placeholder:text-[#565C63] focus:border-[#5B8C7B] focus:outline-none focus:ring-1 focus:ring-[#5B8C7B]"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs text-[#8B939B]">Weight (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full rounded-md border border-[#2A2F34] bg-[#14171A] px-3 py-2 font-mono text-sm tabular-nums text-[#ECEEF0] focus:border-[#5B8C7B] focus:outline-none focus:ring-1 focus:ring-[#5B8C7B]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-[#8B939B]">Reps</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="w-full rounded-md border border-[#2A2F34] bg-[#14171A] px-3 py-2 font-mono text-sm tabular-nums text-[#ECEEF0] focus:border-[#5B8C7B] focus:outline-none focus:ring-1 focus:ring-[#5B8C7B]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#8B939B]">RIR</label>
                <select
                  value={rir}
                  onChange={(e) => setRir(Number(e.target.value))}
                  className="w-full rounded-md border border-[#2A2F34] bg-[#14171A] px-3 py-2 text-sm text-[#ECEEF0] focus:border-[#5B8C7B] focus:outline-none focus:ring-1 focus:ring-[#5B8C7B]"
                >
                  {RIR_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 flex items-end sm:col-span-1">
                <button
                  onClick={addSet}
                  disabled={!reps || saving}
                  className="w-full rounded-md bg-[#5B8C7B] px-3 py-2 text-sm font-medium text-[#14171A] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "Saving…" : editingSetId ? "Update set" : "Add set"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Today's logged sets */}
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-medium uppercase tracking-wider text-[#8B939B]">Logged today</h2><p className="mt-1 text-xs text-[var(--muted)]">{sessionSummary.exercises} exercise{sessionSummary.exercises === 1 ? "" : "s"} · {sessionSummary.reps} total reps</p></div><span className="text-xs text-[var(--muted)]">{sessionSummary.volume > 0 ? `${sessionSummary.volume} kg volume` : "Bodyweight session"}</span></div>
          {loggedSets.length === 0 ? (
            <p className="text-sm text-[#565C63]">No sets yet — pick an exercise above to start.</p>
          ) : (
            <ul className="space-y-2">
              {loggedSets.map((set) => (
                <li
                  key={set.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <span className="text-[#ECEEF0]">{exerciseName(set.exerciseId)}</span>
                  <div className="flex items-center gap-3"><span className="font-mono tabular-nums text-[#8B939B]">
                    {set.weightKg !== undefined ? `${set.weightKg}kg × ` : set.bodyweightVariation ? `${set.bodyweightVariation} × ` : ""}
                    {set.reps} reps · RIR {set.rir}
                  </span><button type="button" onClick={() => editSet(set)} className="text-xs font-semibold text-[var(--accent)] hover:underline">Edit</button><button type="button" onClick={() => deleteSet(set.id)} disabled={saving} className="text-xs font-semibold text-[var(--warm)] hover:underline disabled:opacity-40">Delete</button></div>
                </li>
              ))}
            </ul>
          )}
          {loggedSets.length > 0 && <div className="mt-5 rounded-2xl border border-[var(--accent)]/20 bg-[var(--surface)] p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Good work</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">You&apos;ve logged {loggedSets.length} set{loggedSets.length === 1 ? "" : "s"} today. Keep the next one controlled and honest.</p></div>}
        </div>
      </div>
    </div>
  );
}
