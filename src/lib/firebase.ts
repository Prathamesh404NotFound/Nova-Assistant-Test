import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyDemoNovaAIOSApiKeyForTesting123",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "nova-ai-os.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "nova-ai-os",
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) || "https://nova-ai-os-default-rtdb.firebaseio.com",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "nova-ai-os.appspot.com",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "1234567890",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:1234567890:web:abcdef123456",
};

// Initialize Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getDatabase(app);
export default app;
