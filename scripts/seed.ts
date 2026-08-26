// scripts/seed.ts
//
// One-time script to push mockExercises and mockSubstitutionGroups into Firestore.
// Uses firebase-admin (not the client SDK) since this runs in Node, not a browser.
//
// Setup:
//   1. Download a service account key from Firebase console:
//      Project Settings > Service Accounts > Generate new private key
//   2. Save it as serviceAccountKey.json in the project root
//   3. Add serviceAccountKey.json to .gitignore (never commit this file)
//   4. npm install firebase-admin
//
// Run with: npx tsx scripts/seed.ts

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  mockExercises,
  mockSubstitutionGroups,
} from "../lib/fitness-data-model";
import serviceAccount from "../serviceAccountKey.json" with { type: "json" };

initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

async function seed() {
  const batch = db.batch();

  console.log(`Seeding ${mockExercises.length} exercises...`);
  for (const exercise of mockExercises) {
    const ref = db.collection("exercises").doc(exercise.id);
    batch.set(ref, exercise);
  }

  console.log(
    `Seeding ${mockSubstitutionGroups.length} substitution groups...`
  );
  for (const group of mockSubstitutionGroups) {
    const ref = db.collection("substitutionGroups").doc(group.id);
    batch.set(ref, group);
  }

  await batch.commit();
  console.log("✅ Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});