# StudyBRO

StudyBRO is a web-first study companion that combines concept-by-concept audio learning, AI-assisted quiz generation, flashcards, focus timers, and a companion system that grows with study consistency.

## Current MVP

- Paste study text or upload a PDF
- Convert material into concept checkpoints
- Read concepts aloud with browser speech synthesis
- Pause after each concept for a recall quiz
- Generate flashcards and export them as JSON or CSV
- Run a parallel focus timer with Pomodoro presets
- Switch between light and dark mode
- Choose a mascot and plant companion
- Create accounts with email/password or use guest sync
- Restore study progress across web and mobile when Firebase is configured
- Use OpenAI-backed concept analysis when an API key is configured, with a local fallback when it is not

## Planned Next Phases

- Active recall question generation and answer evaluation
- Weak area detection and revision mode
- Real animated plant growth and mascot reactions
- Firebase-backed progress syncing
- Expo-based mobile app conversion

## Run locally

```bash
npm install
npm run dev
```

## Run with the AI server

StudyBRO can analyze material with OpenAI through a small local Express server.

1. Copy `.env.example` to `.env`
2. Add your `OPENAI_API_KEY`
3. Start both the API server and Vite:

```bash
npm run dev:full
```

If `OPENAI_API_KEY` is empty, the app still works and falls back to the built-in concept splitter.

## Firebase Setup

StudyBRO works without Firebase, but accounts and cross-device sync need a Firebase project.

### Web env

1. Copy `.env.example` to `.env`
2. Fill in the Firebase web app values
3. Optionally add `OPENAI_API_KEY` and `OPENAI_MODEL`

### Mobile env

1. Copy `mobile/.env.example` to `mobile/.env`
2. Fill in the same Firebase project values using the `EXPO_PUBLIC_...` keys

### Firebase Console

1. Create a Firebase project
2. Add a Web app for the Vite client
3. Enable Firestore Database
4. Enable Authentication
5. Turn on:
   - Email/Password
   - Anonymous

### Firestore security

This repo includes [firestore.rules](/C:/Users/samyu/OneDrive/Desktop/StudyBro%20app/firestore.rules) so each signed-in user can only read and write their own `studybroSessions/{uid}` document.

If you use the Firebase CLI, deploy the rules with:

```bash
firebase deploy --only firestore:rules
```

If you configure rules manually in the Firebase Console, paste the contents of `firestore.rules`.

### What syncs

- study material text
- AI/local concept data
- current concept position
- timer settings
- mascot and plant selections
- recall progress and revision state

If Firebase is not configured, the web app still uses local persistence and the mobile app still works as a local shell.

## Run Mobile

```bash
cd mobile
npm install
npm run start
```
