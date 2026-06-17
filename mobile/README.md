# VocabFlip — Mobile (Expo / React Native)

The native version of VocabFlip, built with Expo so you can run it on your
iPhone via **Expo Go** — no Apple Developer account or Xcode needed for testing.

## Run it on your iPhone (Expo Go)

On your **Mac**:

```bash
cd mobile
npm install
npx expo start
```

A QR code appears in the terminal. On your **iPhone**:

1. Install **Expo Go** from the App Store.
2. Open the **Camera** app and point it at the QR code (or scan from inside Expo Go).
3. The app opens live on your phone. Edits on the Mac hot-reload instantly.

> Your Mac and iPhone must be on the same Wi-Fi. If that's blocked, run
> `npx expo start --tunnel` instead.

> **SDK version note:** Expo Go always tracks the latest Expo SDK. If Expo Go
> says the project SDK is too old, run `npx expo install expo@latest && npx expo install --fix`
> (or scaffold fresh with `npx create-expo-app@latest` and drop in `App.js` + `src/`).

## Features

- **Spaced repetition (SM-2-lite)** — per-word scheduling, due-based sessions
- **Three recall modes** that scale with mastery: flashcard flip (swipe to grade),
  multiple choice (EN→HE), typing recall (HE→EN)
- **Text-to-speech** pronunciation via `expo-speech`, with an auto-speak option
- **Dashboard** — day streak, words learned, due/new counts
- **Settings** — auto-speak, new-words-per-session, reset progress
- **Offline-first** — progress saved on-device with AsyncStorage

## Going further (permanent app on your phone)

Expo Go runs the app while `expo start` is running. To get a standalone build
that stays on your iPhone without the dev server, use **EAS Build**
(`npx eas build -p ios`). Installing a standalone iOS build on a physical device
requires an Apple Developer account ($99/yr) — that's an Apple rule, not Expo's.

## Project structure

```
mobile/
  App.js          # all screens + navigation + animations
  src/words.js    # vocabulary deck
  src/store.js    # persistence + SRS scheduler (sync-ready)
  app.json        # Expo config
```

## Sync-ready data layer

All reads/writes go through `src/store.js`. To add cloud sync later, reimplement
`loadState()` / `persist()` to read/write a Supabase row — the rest of the app
is unchanged.
