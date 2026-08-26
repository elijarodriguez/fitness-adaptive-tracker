import { describe, expect, it } from "vitest";
import {
  computeReadinessScore,
  mockExercises,
  mockSessionRPEs,
  mockSubstitutionGroups,
} from "../lib/fitness-data-model";

describe("computeReadinessScore", () => {
  it("returns 20 for the lowest possible inputs", () => {
    expect(
      computeReadinessScore({
        sleepQuality: 1,
        soreness: 1,
        stress: 1,
        motivation: 1,
        energy: 1,
      })
    ).toBe(20);
  });

  it("returns 100 for the highest possible inputs", () => {
    expect(
      computeReadinessScore({
        sleepQuality: 5,
        soreness: 5,
        stress: 5,
        motivation: 5,
        energy: 5,
      })
    ).toBe(100);
  });

  it("rounds the normalized average to the nearest whole number", () => {
    expect(
      computeReadinessScore({
        sleepQuality: 5,
        soreness: 4,
        stress: 3,
        motivation: 2,
        energy: 1,
      })
    ).toBe(60);
  });
});

describe("exercise library data", () => {
  it("contains unique exercise IDs", () => {
    const ids = mockExercises.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only existing exercises in substitution groups", () => {
    const exerciseIds = new Set(mockExercises.map((exercise) => exercise.id));
    for (const group of mockSubstitutionGroups) {
      expect(group.exerciseIds.every((id) => exerciseIds.has(id))).toBe(true);
    }
  });

  it("keeps mock training loads consistent with RPE and duration", () => {
    const durations = new Map([
      ["sess_01", 45],
      ["sess_02", 40],
      ["sess_03", 40],
    ]);
    for (const entry of mockSessionRPEs) {
      expect(entry.trainingLoad).toBe(entry.rpe * (durations.get(entry.workoutSessionId) ?? 0));
    }
  });
});
