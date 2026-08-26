// ============================================================
// FITNESS ADAPTIVE TRACKER — DATA MODEL (Phase 1 Draft)
// ============================================================

// ---------- Core enums ----------

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "core"
  | "calves";

export type MovementPattern =
  | "push"
  | "pull"
  | "hinge"
  | "squat"
  | "isolation";

export type EquipmentTier = "machine" | "band" | "bodyweight";

export type PortionSize = "small" | "medium" | "large";

export type WorkoutProgram = "ppl" | "arnold" | "upper_lower" | "fbeod" | "anterior_posterior";

export type WorkoutFocus =
  | "push"
  | "pull"
  | "legs"
  | "chest_back"
  | "shoulders_arms"
  | "upper"
  | "lower"
  | "full_body"
  | "anterior"
  | "posterior";

export interface WorkoutExercisePlan {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: string;
  targetRir: 0 | 1 | 2 | 3 | 4;
  restSeconds: number;
  warmupSets?: number;
  supersetKey?: string;
}

// Where in the range of motion the exercise loads the muscle hardest.
// Applies to compounds AND isolation exercises — e.g. SLDL (compound) is
// stretch-emphasis on the hamstrings, same logic as an incline curl.
export type TensionEmphasis = "stretch" | "peak_contraction" | "full_rom";

// ---------- Exercise Library ----------

export interface Exercise {
  id: string;
  name: string; // e.g. "Chest Press Machine", "Band Chest Press", "Decline Push-Up"
  muscleGroup: MuscleGroup;
  movementPattern: MovementPattern;
  equipmentTier: EquipmentTier;
  tensionEmphasis?: TensionEmphasis; // optional for now — fill in as mock data expands
}

// Links exercises across equipment tiers that train the same pattern,
// so PR/trend history can "chain" across a gym -> band -> bodyweight switch.
export interface ExerciseSubstitutionGroup {
  id: string;
  movementPattern: MovementPattern;
  muscleGroup: MuscleGroup;
  exerciseIds: string[]; // e.g. [chestPressMachine.id, bandChestPress.id, declinePushUp.id]
}

// ---------- Workout Logging ----------

export interface SetLog {
  id: string;
  exerciseId: string;
  weightKg?: number; // omit for pure bodyweight sets
  bodyweightVariation?: string; // e.g. "feet-elevated", "standard"
  reps: number;
  rir: 0 | 1 | 2 | 3 | 4; // reps in reserve
  warmup?: boolean;
  supersetKey?: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO date
  ownerId?: string;
  sets: SetLog[];
  durationMinutes?: number; // used for training load calc, paired with SessionRPE
  program?: WorkoutProgram;
  focus?: WorkoutFocus;
  completedAt?: string;
  routine?: WorkoutExercisePlan[];
}

// ---------- Session RPE / Training Load ----------

export interface SessionRPE {
  id: string;
  workoutSessionId: string;
  ownerId?: string;
  rpe: number; // 1-10, Borg CR10-style scale
  trainingLoad: number; // computed: rpe * durationMinutes
}

// ---------- Readiness / CNS Check-In ----------

export interface ReadinessCheckIn {
  id: string;
  date: string; // ISO date
  ownerId?: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  motivation: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  readinessScore: number; // computed composite, 0-100
}

// Simple composite formula — average of 5 inputs, normalized to 100.
// (Swap/reweight later once you see how it correlates with RIR drift.)
export function computeReadinessScore(
  c: Omit<ReadinessCheckIn, "id" | "date" | "readinessScore">
): number {
  const avg =
    (c.sleepQuality + c.soreness + c.stress + c.motivation + c.energy) / 5;
  return Math.round((avg / 5) * 100);
}

// ---------- Nutrition (portion-based, not calorie counting) ----------

export interface MealLog {
  id: string;
  date: string; // ISO date
  ownerId?: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  proteinPortion: PortionSize;
  vegPortion: PortionSize;
  carbPortion: PortionSize;
}

