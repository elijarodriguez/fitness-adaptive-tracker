import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "../serviceAccountKey.json" with { type: "json" };

const collections = [
  "workoutSessions",
  "readinessCheckIns",
  "sessionRPEs",
  "mealLogs",
] as const;

const ownerId = process.argv[2];
const shouldApply = process.argv.includes("--apply");

if (ownerId === "--help" || ownerId === "-h" || !ownerId) {
  console.error("Usage: npx tsx scripts/migrate-owner.ts <firebase-user-uid> [--apply]");
  process.exit(ownerId ? 0 : 1);
}

initializeApp({ credential: cert(serviceAccount as ServiceAccount) });
const db = getFirestore();

async function migrateOwner() {
  const updates: Array<{ path: string; ownerId: string }> = [];
  let conflicts = 0;

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    for (const document of snapshot.docs) {
      const existingOwnerId = document.data().ownerId as string | undefined;
      if (existingOwnerId === ownerId) continue;
      if (existingOwnerId) {
        conflicts += 1;
        continue;
      }
      updates.push({ path: document.ref.path, ownerId });
    }
  }

  if (!shouldApply) {
    console.log(`Dry run: ${updates.length} document(s) would receive ownerId ${ownerId}.`);
    if (conflicts > 0) console.log(`Skipped ${conflicts} document(s) already owned by another user.`);
    console.log("No data was changed. Add --apply to perform the migration.");
    return;
  }

  if (updates.length === 0) {
    console.log("No documents need migration.");
    return;
  }

  for (let index = 0; index < updates.length; index += 450) {
    const batch = db.batch();
    for (const update of updates.slice(index, index + 450)) {
      batch.update(db.doc(update.path), { ownerId: update.ownerId });
    }
    await batch.commit();
  }
  console.log(`Migration complete: ${updates.length} document(s) now belong to ${ownerId}.`);
  if (conflicts > 0) console.log(`Skipped ${conflicts} document(s) already owned by another user.`);
}

migrateOwner().catch((error) => {
  console.error("Owner migration failed:", error);
  process.exit(1);
});