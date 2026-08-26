# Overtone

Overtone is a mobile-friendly adaptive training tracker for strength and bodybuilding workflows. It connects readiness, programming, workout logging, recovery, nutrition, and training review in one daily loop:

1. Sign in with Google or email/password.
2. Complete a readiness check-in before training.
3. Choose a training program and focus.
4. Follow an ordered routine with planned sets, rep ranges, target RIR, rest periods, warm-up sets, and supersets.
5. Log working sets with weight, reps, variation, and RIR.
6. Finish the workout, record session effort, and review recovery trends.

Users can create personal custom exercises, track portion-based meals, inspect muscle-group set volume, and compare readiness with training effort. Authentication is handled by Firebase Authentication, and workout data is stored in Cloud Firestore.

## Features

- **Training programs:** PPL, Arnold Split, Upper/Lower, FBEOD, and Anterior/Posterior.
- **Programmable routines:** ordered exercises, planned sets, rep ranges, target RIR, rest periods, warm-up sets, and superset groups.
- **Progressive overload:** previous-set context and load recommendations such as adding 2.5 kg when the target RIR is maintained.
- **Workout completion:** finish a session and jump directly to post-workout RPE tracking.
- **Adaptive dashboard:** context-aware guidance based on readiness, session progress, nutrition, recent fatigue signals, and muscle-group volume.
- **Recovery analysis:** readiness and RIR direction, recent averages, and fatigue overlay charts.
- **Local workout coach:** rule-based written analysis of the current session with optional browser text-to-speech. It is free, private, and does not require an AI API key.
- **Mobile navigation:** bottom navigation for Today, Train, Fuel, and Review, with Fatigue and Account in More.

## Tech Stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Firebase Authentication
- Cloud Firestore
- Tailwind CSS
- Vercel for hosting

## Project Structure

```text
app/                       Next.js routes and global styles
components/                Auth, navigation, workout, and feature components
lib/firebase.ts            Firebase client initialization
lib/fitness-data-model.ts  Shared data types and exercise seed data
firestore.rules            Firestore security rules
firebase.json              Firebase CLI rules configuration
scripts/                   Local admin and seed scripts
```

The primary routes are `/`, `/checkin`, `/log`, `/meals`, `/trends`, `/fatigue`, `/wellness`, and `/account`.

## Requirements

- Node.js 20 or newer
- A Firebase project with Authentication and Cloud Firestore enabled
- npm

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The local workout coach uses the browser Web Speech API. Spoken feedback depends on browser and operating-system speech support; written feedback remains available when speech is unavailable.

## Firebase Setup

In Firebase Console:

1. Create or select the project used by the environment variables.
2. Enable **Authentication** providers for Google and Email/Password.
3. Add `localhost` and every deployed Vercel or custom domain under **Authentication > Settings > Authorized domains**.
4. Create a Cloud Firestore database.
5. Deploy the rules from this repository.

Authenticate the Firebase CLI and deploy the rules:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project your-project-id
```

The `firebase.json` file maps the deployment to `firestore.rules`.

## Vercel Deployment

Import the repository into Vercel and configure all six `NEXT_PUBLIC_FIREBASE_*` variables for the **Production** environment. Redeploy after changing environment variables.

Also add the exact Vercel hostname to Firebase Authentication authorized domains. Vercel hosting and Firebase rules are separate deployments, so deploy Firestore rules with the Firebase CLI as shown above.

The production build command is:

```bash
npm run build
```

## Commands

```bash
npm run dev      # Start the development server
npm run lint     # Run ESLint
npm run build    # Create a production build
npm test         # Run unit tests
npm run start    # Start the production server
```

## Local Admin Scripts

The scripts in `scripts/` use the Firebase Admin SDK and are intended for local, one-off maintenance only. They are excluded from the application TypeScript build.

To use them:

1. Generate a Firebase service-account key in Firebase Console.
2. Save it as `serviceAccountKey.json` in the project root.
3. Never commit or deploy that file. It is already listed in `.gitignore`.

Seed the shared exercise library:

```bash
npx tsx scripts/seed.ts
```

Preview or apply ownership migration:

```bash
npx tsx scripts/migrate-owner.ts <firebase-user-uid>
npx tsx scripts/migrate-owner.ts <firebase-user-uid> --apply
```

## Security Notes

- Firebase web configuration values use the `NEXT_PUBLIC_` prefix because they are needed by the browser. They are not substitutes for server credentials.
- Never expose `serviceAccountKey.json`, private keys, or Firebase Admin credentials.
- Firestore rules allow public reads for the shared exercise catalog and restrict personal records to the authenticated owner.
- Changes to `firestore.rules` do not take effect until they are deployed to Firebase.

## Current Scope

The app currently uses explainable local coaching rules rather than a paid or hosted large-language model. The coach evaluates logged sets, planned work, average RIR, loaded work, and completion state. It does not provide open-ended conversational reasoning.

Firestore permissions should be verified in the target Firebase project before production use. Run the available lint, build, and unit-test checks after changing workout or data-model behavior.
