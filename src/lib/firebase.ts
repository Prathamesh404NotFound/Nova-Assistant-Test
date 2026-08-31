import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Firebase configuration — these MUST be set in your .env file
// Get them from: https://console.firebase.google.com → Project Settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Validate required config
const requiredKeys = ["apiKey", "authDomain", "projectId"] as const;
const missing = requiredKeys.filter((k) => !firebaseConfig[k]);

if (missing.length > 0) {
  console.error(
    `[Nova] Firebase configuration missing: ${missing.join(", ")}. ` +
    `Add VITE_FIREBASE_${missing[0].toUpperCase()} to your .env file. ` +
    `Get credentials from https://console.firebase.google.com → Project Settings`
  );
}

// Initialize Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getDatabase(app);
export default app;
