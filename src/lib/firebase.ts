import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Database } from "firebase/database";
import {
  app,
  auth,
  db,
  googleProvider,
  isFirebaseReady,
  getFirebaseStatus,
} from "@/services/firebase/FirebaseService";

// Backwards-compatible facade — all new code should import from
// "@/services/firebase" directly. This file keeps existing imports working.

export { app, auth, db, googleProvider, isFirebaseReady, getFirebaseStatus };
export type { FirebaseApp, Auth, Database };
