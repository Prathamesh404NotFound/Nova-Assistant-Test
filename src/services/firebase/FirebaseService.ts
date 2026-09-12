/**
 * Nova Firebase Service
 * Single point of Firebase initialization. Other modules must import from
 * here instead of calling initializeApp themselves.
 * Gracefully supports an unconfigured dev environment.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { env } from "@/config/env";

export interface FirebaseStatus {
  configured: boolean;
  initialized: boolean;
  /** Human-readable detail when not ready. Never contains secret values. */
  detail?: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let initError: string | null = null;
const googleProvider = new GoogleAuthProvider();

if (!env.firebaseReady) {
  const missing = env.firebaseEntries
    .filter((e) => e.status !== "ok")
    .map((e) => e.name)
    .join(", ");
  initError = `Firebase not configured — missing: ${missing}`;
  if (import.meta.env.DEV) console.warn("[Nova Firebase]", initError);
} else {
  try {
    const config = {
      apiKey: env.firebase.apiKey,
      authDomain: env.firebase.authDomain,
      projectId: env.firebase.projectId,
      databaseURL: env.firebase.databaseURL,
      storageBucket: env.firebase.storageBucket,
      messagingSenderId: env.firebase.messagingSenderId,
      appId: env.firebase.appId,
    };
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    auth = getAuth(app);
    db = getDatabase(app);
    setPersistence(auth, browserLocalPersistence).catch((err) =>
      console.warn("[Nova Firebase] persistence setup failed:", err)
    );
    if (import.meta.env.DEV) console.info("[Nova Firebase] initialized");
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    console.error("[Nova Firebase] initialization failed:", err);
    app = null;
    auth = null;
    db = null;
  }
}

export function getFirebaseStatus(): FirebaseStatus {
  if (auth) return { configured: true, initialized: true };
  return {
    configured: env.firebaseReady,
    initialized: false,
    detail: initError ?? "Firebase unavailable",
  };
}

export function isFirebaseReady(): boolean {
  return auth !== null;
}

export { app, auth, db, googleProvider };