// ============================================================
// MOCK DATA — ~2 weeks, deliberately includes:
// - a mid-log equipment switch (machine -> band) on chest press
// - a 3-day stretch where RIR drops while readiness stays low
//   (this is the pattern Phase 4's AI insight should catch)
// ============================================================

export const mockExercises: Exercise[] = [
  // ---------- CHEST ----------
  { id: "ex_chest_press_machine", name: "Chest Press Machine", muscleGroup: "chest", movementPattern: "push", equipmentTier: "machine", tensionEmphasis: "full_rom" },
  { id: "ex_band_chest_press", name: "Band Chest Press", muscleGroup: "chest", movementPattern: "push", equipmentTier: "band", tensionEmphasis: "full_rom" },
  { id: "ex_pushup", name: "Push-Up", muscleGroup: "chest", movementPattern: "push", equipmentTier: "bodyweight", tensionEmphasis: "full_rom" },
  { id: "ex_chest_fly_machine", name: "Chest Fly Machine", muscleGroup: "chest", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "stretch" },
  { id: "ex_band_chest_fly", name: "Band Chest Fly", muscleGroup: "chest", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "stretch" },
  { id: "ex_wide_pushup", name: "Wide-Arm Push-Up", muscleGroup: "chest", movementPattern: "isolation", equipmentTier: "bodyweight", tensionEmphasis: "stretch" },

  // ---------- BACK ----------
  { id: "ex_tbar_row", name: "T-Bar Row", muscleGroup: "back", movementPattern: "pull", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_row", name: "Band Row", muscleGroup: "back", movementPattern: "pull", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_towel_row", name: "Towel/Doorframe Row", muscleGroup: "back", movementPattern: "pull", equipmentTier: "bodyweight", tensionEmphasis: "peak_contraction" },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", muscleGroup: "back", movementPattern: "pull", equipmentTier: "machine", tensionEmphasis: "stretch" },
  { id: "ex_band_lat_pulldown", name: "Band Lat Pulldown", muscleGroup: "back", movementPattern: "pull", equipmentTier: "band", tensionEmphasis: "stretch" },

  // ---------- SHOULDERS ----------
  { id: "ex_shoulder_press_machine", name: "Shoulder Press Machine", muscleGroup: "shoulders", movementPattern: "push", equipmentTier: "machine", tensionEmphasis: "full_rom" },
  { id: "ex_band_ohp", name: "Band Overhead Press", muscleGroup: "shoulders", movementPattern: "push", equipmentTier: "band", tensionEmphasis: "full_rom" },
  { id: "ex_pike_pushup", name: "Pike Push-Up", muscleGroup: "shoulders", movementPattern: "push", equipmentTier: "bodyweight", tensionEmphasis: "full_rom" },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", muscleGroup: "shoulders", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_lateral_raise", name: "Band Lateral Raise", muscleGroup: "shoulders", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_cable_rear_delt", name: "Cable Rear Delt", muscleGroup: "shoulders", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_rear_delt", name: "Band Rear Delt Pull", muscleGroup: "shoulders", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },

  // ---------- BICEPS ----------
  { id: "ex_preacher_curl", name: "Preacher Curl", muscleGroup: "biceps", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "stretch" },
  { id: "ex_band_curl", name: "Band Curl", muscleGroup: "biceps", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "full_rom" },

  // ---------- TRICEPS ----------
  { id: "ex_tricep_pushdown", name: "Single Tricep Pushdown", muscleGroup: "triceps", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_tricep_pushdown", name: "Band Tricep Pushdown", muscleGroup: "triceps", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_diamond_pushup", name: "Diamond Push-Up", muscleGroup: "triceps", movementPattern: "isolation", equipmentTier: "bodyweight", tensionEmphasis: "full_rom" },

  // ---------- QUADS ----------
  { id: "ex_leg_extension", name: "Leg Extension", muscleGroup: "quads", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_smith_squat", name: "Smith Machine Squat", muscleGroup: "quads", movementPattern: "squat", equipmentTier: "machine", tensionEmphasis: "full_rom" },
  { id: "ex_band_squat", name: "Band Squat", muscleGroup: "quads", movementPattern: "squat", equipmentTier: "band", tensionEmphasis: "full_rom" },
  { id: "ex_bodyweight_squat", name: "Bodyweight Squat", muscleGroup: "quads", movementPattern: "squat", equipmentTier: "bodyweight", tensionEmphasis: "full_rom" },
  { id: "ex_bulgarian_split_squat", name: "Bulgarian Split Squat", muscleGroup: "quads", movementPattern: "squat", equipmentTier: "bodyweight", tensionEmphasis: "stretch" },

  // ---------- HAMSTRINGS ----------
  { id: "ex_leg_curl", name: "Leg Curl", muscleGroup: "hamstrings", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_leg_curl", name: "Band Leg Curl", muscleGroup: "hamstrings", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_sldl", name: "Stiff Leg Deadlift", muscleGroup: "hamstrings", movementPattern: "hinge", equipmentTier: "machine", tensionEmphasis: "stretch" },
  { id: "ex_band_rdl", name: "Band RDL", muscleGroup: "hamstrings", movementPattern: "hinge", equipmentTier: "band", tensionEmphasis: "stretch" },
  { id: "ex_single_leg_rdl", name: "Single-Leg RDL", muscleGroup: "hamstrings", movementPattern: "hinge", equipmentTier: "bodyweight", tensionEmphasis: "stretch" },

  // ---------- CORE ----------
  { id: "ex_cable_crunch", name: "Cable Crunch", muscleGroup: "core", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_crunch", name: "Band Crunch", muscleGroup: "core", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_bodyweight_crunch", name: "Bodyweight Crunch", muscleGroup: "core", movementPattern: "isolation", equipmentTier: "bodyweight", tensionEmphasis: "peak_contraction" },

  // ---------- CALVES ----------
  { id: "ex_calf_raise_machine", name: "Standing Calf Raise Machine", muscleGroup: "calves", movementPattern: "isolation", equipmentTier: "machine", tensionEmphasis: "peak_contraction" },
  { id: "ex_band_calf_raise", name: "Band Calf Raise", muscleGroup: "calves", movementPattern: "isolation", equipmentTier: "band", tensionEmphasis: "peak_contraction" },
  { id: "ex_bodyweight_calf_raise", name: "Bodyweight Calf Raise", muscleGroup: "calves", movementPattern: "isolation", equipmentTier: "bodyweight", tensionEmphasis: "full_rom" },
];

