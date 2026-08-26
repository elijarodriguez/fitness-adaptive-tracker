# Overtone

Overtone is a mobile-friendly adaptive training tracker. The current MVP focuses on one dependable workflow:

1. Sign in with Google or email/password.
2. Choose an exercise from the shared exercise library.
3. Add sets with weight, reps, variation, and reps in reserve (RIR).
4. Review, edit, or delete sets logged today.

Users can also create personal custom exercises. Authentication is handled by Firebase Authentication, and workout data is stored in Cloud Firestore.

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

The main visible product surface is currently `/`, `/account`, and `/log`. Check-in, meals, trends, wellness, and recovery components remain in the repository but are not part of the primary navigation while the MVP is being stabilized.

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

The MVP prioritizes reliable workout logging. Additional tracking and analytics features are present in the codebase but should be reintroduced to the main experience only after each workflow has focused tests and verified Firestore permissions.
