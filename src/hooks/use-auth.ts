import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseReady } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If Firebase isn't configured, skip auth entirely
    if (!isFirebaseReady() || !auth) {
      setIsLoading(false);
      return;
    }

    // onAuthStateChanged handles cross-tab sync automatically
    // when using browserLocalPersistence (set in firebase.ts)
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setIsLoading(false);
      },
      (_err) => {
        setUser(null);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const signIn = useCallback(
    async (method: string, formData?: FormData) => {
      if (!isFirebaseReady() || !auth) {
        throw new Error(
          "Firebase is not configured. Add your Firebase project credentials to the .env file."
        );
      }

      switch (method) {
        case "anonymous": {
          const res = await signInAnonymously(auth);
          setUser(res.user);
          return res;
        }

        case "google": {
          const res = await signInWithPopup(auth, googleProvider);
          setUser(res.user);
          return res;
        }

        case "email-otp": {
          const email = formData?.get("email") as string;
          const password = formData?.get("password") as string;
          const mode = formData?.get("mode") as string;

          if (mode === "signup") {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            setUser(res.user);
            return res;
          }
          const res = await signInWithEmailAndPassword(auth, email, password);
          setUser(res.user);
          return res;
        }

        default:
          throw new Error(`Unknown sign-in method: ${method}`);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setUser(null);
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ignore */
      }
    }
  }, []);

  return {
    isLoading,
    isAuthenticated: !!user,
    user,
    signIn,
    signOut,
  };
}