export const mockSubstitutionGroups: ExerciseSubstitutionGroup[] = [
  { id: "sub_chest_push", movementPattern: "push", muscleGroup: "chest", exerciseIds: ["ex_chest_press_machine", "ex_band_chest_press", "ex_pushup"] },
  { id: "sub_chest_isolation", movementPattern: "isolation", muscleGroup: "chest", exerciseIds: ["ex_chest_fly_machine", "ex_band_chest_fly", "ex_wide_pushup"] },
  { id: "sub_back_pull_peak", movementPattern: "pull", muscleGroup: "back", exerciseIds: ["ex_tbar_row", "ex_band_row", "ex_towel_row"] },
  { id: "sub_back_pull_stretch", movementPattern: "pull", muscleGroup: "back", exerciseIds: ["ex_lat_pulldown", "ex_band_lat_pulldown"] },
  { id: "sub_shoulder_push", movementPattern: "push", muscleGroup: "shoulders", exerciseIds: ["ex_shoulder_press_machine", "ex_band_ohp", "ex_pike_pushup"] },
  { id: "sub_shoulder_lateral", movementPattern: "isolation", muscleGroup: "shoulders", exerciseIds: ["ex_cable_lateral_raise", "ex_band_lateral_raise"] },
  { id: "sub_shoulder_rear_delt", movementPattern: "isolation", muscleGroup: "shoulders", exerciseIds: ["ex_cable_rear_delt", "ex_band_rear_delt"] },
  { id: "sub_biceps", movementPattern: "isolation", muscleGroup: "biceps", exerciseIds: ["ex_preacher_curl", "ex_band_curl"] },
  { id: "sub_triceps", movementPattern: "isolation", muscleGroup: "triceps", exerciseIds: ["ex_tricep_pushdown", "ex_band_tricep_pushdown", "ex_diamond_pushup"] },
  { id: "sub_quads_isolation", movementPattern: "isolation", muscleGroup: "quads", exerciseIds: ["ex_leg_extension"] },
  { id: "sub_quads_squat", movementPattern: "squat", muscleGroup: "quads", exerciseIds: ["ex_smith_squat", "ex_band_squat", "ex_bodyweight_squat", "ex_bulgarian_split_squat"] },
  { id: "sub_hamstring_isolation", movementPattern: "isolation", muscleGroup: "hamstrings", exerciseIds: ["ex_leg_curl", "ex_band_leg_curl"] },
  { id: "sub_hamstring_hinge", movementPattern: "hinge", muscleGroup: "hamstrings", exerciseIds: ["ex_sldl", "ex_band_rdl", "ex_single_leg_rdl"] },
  { id: "sub_core", movementPattern: "isolation", muscleGroup: "core", exerciseIds: ["ex_cable_crunch", "ex_band_crunch", "ex_bodyweight_crunch"] },
  { id: "sub_calves", movementPattern: "isolation", muscleGroup: "calves", exerciseIds: ["ex_calf_raise_machine", "ex_band_calf_raise", "ex_bodyweight_calf_raise"] },
];

