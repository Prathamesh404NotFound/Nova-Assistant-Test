import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Firebase configuration — these MUST be set in your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Check if we have real Firebase credentials
function hasValidConfig(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.length > 20 &&
    !firebaseConfig.apiKey.includes("Demo") &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
const googleProvider = new GoogleAuthProvider();

if (hasValidConfig()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getDatabase(app);
    // Use browserLocalPersistence for proper cross-tab sync
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    console.log("[Nova] Firebase initialized successfully");
  } catch (err) {
    console.error("[Nova] Firebase initialization failed:", err);
    app = null;
    auth = null;
    db = null;
  }
} else {
  console.warn(
    "[Nova] Firebase not configured. Add VITE_FIREBASE_API_KEY, " +
    "VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID to your .env file. " +
    "Get credentials from https://console.firebase.google.com → Project Settings"
  );
}

/**
 * Check if Firebase is fully configured and ready.
 */
export function isFirebaseReady(): boolean {
  return auth !== null;
}

export { app, auth, db, googleProvider };
