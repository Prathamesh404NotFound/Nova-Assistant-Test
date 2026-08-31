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
import { auth, googleProvider } from "@/lib/firebase";

/**
 * Check if Firebase is configured with real credentials (not demo defaults).
 */
function isFirebaseConfigured(): boolean {
  const key = import.meta.env.VITE_FIREBASE_API_KEY as string;
  // Demo key from firebase.ts fallback
  return !!key && key !== "AIzaSyDemoNovaAIOSApiKeyForTesting123" && key.length > 20;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    // Only restore from localStorage if Firebase is actually configured
    if (!isFirebaseConfigured()) return null;
    try {
      const local = localStorage.getItem("nova_local_user");
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If Firebase isn't configured, skip auth listener
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let unsub: () => void = () => {};
    try {
      unsub = onAuthStateChanged(
        auth,
        (u) => {
          if (u) {
            setUser(u);
            localStorage.setItem(
              "nova_local_user",
              JSON.stringify({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || "User",
              })
            );
          } else {
            setUser(null);
            try {
              localStorage.removeItem("nova_local_user");
            } catch { /* ignore */ }
          }
          setIsLoading(false);
        },
        (_err) => {
          setIsLoading(false);
        }
      );
    } catch {
      setIsLoading(false);
    }
    return () => unsub();
  }, []);

  const signIn = useCallback(
    async (method: string, formData?: FormData) => {
      // Block sign-in attempts when Firebase isn't configured
      if (!isFirebaseConfigured()) {
        throw new Error(
          "Firebase is not configured. Add your Firebase project credentials to the .env file as VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc."
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
    try {
      localStorage.removeItem("nova_local_user");
    } catch { /* ignore */ }
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch { /* ignore */ }
  }, []);

  return {
    isLoading,
    isAuthenticated: !!user,
    user,
    signIn,
    signOut,
  };
}