export const mockWorkoutSessions: WorkoutSession[] = [
  {
    id: "sess_01",
    date: "2026-08-01",
    durationMinutes: 45,
    sets: [
      { id: "set_01", exerciseId: "ex_chest_press_machine", weightKg: 40, reps: 10, rir: 3 },
      { id: "set_02", exerciseId: "ex_sldl", weightKg: 120, reps: 6, rir: 2 },
    ],
  },
  {
    id: "sess_02",
    date: "2026-08-08", // relocation happens here — switches to bands
    durationMinutes: 40,
    sets: [
      { id: "set_03", exerciseId: "ex_band_chest_press", reps: 12, rir: 3 },
      { id: "set_04", exerciseId: "ex_band_rdl", reps: 12, rir: 2 },
    ],
  },
  {
    id: "sess_03",
    date: "2026-08-15", // RIR starts drifting down at same effective load
    durationMinutes: 40,
    sets: [
      { id: "set_05", exerciseId: "ex_band_chest_press", reps: 12, rir: 1 },
      { id: "set_06", exerciseId: "ex_band_rdl", reps: 12, rir: 1 },
    ],
  },
];

export const mockReadinessCheckIns: ReadinessCheckIn[] = [
  { id: "read_01", date: "2026-08-13", sleepQuality: 2, soreness: 2, stress: 2, motivation: 3, energy: 2, readinessScore: 44 },
  { id: "read_02", date: "2026-08-14", sleepQuality: 2, soreness: 2, stress: 2, motivation: 2, energy: 2, readinessScore: 40 },
  { id: "read_03", date: "2026-08-15", sleepQuality: 2, soreness: 1, stress: 2, motivation: 2, energy: 2, readinessScore: 36 },
];

export const mockSessionRPEs: SessionRPE[] = [
  { id: "rpe_01", workoutSessionId: "sess_01", rpe: 6, trainingLoad: 6 * 45 },
  { id: "rpe_02", workoutSessionId: "sess_02", rpe: 7, trainingLoad: 7 * 40 },
  { id: "rpe_03", workoutSessionId: "sess_03", rpe: 8, trainingLoad: 8 * 40 },
];

export const mockMealLogs: MealLog[] = [
  { id: "meal_01", date: "2026-08-15", mealType: "lunch", proteinPortion: "small", vegPortion: "medium", carbPortion: "large" },
  { id: "meal_02", date: "2026-08-15", mealType: "dinner", proteinPortion: "medium", vegPortion: "small", carbPortion: "large" },
];
